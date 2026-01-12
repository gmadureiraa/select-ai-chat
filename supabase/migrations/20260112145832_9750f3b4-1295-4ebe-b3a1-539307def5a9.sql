-- Audit log table for social credentials access
CREATE TABLE IF NOT EXISTS public.social_credentials_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.client_social_credentials(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'use')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_credentials_audit_log ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.social_credentials_audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = client_id
    AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
  )
);

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON public.social_credentials_audit_log
FOR INSERT WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_audit_log_credential_id ON public.social_credentials_audit_log(credential_id);
CREATE INDEX idx_audit_log_client_id ON public.social_credentials_audit_log(client_id);
CREATE INDEX idx_audit_log_created_at ON public.social_credentials_audit_log(created_at DESC);

-- Function to log credential access
CREATE OR REPLACE FUNCTION public.log_credential_access(
  p_credential_id UUID,
  p_client_id UUID,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.social_credentials_audit_log (
    credential_id,
    client_id,
    user_id,
    action,
    metadata
  ) VALUES (
    p_credential_id,
    p_client_id,
    auth.uid(),
    p_action,
    p_metadata
  );
END;
$$;

-- Trigger to automatically log when credentials are accessed through decrypted view
CREATE OR REPLACE FUNCTION public.audit_credential_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_credential_access(
      NEW.id,
      NEW.client_id,
      'create',
      jsonb_build_object('platform', NEW.platform)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_credential_access(
      NEW.id,
      NEW.client_id,
      'update',
      jsonb_build_object(
        'platform', NEW.platform,
        'is_valid_changed', OLD.is_valid IS DISTINCT FROM NEW.is_valid
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_credential_access(
      OLD.id,
      OLD.client_id,
      'delete',
      jsonb_build_object('platform', OLD.platform)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to client_social_credentials
DROP TRIGGER IF EXISTS audit_social_credentials_trigger ON public.client_social_credentials;
CREATE TRIGGER audit_social_credentials_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.client_social_credentials
FOR EACH ROW EXECUTE FUNCTION public.audit_credential_changes();