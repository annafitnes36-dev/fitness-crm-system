-- Закрываем дублирующие открытые смены, оставляем только последнюю по каждой паре staffId+branchId
UPDATE crm_state
SET data = jsonb_set(
  data,
  '{shifts}',
  (
    SELECT jsonb_agg(
      CASE
        -- Если смена открыта И для этой пары staffId+branchId есть более поздняя открытая — закрываем
        WHEN sh->>'closedAt' IS NULL AND (
          SELECT COUNT(*) FROM jsonb_array_elements(data->'shifts') s2
          WHERE s2->>'staffId' = sh->>'staffId'
            AND s2->>'branchId' = sh->>'branchId'
            AND s2->>'closedAt' IS NULL
            AND s2->>'openedAt' > sh->>'openedAt'
        ) > 0
        THEN sh || jsonb_build_object('closedAt', sh->>'openedAt')
        ELSE sh
      END
    )
    FROM jsonb_array_elements(data->'shifts') sh
  )
)
WHERE id = 'main'