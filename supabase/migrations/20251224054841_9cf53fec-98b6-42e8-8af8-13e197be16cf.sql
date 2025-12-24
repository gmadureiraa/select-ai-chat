-- Add function to get workspace member token usage for super-admin
CREATE OR REPLACE FUNCTION public.get_workspace_member_tokens_admin(p_workspace_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  tokens_used bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wm.user_id,
    p.email,
    p.full_name,
    COALESCE(SUM(aul.total_tokens), 0)::bigint as tokens_used
  FROM workspace_members wm
  LEFT JOIN profiles p ON p.id = wm.user_id
  LEFT JOIN ai_usage_logs aul ON aul.user_id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  AND is_super_admin(auth.uid())
  GROUP BY wm.user_id, p.email, p.full_name
  ORDER BY tokens_used DESC
$$;