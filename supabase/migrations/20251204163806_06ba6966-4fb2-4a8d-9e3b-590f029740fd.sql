-- Drop existing permissive INSERT policy on ai_usage_logs
DROP POLICY IF EXISTS "System can insert AI usage logs" ON public.ai_usage_logs;

-- Create restrictive policy for service role only
-- Note: service_role bypasses RLS by default, so this policy effectively blocks all non-service-role inserts
CREATE POLICY "Only service role can insert AI usage logs" ON public.ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- The service_role key bypasses RLS entirely, so edge functions using it can still insert
-- This policy ensures authenticated users (via anon key) cannot insert fake records