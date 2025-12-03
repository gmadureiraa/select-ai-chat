-- Table for scheduled posts and drafts
CREATE TABLE public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  publish_results JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own posts" ON public.scheduled_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own posts" ON public.scheduled_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.scheduled_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.scheduled_posts FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_posts_updated_at
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for LinkedIn tokens
CREATE TABLE public.linkedin_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.linkedin_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for linkedin_tokens
CREATE POLICY "Users can view their own tokens" ON public.linkedin_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tokens" ON public.linkedin_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tokens" ON public.linkedin_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tokens" ON public.linkedin_tokens FOR DELETE USING (auth.uid() = user_id);