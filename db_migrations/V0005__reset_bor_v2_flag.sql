UPDATE t_p77908769_fitness_crm_system.crm_state
SET data = data - 'importedBorV2',
    updated_at = NOW()
WHERE id = 'main';