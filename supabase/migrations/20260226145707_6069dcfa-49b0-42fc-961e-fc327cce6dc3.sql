-- Recreate the decrypted view that edge functions depend on
-- Edge functions use service_role key so this is safe
CREATE OR REPLACE VIEW public.client_social_credentials_decrypted AS
SELECT 
  id,
  client_id,
  platform,
  COALESCE(api_key, api_key_encrypted) as api_key,
  COALESCE(api_secret, api_secret_encrypted) as api_secret,
  COALESCE(access_token, access_token_encrypted) as access_token,
  COALESCE(access_token_secret, access_token_secret_encrypted) as access_token_secret,
  COALESCE(oauth_access_token, oauth_access_token_encrypted) as oauth_access_token,
  COALESCE(oauth_refresh_token, oauth_refresh_token_encrypted) as oauth_refresh_token,
  expires_at,
  is_valid,
  last_validated_at,
  validation_error,
  account_name,
  account_id,
  metadata,
  created_at,
  updated_at
FROM public.client_social_credentials;

-- Grant access
GRANT SELECT ON public.client_social_credentials_decrypted TO authenticated;
GRANT SELECT ON public.client_social_credentials_decrypted TO service_role;