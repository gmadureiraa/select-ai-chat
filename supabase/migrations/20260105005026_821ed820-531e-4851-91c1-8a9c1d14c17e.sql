-- Consolidate conversations: each client should have only ONE main conversation (template_id IS NULL)
-- Step 1: Move messages from duplicate conversations to the canonical one (oldest)

WITH canonical_conversations AS (
  -- Find the canonical (oldest) conversation for each client
  SELECT DISTINCT ON (client_id) 
    id as canonical_id, 
    client_id
  FROM conversations
  WHERE template_id IS NULL
  ORDER BY client_id, created_at ASC
),
duplicate_conversations AS (
  -- Find all duplicate conversations (not the canonical one)
  SELECT c.id as duplicate_id, cc.canonical_id, c.client_id
  FROM conversations c
  JOIN canonical_conversations cc ON c.client_id = cc.client_id
  WHERE c.template_id IS NULL
    AND c.id != cc.canonical_id
)
-- Move messages from duplicates to canonical
UPDATE messages m
SET conversation_id = dc.canonical_id
FROM duplicate_conversations dc
WHERE m.conversation_id = dc.duplicate_id;

-- Step 2: Delete empty duplicate conversations
DELETE FROM conversations c
WHERE c.template_id IS NULL
  AND c.id NOT IN (
    SELECT DISTINCT ON (client_id) id
    FROM conversations
    WHERE template_id IS NULL
    ORDER BY client_id, created_at ASC
  )
  AND NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.conversation_id = c.id
  );

-- Step 3: Create a partial unique index to prevent future duplicates
-- Each client can only have ONE conversation with template_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_conversation_per_client
ON conversations (client_id)
WHERE template_id IS NULL;