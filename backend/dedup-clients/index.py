import json
import os
import psycopg2
import re

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p77908769_fitness_crm_system')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def clean_phone(phone):
    return re.sub(r'[^0-9]', '', str(phone or ''))

def handler(event: dict, context) -> dict:
    """Дедупликация клиентов по номеру телефона в указанных филиалах.
    POST ?action=preview  — показать сколько дублей будет удалено (без удаления)
    POST ?action=run      — выполнить дедупликацию
    Тело: {"branchIds": ["b_cvetnoi", "n8yopzru"]}
    Приоритет оставить: у кого есть activeSubscriptionId, иначе — первый попавшийся.
    """
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'preview')
    body = {}
    if event.get('body'):
        body = json.loads(event['body'])

    branch_ids = body.get('branchIds', ['b_cvetnoi', 'n8yopzru'])

    conn = get_conn()
    cur = conn.cursor()

    # Загружаем текущий стейт
    cur.execute(f"SELECT data FROM {SCHEMA}.crm_state WHERE id = 'main'")
    row = cur.fetchone()
    if not row:
        conn.close()
        return {'statusCode': 404, 'headers': cors, 'body': json.dumps({'error': 'state not found'})}

    state = row[0]
    clients = state.get('clients', [])

    # Группируем клиентов по (branchId, phone_clean)
    groups = {}  # (branch_id, phone_clean) -> [client, ...]
    other_clients = []  # клиенты не из указанных филиалов

    for c in clients:
        bid = c.get('branchId', '')
        if bid not in branch_ids:
            other_clients.append(c)
            continue
        phone = clean_phone(c.get('phone', ''))
        if len(phone) < 7:
            other_clients.append(c)
            continue
        key = (bid, phone)
        if key not in groups:
            groups[key] = []
        groups[key].append(c)

    # Определяем кого оставить, кого удалить
    to_keep = []
    to_delete_ids = set()
    dupe_groups_count = 0

    for (bid, phone), group in groups.items():
        if len(group) == 1:
            to_keep.append(group[0])
            continue

        dupe_groups_count += 1
        # Приоритет: у кого есть activeSubscriptionId
        with_sub = [c for c in group if c.get('activeSubscriptionId')]
        without_sub = [c for c in group if not c.get('activeSubscriptionId')]

        if with_sub:
            winner = with_sub[0]
            losers = with_sub[1:] + without_sub
        else:
            winner = group[0]
            losers = group[1:]

        to_keep.append(winner)
        for loser in losers:
            to_delete_ids.add(loser['id'])

    total_deleted = len(to_delete_ids)

    if action == 'preview':
        conn.close()
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({
                'dupe_groups': dupe_groups_count,
                'to_delete': total_deleted,
                'branch_ids': branch_ids,
            })
        }

    # action == 'run' — выполняем удаление
    new_clients = to_keep + other_clients

    # Также чистим deletedClientIds (добавляем удалённых)
    existing_deleted = state.get('deletedClientIds', [])
    new_deleted = list(set(existing_deleted) | to_delete_ids)

    state['clients'] = new_clients
    state['deletedClientIds'] = new_deleted

    cur.execute(
        f"UPDATE {SCHEMA}.crm_state SET data = %s WHERE id = 'main'",
        (json.dumps(state),)
    )
    conn.commit()
    conn.close()

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'success': True,
            'deleted': total_deleted,
            'dupe_groups': dupe_groups_count,
            'clients_before': len(clients),
            'clients_after': len(new_clients),
        })
    }
