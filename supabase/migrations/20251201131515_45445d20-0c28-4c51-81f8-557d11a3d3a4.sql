-- Add user_id column to clients table to track ownership
ALTER TABLE public.clients ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set user_id for existing clients to the first user in the system
-- This assigns existing data to the current/first user
UPDATE public.clients 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after setting existing data
ALTER TABLE public.clients ALTER COLUMN user_id SET NOT NULL;

-- Set default value for new clients
ALTER TABLE public.clients ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

-- Create new user-specific RLS policies
CREATE POLICY "Users can view their own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = user_id);

-- Update conversations policies to check client ownership
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can delete conversations" ON public.conversations;

CREATE POLICY "Users can view conversations for their clients"
  ON public.conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = conversations.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create conversations for their clients"
  ON public.conversations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = conversations.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update conversations for their clients"
  ON public.conversations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = conversations.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete conversations for their clients"
  ON public.conversations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = conversations.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update messages policies through conversation->client relationship
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can delete messages" ON public.messages;

CREATE POLICY "Users can view messages for their conversations"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.clients ON clients.id = conversations.client_id
    WHERE conversations.id = messages.conversation_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages for their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.clients ON clients.id = conversations.client_id
    WHERE conversations.id = messages.conversation_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update messages for their conversations"
  ON public.messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.clients ON clients.id = conversations.client_id
    WHERE conversations.id = messages.conversation_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages for their conversations"
  ON public.messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    JOIN public.clients ON clients.id = conversations.client_id
    WHERE conversations.id = messages.conversation_id 
    AND clients.user_id = auth.uid()
  ));

-- Update client_documents policies
DROP POLICY IF EXISTS "Authenticated users can view all client documents" ON public.client_documents;
DROP POLICY IF EXISTS "Authenticated users can create client documents" ON public.client_documents;
DROP POLICY IF EXISTS "Authenticated users can update client documents" ON public.client_documents;
DROP POLICY IF EXISTS "Authenticated users can delete client documents" ON public.client_documents;

CREATE POLICY "Users can view documents for their clients"
  ON public.client_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_documents.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create documents for their clients"
  ON public.client_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_documents.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update documents for their clients"
  ON public.client_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_documents.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete documents for their clients"
  ON public.client_documents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_documents.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update client_websites policies
DROP POLICY IF EXISTS "Authenticated users can view all client websites" ON public.client_websites;
DROP POLICY IF EXISTS "Authenticated users can create client websites" ON public.client_websites;
DROP POLICY IF EXISTS "Authenticated users can update client websites" ON public.client_websites;
DROP POLICY IF EXISTS "Authenticated users can delete client websites" ON public.client_websites;

CREATE POLICY "Users can view websites for their clients"
  ON public.client_websites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_websites.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create websites for their clients"
  ON public.client_websites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_websites.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update websites for their clients"
  ON public.client_websites FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_websites.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete websites for their clients"
  ON public.client_websites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_websites.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update client_templates policies
DROP POLICY IF EXISTS "Authenticated users can view client templates" ON public.client_templates;
DROP POLICY IF EXISTS "Authenticated users can create client templates" ON public.client_templates;
DROP POLICY IF EXISTS "Authenticated users can update client templates" ON public.client_templates;
DROP POLICY IF EXISTS "Authenticated users can delete client templates" ON public.client_templates;

CREATE POLICY "Users can view templates for their clients"
  ON public.client_templates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_templates.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create templates for their clients"
  ON public.client_templates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_templates.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update templates for their clients"
  ON public.client_templates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_templates.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete templates for their clients"
  ON public.client_templates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_templates.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update image_generations policies
DROP POLICY IF EXISTS "Authenticated users can view image generations" ON public.image_generations;
DROP POLICY IF EXISTS "Authenticated users can create image generations" ON public.image_generations;
DROP POLICY IF EXISTS "Authenticated users can delete image generations" ON public.image_generations;

CREATE POLICY "Users can view images for their clients"
  ON public.image_generations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = image_generations.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can create images for their clients"
  ON public.image_generations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = image_generations.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete images for their clients"
  ON public.image_generations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = image_generations.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update platform_metrics policies
DROP POLICY IF EXISTS "Authenticated users can view platform metrics" ON public.platform_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert platform metrics" ON public.platform_metrics;
DROP POLICY IF EXISTS "Authenticated users can update platform metrics" ON public.platform_metrics;
DROP POLICY IF EXISTS "Authenticated users can delete platform metrics" ON public.platform_metrics;

CREATE POLICY "Users can view metrics for their clients"
  ON public.platform_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = platform_metrics.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert metrics for their clients"
  ON public.platform_metrics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = platform_metrics.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update metrics for their clients"
  ON public.platform_metrics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = platform_metrics.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete metrics for their clients"
  ON public.platform_metrics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = platform_metrics.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Update automations policies
DROP POLICY IF EXISTS "Authenticated users can view all automations" ON public.automations;
DROP POLICY IF EXISTS "Authenticated users can create automations" ON public.automations;
DROP POLICY IF EXISTS "Authenticated users can update automations" ON public.automations;
DROP POLICY IF EXISTS "Authenticated users can delete automations" ON public.automations;

CREATE POLICY "Users can view automations for their clients"
  ON public.automations FOR SELECT
  USING (
    client_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = automations.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create automations for their clients"
  ON public.automations FOR INSERT
  WITH CHECK (
    client_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = automations.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update automations for their clients"
  ON public.automations FOR UPDATE
  USING (
    client_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = automations.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete automations for their clients"
  ON public.automations FOR DELETE
  USING (
    client_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = automations.client_id 
      AND clients.user_id = auth.uid()
    )
  );