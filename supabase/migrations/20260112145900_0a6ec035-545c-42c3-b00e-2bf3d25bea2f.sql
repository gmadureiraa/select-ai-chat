-- Fix the INSERT policy to be more restrictive (only service role should insert via trigger)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.social_credentials_audit_log;

-- Create a proper policy that only allows inserts from authenticated users for their own actions
CREATE POLICY "Authenticated users can insert their own audit logs" ON public.social_credentials_audit_log
FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- Also allow the trigger function to insert (since it uses SECURITY DEFINER)
-- The trigger function already runs with elevated privileges