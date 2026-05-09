-- 0023_metricool_integration.sql
-- Adiciona suporte a Metricool no client_social_credentials.metadata.metricool_blog_id
-- (mesma estratégia que postiz_integration_id — armazenamos no jsonb metadata em vez
-- de coluna dedicada pra evitar schema lock-in).
--
-- Aplicação: idempotente. Roda múltiplas vezes sem efeito colateral.

-- Cria índice GIN no metadata se ainda não existir (acelera queries que filtram
-- por metricool_blog_id ou postiz_integration_id).
CREATE INDEX IF NOT EXISTS idx_client_social_credentials_metadata_gin
  ON client_social_credentials USING GIN (metadata);

-- Cria índice expression específico pra metricool_blog_id (lookup mais rápido).
CREATE INDEX IF NOT EXISTS idx_client_social_credentials_metricool_blog
  ON client_social_credentials ((metadata->>'metricool_blog_id'))
  WHERE metadata->>'metricool_blog_id' IS NOT NULL;

-- Idem pra postiz_integration_id (já usado no postiz-poll, fica explícito).
CREATE INDEX IF NOT EXISTS idx_client_social_credentials_postiz_integration
  ON client_social_credentials ((metadata->>'postiz_integration_id'))
  WHERE metadata->>'postiz_integration_id' IS NOT NULL;

-- Comentários documentais (opcional, ajuda futuros devs)
COMMENT ON COLUMN client_social_credentials.metadata IS
  'jsonb opaco. Chaves conhecidas: postiz_integration_id, postiz_customer_id, metricool_blog_id, metricool_customer_id, late_account_id (legacy), provider (postiz|metricool|late), profile_picture, profile_url, auto_mapped, auto_mapped_at';
