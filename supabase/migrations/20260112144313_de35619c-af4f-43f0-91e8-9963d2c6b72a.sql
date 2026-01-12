-- Create private schema if not exists (for storing encryption key)
CREATE SCHEMA IF NOT EXISTS private;

-- Revoke access to private schema from public
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO service_role;

-- Create a table to store the encryption key securely
CREATE TABLE IF NOT EXISTS private.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert encryption key for social tokens
INSERT INTO private.encryption_keys (key_name, key_value)
VALUES ('social_tokens', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key_name) DO NOTHING;

-- Create function to encrypt text using XOR with key (simple but effective for at-rest encryption)
CREATE OR REPLACE FUNCTION public.encrypt_social_token(plain_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
  plain_bytes BYTEA;
  encrypted_bytes BYTEA;
  i INTEGER;
  key_len INTEGER;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  SELECT key_value INTO encryption_key 
  FROM private.encryption_keys 
  WHERE key_name = 'social_tokens';
  
  IF encryption_key IS NULL THEN
    -- If no key exists, just encode as base64 (fallback)
    RETURN encode(convert_to(plain_text, 'UTF8'), 'base64');
  END IF;
  
  -- Convert to bytes
  key_bytes := decode(encryption_key, 'hex');
  plain_bytes := convert_to(plain_text, 'UTF8');
  key_len := length(key_bytes);
  
  -- XOR each byte with key (repeating key)
  encrypted_bytes := ''::bytea;
  FOR i IN 0..length(plain_bytes)-1 LOOP
    encrypted_bytes := encrypted_bytes || 
      set_byte(E'\\x00'::bytea, 0, 
        get_byte(plain_bytes, i) # get_byte(key_bytes, i % key_len)
      );
  END LOOP;
  
  -- Add a marker prefix to identify encrypted data
  RETURN 'enc:' || encode(encrypted_bytes, 'base64');
END;
$$;

-- Create function to decrypt text
CREATE OR REPLACE FUNCTION public.decrypt_social_token(encrypted_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
  encrypted_bytes BYTEA;
  decrypted_bytes BYTEA;
  i INTEGER;
  key_len INTEGER;
  actual_encrypted TEXT;
BEGIN
  IF encrypted_text IS NULL OR encrypted_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Check if this is encrypted data (has our marker)
  IF NOT encrypted_text LIKE 'enc:%' THEN
    -- Not encrypted, return as-is (legacy plaintext data)
    RETURN encrypted_text;
  END IF;
  
  -- Remove the marker prefix
  actual_encrypted := substring(encrypted_text FROM 5);
  
  SELECT key_value INTO encryption_key 
  FROM private.encryption_keys 
  WHERE key_name = 'social_tokens';
  
  IF encryption_key IS NULL THEN
    -- No key, try to decode base64
    RETURN convert_from(decode(actual_encrypted, 'base64'), 'UTF8');
  END IF;
  
  -- Convert from base64
  encrypted_bytes := decode(actual_encrypted, 'base64');
  key_bytes := decode(encryption_key, 'hex');
  key_len := length(key_bytes);
  
  -- XOR each byte with key (same operation as encrypt)
  decrypted_bytes := ''::bytea;
  FOR i IN 0..length(encrypted_bytes)-1 LOOP
    decrypted_bytes := decrypted_bytes || 
      set_byte(E'\\x00'::bytea, 0, 
        get_byte(encrypted_bytes, i) # get_byte(key_bytes, i % key_len)
      );
  END LOOP;
  
  RETURN convert_from(decrypted_bytes, 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Add encrypted columns to client_social_credentials
ALTER TABLE public.client_social_credentials
ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS api_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS access_token_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS oauth_access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted TEXT;

-- Migrate existing plaintext tokens to encrypted columns
UPDATE public.client_social_credentials
SET 
  api_key_encrypted = public.encrypt_social_token(api_key),
  api_secret_encrypted = public.encrypt_social_token(api_secret),
  access_token_encrypted = public.encrypt_social_token(access_token),
  access_token_secret_encrypted = public.encrypt_social_token(access_token_secret),
  oauth_access_token_encrypted = public.encrypt_social_token(oauth_access_token),
  oauth_refresh_token_encrypted = public.encrypt_social_token(oauth_refresh_token)
WHERE (api_key IS NOT NULL AND api_key != '')
   OR (api_secret IS NOT NULL AND api_secret != '')
   OR (access_token IS NOT NULL AND access_token != '')
   OR (access_token_secret IS NOT NULL AND access_token_secret != '')
   OR (oauth_access_token IS NOT NULL AND oauth_access_token != '')
   OR (oauth_refresh_token IS NOT NULL AND oauth_refresh_token != '');

-- Create a view that automatically decrypts tokens for edge functions
CREATE OR REPLACE VIEW public.client_social_credentials_decrypted AS
SELECT 
  id,
  client_id,
  platform,
  public.decrypt_social_token(api_key_encrypted) as api_key,
  public.decrypt_social_token(api_secret_encrypted) as api_secret,
  public.decrypt_social_token(access_token_encrypted) as access_token,
  public.decrypt_social_token(access_token_secret_encrypted) as access_token_secret,
  public.decrypt_social_token(oauth_access_token_encrypted) as oauth_access_token,
  public.decrypt_social_token(oauth_refresh_token_encrypted) as oauth_refresh_token,
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

-- Grant access to the view
GRANT SELECT ON public.client_social_credentials_decrypted TO authenticated;
GRANT SELECT ON public.client_social_credentials_decrypted TO service_role;

-- Create trigger to automatically encrypt tokens on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_social_tokens_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt Twitter tokens
  IF NEW.api_key IS NOT NULL AND NEW.api_key != '' THEN
    NEW.api_key_encrypted := public.encrypt_social_token(NEW.api_key);
    NEW.api_key := NULL;
  END IF;
  
  IF NEW.api_secret IS NOT NULL AND NEW.api_secret != '' THEN
    NEW.api_secret_encrypted := public.encrypt_social_token(NEW.api_secret);
    NEW.api_secret := NULL;
  END IF;
  
  IF NEW.access_token IS NOT NULL AND NEW.access_token != '' THEN
    NEW.access_token_encrypted := public.encrypt_social_token(NEW.access_token);
    NEW.access_token := NULL;
  END IF;
  
  IF NEW.access_token_secret IS NOT NULL AND NEW.access_token_secret != '' THEN
    NEW.access_token_secret_encrypted := public.encrypt_social_token(NEW.access_token_secret);
    NEW.access_token_secret := NULL;
  END IF;
  
  -- Encrypt LinkedIn tokens
  IF NEW.oauth_access_token IS NOT NULL AND NEW.oauth_access_token != '' THEN
    NEW.oauth_access_token_encrypted := public.encrypt_social_token(NEW.oauth_access_token);
    NEW.oauth_access_token := NULL;
  END IF;
  
  IF NEW.oauth_refresh_token IS NOT NULL AND NEW.oauth_refresh_token != '' THEN
    NEW.oauth_refresh_token_encrypted := public.encrypt_social_token(NEW.oauth_refresh_token);
    NEW.oauth_refresh_token := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger for automatic encryption
DROP TRIGGER IF EXISTS encrypt_social_tokens ON public.client_social_credentials;
CREATE TRIGGER encrypt_social_tokens
  BEFORE INSERT OR UPDATE ON public.client_social_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_social_tokens_trigger();

-- Clear existing plaintext tokens (they've been migrated)
UPDATE public.client_social_credentials
SET 
  api_key = NULL,
  api_secret = NULL,
  access_token = NULL,
  access_token_secret = NULL,
  oauth_access_token = NULL,
  oauth_refresh_token = NULL
WHERE api_key_encrypted IS NOT NULL 
   OR api_secret_encrypted IS NOT NULL 
   OR access_token_encrypted IS NOT NULL 
   OR access_token_secret_encrypted IS NOT NULL 
   OR oauth_access_token_encrypted IS NOT NULL 
   OR oauth_refresh_token_encrypted IS NOT NULL;