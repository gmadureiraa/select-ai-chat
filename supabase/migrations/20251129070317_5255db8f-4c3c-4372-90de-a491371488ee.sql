-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (since no auth is needed)
CREATE POLICY "Allow all operations on clients"
ON public.clients FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on client_documents"
ON public.client_documents FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on conversations"
ON public.conversations FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on messages"
ON public.messages FOR ALL
USING (true)
WITH CHECK (true);

-- Replace the function with security definer (no need to drop)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;