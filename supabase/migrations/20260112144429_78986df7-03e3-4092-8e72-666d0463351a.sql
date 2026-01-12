-- Fix Function Search Path Mutable warning by setting search_path on mask_email
CREATE OR REPLACE FUNCTION public.mask_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  at_pos INTEGER;
BEGIN
  IF email IS NULL THEN
    RETURN NULL;
  END IF;
  
  at_pos := position('@' in email);
  IF at_pos = 0 THEN
    RETURN email;
  END IF;
  
  local_part := substring(email FROM 1 FOR at_pos - 1);
  domain_part := substring(email FROM at_pos);
  
  -- Show first 2 chars, mask the rest, show domain
  IF length(local_part) <= 2 THEN
    RETURN local_part || '***' || domain_part;
  ELSE
    RETURN substring(local_part FROM 1 FOR 2) || '***' || domain_part;
  END IF;
END;
$$;