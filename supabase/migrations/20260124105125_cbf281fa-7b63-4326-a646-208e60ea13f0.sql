-- =============================================
-- kAI Chat Conversations Persistence Tables
-- =============================================

-- Table for kAI chat conversations
CREATE TABLE kai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nova conversa',
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_kai_chat_conversations_user ON kai_chat_conversations(user_id);
CREATE INDEX idx_kai_chat_conversations_client ON kai_chat_conversations(client_id);
CREATE INDEX idx_kai_chat_conversations_updated ON kai_chat_conversations(updated_at DESC);

-- Enable RLS
ALTER TABLE kai_chat_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON kai_chat_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON kai_chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON kai_chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON kai_chat_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Table for kAI chat messages
CREATE TABLE kai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES kai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching messages by conversation
CREATE INDEX idx_kai_chat_messages_conversation ON kai_chat_messages(conversation_id);
CREATE INDEX idx_kai_chat_messages_created ON kai_chat_messages(conversation_id, created_at);

-- Enable RLS
ALTER TABLE kai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can access messages from their own conversations
CREATE POLICY "Users can view own messages" ON kai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kai_chat_conversations c 
      WHERE c.id = kai_chat_messages.conversation_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own messages" ON kai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM kai_chat_conversations c 
      WHERE c.id = kai_chat_messages.conversation_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own messages" ON kai_chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM kai_chat_conversations c 
      WHERE c.id = kai_chat_messages.conversation_id 
      AND c.user_id = auth.uid()
    )
  );

-- Function to update conversation timestamp on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE kai_chat_conversations 
  SET 
    updated_at = NOW(),
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-update conversation timestamp
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON kai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();