import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p77908769_fitness_crm_system')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Исправляет branchId у продаж: берёт branchId клиента и проставляет его в продажу.
    GET  ?action=preview  — показать сколько продаж будет исправлено
    POST ?action=run      — выполнить исправление
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

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"SELECT data FROM {SCHEMA}.crm_state WHERE id = 'main'")
    row = cur.fetchone()
    if not row:
        conn.close()
        return {'statusCode': 404, 'headers': cors, 'body': json.dumps({'error': 'state not found'})}

    state = row[0]
    clients = state.get('clients', [])
    sales = state.get('sales', [])
    subscriptions = state.get('subscriptions', [])

    # Строим карту clientId -> branchId
    client_branch = {c['id']: c.get('branchId', '') for c in clients}

    fixes = []
    for s in sales:
        client_id = s.get('clientId', '')
        sale_branch = s.get('branchId', '')
        correct_branch = client_branch.get(client_id, '')
        if correct_branch and correct_branch != sale_branch:
            fixes.append({
                'saleId': s['id'],
                'clientId': client_id,
                'from': sale_branch,
                'to': correct_branch,
                'item': s.get('itemName', ''),
                'date': s.get('date', ''),
            })

    if action == 'preview':
        conn.close()
        # Группируем по направлению
        by_direction = {}
        for f in fixes:
            key = f"{f['from']} -> {f['to']}"
            by_direction[key] = by_direction.get(key, 0) + 1
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'total_fixes': len(fixes), 'by_direction': by_direction, 'sample': fixes[:5]})
        }

    # action == 'run' — применяем
    sale_id_to_fix = {f['saleId']: f['to'] for f in fixes}

    # Также исправляем подписки
    sub_fixes = 0
    for sub in subscriptions:
        client_id = sub.get('clientId', '')
        correct_branch = client_branch.get(client_id, '')
        if correct_branch and correct_branch != sub.get('branchId', ''):
            sub['branchId'] = correct_branch
            sub_fixes += 1

    new_sales = []
    for s in sales:
        if s['id'] in sale_id_to_fix:
            s = dict(s)
            s['branchId'] = sale_id_to_fix[s['id']]
        new_sales.append(s)

    state['sales'] = new_sales
    state['subscriptions'] = subscriptions

    cur.execute(
        f"UPDATE {SCHEMA}.crm_state SET data = %s WHERE id = 'main'",
        (json.dumps(state),)
    )
    conn.commit()
    conn.close()

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({'success': True, 'sales_fixed': len(fixes), 'subscriptions_fixed': sub_fixes})
    }
