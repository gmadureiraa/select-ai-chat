-- Migration 0004: Seed RSS sources globais + admin write policy
-- Popula viral_tracked_sources com 15 fontes RSS (cripto, marketing, IA, tech)
-- e adiciona policy permitindo super_admin escrever (insert/update/delete).
--
-- Idempotente: ON CONFLICT DO NOTHING + DROP POLICY IF EXISTS.
-- Note: source_url tem NO unique constraint, então usamos WHERE NOT EXISTS pra evitar duplicação.

-- ─── Seed RSS sources globais ──────────────────────────────────────────
-- Categorias prioritárias pro KAI/Kaleidos: cripto, marketing digital, IA, tech.
-- workspace_id e client_id ficam NULL (fontes globais — todos os workspaces leem).
INSERT INTO public.viral_tracked_sources (source_type, source_url, source_name, category, is_active)
SELECT v.source_type, v.source_url, v.source_name, v.category, v.is_active
FROM (VALUES
  ('rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', 'CoinDesk', 'crypto', true),
  ('rss', 'https://cointelegraph.com/rss', 'CoinTelegraph', 'crypto', true),
  ('rss', 'https://decrypt.co/feed', 'Decrypt', 'crypto', true),
  ('rss', 'https://thedefiant.io/feed', 'The Defiant', 'crypto', true),
  ('rss', 'https://www.theblockcrypto.com/rss.xml', 'The Block', 'crypto', true),
  ('rss', 'https://news.bitcoin.com/feed/', 'Bitcoin.com', 'crypto', true),
  ('rss', 'https://www.bankless.com/rss', 'Bankless', 'crypto', true),
  ('rss', 'https://www.marketingbrew.com/feed', 'Marketing Brew', 'marketing', true),
  ('rss', 'https://www.marketingdive.com/feeds/news/', 'Marketing Dive', 'marketing', true),
  ('rss', 'https://contentmarketinginstitute.com/feed/', 'Content Marketing Institute', 'marketing', true),
  ('rss', 'https://blog.hubspot.com/marketing/rss.xml', 'HubSpot Marketing', 'marketing', true),
  ('rss', 'https://venturebeat.com/category/ai/feed/', 'VentureBeat AI', 'ai', true),
  ('rss', 'https://www.theverge.com/rss/index.xml', 'The Verge', 'tech', true),
  ('rss', 'https://techcrunch.com/feed/', 'TechCrunch', 'tech', true),
  ('rss', 'https://feeds.arstechnica.com/arstechnica/index/', 'Ars Technica', 'tech', true)
) AS v(source_type, source_url, source_name, category, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.viral_tracked_sources s
  WHERE s.source_url = v.source_url
);

-- ─── Admin write policy ───────────────────────────────────────────────
-- Permite super_admin INSERT/UPDATE/DELETE. SELECT já é público (policy 0003).
DROP POLICY IF EXISTS "viral_tracked_sources admin write" ON public.viral_tracked_sources;

CREATE POLICY "viral_tracked_sources admin write"
  ON public.viral_tracked_sources
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));
