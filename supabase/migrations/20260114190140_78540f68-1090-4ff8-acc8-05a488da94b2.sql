-- Add content_library_id to platform_metrics for newsletter integration
ALTER TABLE platform_metrics 
ADD COLUMN IF NOT EXISTS content_library_id UUID 
REFERENCES client_content_library(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_metrics_library 
ON platform_metrics(content_library_id) 
WHERE content_library_id IS NOT NULL;