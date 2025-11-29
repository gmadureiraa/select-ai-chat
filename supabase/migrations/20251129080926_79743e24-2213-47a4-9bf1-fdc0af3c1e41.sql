-- Habilitar realtime para a tabela messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Adicionar índice para melhorar performance de queries por conversation_id
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
ON public.messages(conversation_id, created_at DESC);

-- Adicionar índice para melhorar performance de queries de conversas por cliente
CREATE INDEX IF NOT EXISTS idx_conversations_client_id_updated_at 
ON public.conversations(client_id, updated_at DESC);

-- Adicionar publicação realtime para messages (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;