-- Create research_projects table
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create research_items table (materials in the canvas)
CREATE TABLE research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('youtube', 'image', 'audio', 'text', 'link', 'pdf')),
  title TEXT,
  content TEXT,
  source_url TEXT,
  file_path TEXT,
  thumbnail_url TEXT,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  width FLOAT DEFAULT 320,
  height FLOAT DEFAULT 240,
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create research_conversations table
CREATE TABLE research_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create research_messages table
CREATE TABLE research_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES research_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for research_projects
CREATE POLICY "Users can view their own projects"
  ON research_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON research_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON research_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON research_projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for research_items
CREATE POLICY "Users can view items from their projects"
  ON research_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_items.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create items in their projects"
  ON research_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_items.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update items in their projects"
  ON research_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_items.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their projects"
  ON research_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_items.project_id
    AND research_projects.user_id = auth.uid()
  ));

-- RLS Policies for research_conversations
CREATE POLICY "Users can view conversations from their projects"
  ON research_conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_conversations.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create conversations in their projects"
  ON research_conversations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_conversations.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update conversations in their projects"
  ON research_conversations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_conversations.project_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete conversations from their projects"
  ON research_conversations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM research_projects
    WHERE research_projects.id = research_conversations.project_id
    AND research_projects.user_id = auth.uid()
  ));

-- RLS Policies for research_messages
CREATE POLICY "Users can view messages from their conversations"
  ON research_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM research_conversations
    JOIN research_projects ON research_projects.id = research_conversations.project_id
    WHERE research_conversations.id = research_messages.conversation_id
    AND research_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages in their conversations"
  ON research_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM research_conversations
    JOIN research_projects ON research_projects.id = research_conversations.project_id
    WHERE research_conversations.id = research_messages.conversation_id
    AND research_projects.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_research_projects_updated_at
  BEFORE UPDATE ON research_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();