-- Таблица для автоматических резервных копий состояния CRM
CREATE TABLE IF NOT EXISTS t_p77908769_fitness_crm_system.crm_state_backups (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    label       TEXT,          -- описание (например 'auto', 'manual', 'before_import')
    data        JSONB NOT NULL
);

-- Индекс для быстрой сортировки по времени
CREATE INDEX IF NOT EXISTS crm_state_backups_created_at_idx
    ON t_p77908769_fitness_crm_system.crm_state_backups (created_at DESC);
