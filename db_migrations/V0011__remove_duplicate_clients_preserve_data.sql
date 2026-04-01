
-- Удаление дублей клиентов с переносом связанных данных на главный ID
-- Используем чистый SQL без PL/pgSQL из-за ограничений протокола

WITH schema_name AS (
  SELECT 't_p77908769_fitness_crm_system' AS s
),

-- Шаг 1: Получаем текущие данные
current_data AS (
  SELECT data FROM t_p77908769_fitness_crm_system.crm_state WHERE id = 'main'
),

-- Шаг 2: Разворачиваем клиентов с приоритетом
clients_with_priority AS (
  SELECT
    c->>'id'    AS client_id,
    c->>'phone' AS phone,
    regexp_replace(c->>'phone', '[^0-9]', '', 'g') AS phone_clean,
    CASE
      WHEN c->>'id' LIKE 'tc_%'     THEN 1
      WHEN c->>'id' LIKE 'bor_%'    THEN 2
      WHEN c->>'id' LIKE 'cv_%'     THEN 3
      WHEN c->>'id' LIKE 'cv3_%'    THEN 3
      WHEN c->>'id' LIKE 'tsentr_%' THEN 4
      WHEN c->>'id' LIKE 'olimp_%'  THEN 5
      ELSE 6
    END AS priority,
    c AS client_json
  FROM current_data, jsonb_array_elements(data->'clients') AS c
  WHERE regexp_replace(c->>'phone', '[^0-9]', '', 'g') != ''
),

-- Шаг 3: Для каждой группы дублей определяем главный ID
duplicate_groups AS (
  SELECT phone_clean
  FROM clients_with_priority
  GROUP BY phone_clean
  HAVING count(*) > 1
),

main_ids AS (
  SELECT DISTINCT ON (p.phone_clean)
    p.phone_clean,
    p.client_id AS main_id
  FROM clients_with_priority p
  INNER JOIN duplicate_groups d ON p.phone_clean = d.phone_clean
  ORDER BY p.phone_clean, p.priority ASC, p.client_id ASC
),

-- Шаг 4: Строим таблицу маппинга dup_id -> main_id
merge_map AS (
  SELECT
    p.client_id AS dup_id,
    m.main_id
  FROM clients_with_priority p
  INNER JOIN main_ids m ON p.phone_clean = m.phone_clean
  WHERE p.client_id != m.main_id
),

-- Шаг 5: Новый массив клиентов (без дублей)
new_clients AS (
  SELECT jsonb_agg(c.client_json ORDER BY c.client_id) AS clients_array
  FROM clients_with_priority c
  WHERE c.client_id NOT IN (SELECT dup_id FROM merge_map)
  UNION ALL
  -- Клиенты без телефона (пустой после очистки) - оставляем как есть
  SELECT jsonb_agg(c2) AS clients_array
  FROM current_data, jsonb_array_elements(data->'clients') AS c2
  WHERE regexp_replace(c2->>'phone', '[^0-9]', '', 'g') = ''
),

combined_clients AS (
  SELECT jsonb_agg(elem) AS clients_array
  FROM new_clients, jsonb_array_elements(clients_array) AS elem
),

-- Шаг 6: Обновляем sales
new_sales AS (
  SELECT jsonb_agg(
    CASE
      WHEN mm.main_id IS NOT NULL
      THEN jsonb_set(s, '{clientId}', to_jsonb(mm.main_id))
      ELSE s
    END
  ) AS sales_array
  FROM current_data, jsonb_array_elements(data->'sales') AS s
  LEFT JOIN merge_map mm ON mm.dup_id = s->>'clientId'
),

-- Шаг 7: Обновляем subscriptions
new_subscriptions AS (
  SELECT jsonb_agg(
    CASE
      WHEN mm.main_id IS NOT NULL
      THEN jsonb_set(sub, '{clientId}', to_jsonb(mm.main_id))
      ELSE sub
    END
  ) AS subs_array
  FROM current_data, jsonb_array_elements(data->'subscriptions') AS sub
  LEFT JOIN merge_map mm ON mm.dup_id = sub->>'clientId'
),

-- Шаг 8: Обновляем visits
new_visits AS (
  SELECT jsonb_agg(
    CASE
      WHEN mm.main_id IS NOT NULL
      THEN jsonb_set(v, '{clientId}', to_jsonb(mm.main_id))
      ELSE v
    END
  ) AS visits_array
  FROM current_data, jsonb_array_elements(data->'visits') AS v
  LEFT JOIN merge_map mm ON mm.dup_id = v->>'clientId'
),

-- Шаг 9: Обновляем bonusTransactions
new_bonus AS (
  SELECT jsonb_agg(
    CASE
      WHEN mm.main_id IS NOT NULL
      THEN jsonb_set(bt, '{clientId}', to_jsonb(mm.main_id))
      ELSE bt
    END
  ) AS bonus_array
  FROM current_data, jsonb_array_elements(COALESCE(data->'bonusTransactions','[]'::jsonb)) AS bt
  LEFT JOIN merge_map mm ON mm.dup_id = bt->>'clientId'
)

UPDATE t_p77908769_fitness_crm_system.crm_state
SET data = data
  || jsonb_build_object('clients',          (SELECT clients_array FROM combined_clients))
  || jsonb_build_object('sales',            COALESCE((SELECT sales_array FROM new_sales), '[]'::jsonb))
  || jsonb_build_object('subscriptions',    COALESCE((SELECT subs_array FROM new_subscriptions), '[]'::jsonb))
  || jsonb_build_object('visits',           COALESCE((SELECT visits_array FROM new_visits), '[]'::jsonb))
  || jsonb_build_object('bonusTransactions',COALESCE((SELECT bonus_array FROM new_bonus), '[]'::jsonb))
WHERE id = 'main'
