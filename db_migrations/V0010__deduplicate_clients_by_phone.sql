-- Дедупликация клиентов: оставляем одну запись на телефон
-- Приоритет: 1) у кого есть activeSubscriptionId, 2) у кого dashboardExclude != true (реальный клиент), 3) по id алфавитно

UPDATE t_p77908769_fitness_crm_system.crm_state
SET data = jsonb_set(
  data,
  '{clients}',
  (
    SELECT jsonb_agg(c ORDER BY c->>'id')
    FROM (
      SELECT DISTINCT ON (c->>'phone')
        c
      FROM jsonb_array_elements(data->'clients') c
      WHERE c->>'phone' != '' AND c->>'phone' IS NOT NULL
      ORDER BY 
        c->>'phone',
        CASE WHEN c->>'activeSubscriptionId' IS NOT NULL AND c->>'activeSubscriptionId' != 'null' THEN 0 ELSE 1 END,
        CASE WHEN c->>'dashboardExclude' IS NULL OR c->>'dashboardExclude' = 'false' THEN 0 ELSE 1 END,
        c->>'id'
    ) deduped
    UNION ALL
    SELECT c
    FROM jsonb_array_elements(data->'clients') c
    WHERE c->>'phone' = '' OR c->>'phone' IS NULL
  )
),
updated_at = NOW()
WHERE id = 'main';