-- Adicionar coluna para exponential backoff nos retries
ALTER TABLE planning_items 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Também na tabela legacy
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Índice para performance nas queries de retry
CREATE INDEX IF NOT EXISTS idx_planning_items_next_retry_at ON planning_items(next_retry_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_next_retry_at ON scheduled_posts(next_retry_at) WHERE status = 'scheduled';