UPDATE t_p77908769_fitness_crm_system.crm_state
SET data = jsonb_set(data, '{importedTsentrV1}', 'true'::jsonb),
    updated_at = NOW()
WHERE id = 'main';