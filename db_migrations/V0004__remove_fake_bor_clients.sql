UPDATE t_p77908769_fitness_crm_system.crm_state
SET data = jsonb_set(
  data,
  '{clients}',
  (SELECT jsonb_agg(c) FROM jsonb_array_elements(data->'clients') c WHERE NOT (c->>'id' LIKE 'bor_%' AND (c->>'importedSpent')::int IS NOT NULL))
),
updated_at = NOW()
WHERE id = 'main';