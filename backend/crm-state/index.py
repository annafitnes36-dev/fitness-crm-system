import json
import os
import secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p77908769_fitness_crm_system')

# Сколько автоматических бэкапов хранить максимум
MAX_AUTO_BACKUPS = 30
# Минимальный интервал между автобэкапами (в минутах)
AUTO_BACKUP_INTERVAL_MINUTES = 30


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    """Сохранение/загрузка состояния CRM.
    GET  ?action=state              — загрузить всё
    POST ?action=state              — сохранить всё (полный state)
    POST ?action=patch              — обновить только указанные поля (patch)
    GET/POST ?action=token          — токен доступа
    POST ?action=backup             — создать ручной бэкап (label из тела)
    GET  ?action=backups            — список бэкапов (id, created_at, label)
    GET  ?action=backup&id=<N>      — получить данные конкретного бэкапа
    POST ?action=restore&id=<N>     — восстановить из бэкапа (создаёт бэкап текущего перед восстановлением)
    DELETE ?action=backup&id=<N>    — удалить бэкап
    """
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'state')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── STATE ──────────────────────────────────────────────────────────────
        if action == 'state':
            if method == 'GET':
                cur.execute(f"SELECT data FROM {SCHEMA}.crm_state WHERE id = 'main'")
                row = cur.fetchone()
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'data': row[0] if row else None})}

            if method == 'POST':
                body = json.loads(event.get('body') or '{}')
                data = body.get('data')
                if data is None:
                    return {'statusCode': 400, 'headers': cors,
                            'body': json.dumps({'ok': False, 'error': 'no data'})}

                data_json = json.dumps(data, ensure_ascii=False).replace("'", "''")

                # Сохраняем основное состояние
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.crm_state (id, data, updated_at)
                        VALUES ('main', '{data_json}'::jsonb, NOW())
                        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()"""
                )

                # Автобэкап: только если прошло достаточно времени с последнего
                cur.execute(
                    f"""SELECT created_at FROM {SCHEMA}.crm_state_backups
                        WHERE label = 'auto'
                        ORDER BY created_at DESC LIMIT 1"""
                )
                last_backup = cur.fetchone()
                needs_backup = True
                if last_backup:
                    cur.execute(
                        f"""SELECT EXTRACT(EPOCH FROM (NOW() - %s)) / 60 AS minutes""",
                        (last_backup[0],)
                    )
                    minutes_row = cur.fetchone()
                    if minutes_row and minutes_row[0] < AUTO_BACKUP_INTERVAL_MINUTES:
                        needs_backup = False

                if needs_backup:
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.crm_state_backups (label, data, created_at)
                            VALUES ('auto', '{data_json}'::jsonb, NOW())"""
                    )
                    # Удаляем старые автобэкапы сверх лимита
                    cur.execute(
                        f"""DELETE FROM {SCHEMA}.crm_state_backups
                            WHERE label = 'auto' AND id NOT IN (
                                SELECT id FROM {SCHEMA}.crm_state_backups
                                WHERE label = 'auto'
                                ORDER BY created_at DESC
                                LIMIT {MAX_AUTO_BACKUPS}
                            )"""
                    )

                conn.commit()
                return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

        # ── PATCH ──────────────────────────────────────────────────────────────
        if action == 'patch':
            if method == 'POST':
                body = json.loads(event.get('body') or '{}')
                patch = body.get('patch')
                if not patch or not isinstance(patch, dict):
                    return {'statusCode': 400, 'headers': cors,
                            'body': json.dumps({'ok': False, 'error': 'no patch'})}
                patch_json = json.dumps(patch, ensure_ascii=False).replace("'", "''")
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.crm_state (id, data, updated_at)
                        VALUES ('main', '{patch_json}'::jsonb, NOW())
                        ON CONFLICT (id) DO UPDATE
                          SET data = {SCHEMA}.crm_state.data || '{patch_json}'::jsonb,
                              updated_at = NOW()"""
                )
                conn.commit()
                return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'ok': True})}

        # ── TOKEN ──────────────────────────────────────────────────────────────
        if action == 'token':
            if method == 'GET':
                cur.execute(f"SELECT token FROM {SCHEMA}.crm_access_token WHERE id = 'main'")
                row = cur.fetchone()
                if not row:
                    token = secrets.token_urlsafe(24)
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.crm_access_token (id, token) VALUES ('main', '{token}')"
                    )
                    conn.commit()
                else:
                    token = row[0]
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'token': token})}

            if method == 'POST':
                token = secrets.token_urlsafe(24)
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.crm_access_token (id, token, updated_at)
                        VALUES ('main', '{token}', NOW())
                        ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()"""
                )
                conn.commit()
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'token': token})}

        # ── BACKUPS LIST ───────────────────────────────────────────────────────
        if action == 'backups':
            if method == 'GET':
                cur.execute(
                    f"""SELECT id, created_at, label,
                               pg_column_size(data) AS size_bytes
                        FROM {SCHEMA}.crm_state_backups
                        ORDER BY created_at DESC
                        LIMIT 100"""
                )
                rows = cur.fetchall()
                backups = [
                    {
                        'id': r[0],
                        'created_at': r[1].isoformat(),
                        'label': r[2],
                        'size_bytes': r[3],
                    }
                    for r in rows
                ]
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'backups': backups})}

        # ── SINGLE BACKUP ──────────────────────────────────────────────────────
        if action == 'backup':
            backup_id = params.get('id')

            # Создать ручной бэкап
            if method == 'POST':
                body = json.loads(event.get('body') or '{}')
                label = body.get('label') or 'manual'
                # Берём текущее состояние из БД
                cur.execute(f"SELECT data FROM {SCHEMA}.crm_state WHERE id = 'main'")
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors,
                            'body': json.dumps({'ok': False, 'error': 'no state to backup'})}
                data_json = json.dumps(row[0], ensure_ascii=False).replace("'", "''")
                label_safe = label.replace("'", "''")
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.crm_state_backups (label, data, created_at)
                        VALUES ('{label_safe}', '{data_json}'::jsonb, NOW())
                        RETURNING id"""
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True, 'id': new_id})}

            # Получить данные конкретного бэкапа
            if method == 'GET' and backup_id:
                cur.execute(
                    f"""SELECT id, created_at, label, data
                        FROM {SCHEMA}.crm_state_backups
                        WHERE id = {int(backup_id)}"""
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors,
                            'body': json.dumps({'ok': False, 'error': 'not found'})}
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({
                            'ok': True,
                            'backup': {
                                'id': row[0],
                                'created_at': row[1].isoformat(),
                                'label': row[2],
                                'data': row[3],
                            }
                        })}

            # Удалить бэкап
            if method == 'DELETE' and backup_id:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.crm_state_backups WHERE id = {int(backup_id)}"
                )
                conn.commit()
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True})}

        # ── RESTORE ────────────────────────────────────────────────────────────
        if action == 'restore':
            backup_id = params.get('id')
            if method == 'POST' and backup_id:
                # Получаем данные бэкапа
                cur.execute(
                    f"""SELECT data FROM {SCHEMA}.crm_state_backups
                        WHERE id = {int(backup_id)}"""
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors,
                            'body': json.dumps({'ok': False, 'error': 'backup not found'})}

                restore_data = row[0]

                # Сначала сохраняем текущее состояние как бэкап с меткой 'before_restore'
                cur.execute(f"SELECT data FROM {SCHEMA}.crm_state WHERE id = 'main'")
                current = cur.fetchone()
                if current:
                    cur_json = json.dumps(current[0], ensure_ascii=False).replace("'", "''")
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.crm_state_backups (label, data, created_at)
                            VALUES ('before_restore', '{cur_json}'::jsonb, NOW())"""
                    )

                # Восстанавливаем состояние
                restore_json = json.dumps(restore_data, ensure_ascii=False).replace("'", "''")
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.crm_state (id, data, updated_at)
                        VALUES ('main', '{restore_json}'::jsonb, NOW())
                        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()"""
                )
                conn.commit()
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'ok': True})}

    finally:
        cur.close()
        conn.close()

    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'unknown action'})}
