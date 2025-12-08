-- Add tags column to global_knowledge table
ALTER TABLE public.global_knowledge 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create performance_goals table for client performance tracking
CREATE TABLE public.performance_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  period TEXT DEFAULT 'monthly',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on performance_goals
ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance_goals
CREATE POLICY "Workspace members can view goals" ON public.performance_goals
  FOR SELECT USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create goals" ON public.performance_goals
  FOR INSERT WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update goals" ON public.performance_goals
  FOR UPDATE USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete goals" ON public.performance_goals
  FOR DELETE USING (client_workspace_can_delete(client_id, auth.uid()));

-- Create favorite_messages table for saving important AI responses
CREATE TABLE public.favorite_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on favorite_messages
ALTER TABLE public.favorite_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for favorite_messages
CREATE POLICY "Users can view their own favorites" ON public.favorite_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites" ON public.favorite_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their favorites" ON public.favorite_messages
  FOR DELETE USING (auth.uid() = user_id);