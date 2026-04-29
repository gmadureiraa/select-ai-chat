UPDATE planning_items
SET status = 'publishing',
    error_message = NULL,
    external_post_id = '69f2209dac551eaabc2349c3',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'late_post_id', '69f2209dac551eaabc2349c3',
      'reconciled_at', '2026-04-29T15:50:00Z',
      'reconciled_reason', 'manual_check_late_api_was_publishing'
    ),
    updated_at = now()
WHERE id = '428788a8-e251-4a28-b817-ad9ee5b6efc1';