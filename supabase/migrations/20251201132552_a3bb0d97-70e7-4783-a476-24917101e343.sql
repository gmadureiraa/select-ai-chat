-- Fix RLS policies for automation_runs
-- Users can only view automation runs for their own automations
DROP POLICY IF EXISTS "Authenticated users can view all automation runs" ON public.automation_runs;
CREATE POLICY "Users can view their own automation runs"
ON public.automation_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automations
    JOIN public.clients ON clients.id = automations.client_id
    WHERE automations.id = automation_runs.automation_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can create automation runs" ON public.automation_runs;
CREATE POLICY "Users can create runs for their automations"
ON public.automation_runs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.automations
    JOIN public.clients ON clients.id = automations.client_id
    WHERE automations.id = automation_runs.automation_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update automation runs" ON public.automation_runs;
CREATE POLICY "Users can update their automation runs"
ON public.automation_runs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automations
    JOIN public.clients ON clients.id = automations.client_id
    WHERE automations.id = automation_runs.automation_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete automation runs" ON public.automation_runs;
CREATE POLICY "Users can delete their automation runs"
ON public.automation_runs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automations
    JOIN public.clients ON clients.id = automations.client_id
    WHERE automations.id = automation_runs.automation_id
    AND clients.user_id = auth.uid()
  )
);

-- Fix RLS policies for automations - require client_id (no global automations)
DROP POLICY IF EXISTS "Users can view automations for their clients" ON public.automations;
CREATE POLICY "Users can view their automations"
ON public.automations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = automations.client_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create automations for their clients" ON public.automations;
CREATE POLICY "Users can create automations"
ON public.automations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = automations.client_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update automations for their clients" ON public.automations;
CREATE POLICY "Users can update their automations"
ON public.automations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = automations.client_id
    AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete automations for their clients" ON public.automations;
CREATE POLICY "Users can delete their automations"
ON public.automations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = automations.client_id
    AND clients.user_id = auth.uid()
  )
);