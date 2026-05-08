-- ─── Radar Viral: expansão de RSS feeds (marketing / IA / cripto BR+EN) ───
-- Adiciona ~25 fontes novas alinhadas ao perfil de conteúdo Kaleidos
-- (70% marketing/strategy, 25% IA/Claude Code, 5% cripto contexto).
--
-- Estratégia: incluir feeds BR primeiro (tradução zero), depois EN
-- (Anthropic, Google AI, MIT, etc). Categorias usadas pelo
-- generate-radar-brief pra filtrar por nicho do cliente.

INSERT INTO public.viral_tracked_sources
  (source_type, source_url, source_name, category, is_active)
SELECT v.source_type, v.source_url, v.source_name, v.category, v.is_active
FROM (VALUES
  -- ─── CRIPTO BR (complementa o que já tem) ─────────────────────────
  ('rss', 'https://livecoins.com.br/feed/',                      'Livecoins',                    'crypto',    true),
  ('rss', 'https://br.cointelegraph.com/rss',                    'Cointelegraph BR',             'crypto',    true),
  ('rss', 'https://exame.com/feed/?post_type=invest&investimento=criptomoedas', 'Exame Cripto', 'crypto', true),
  ('rss', 'https://www.infomoney.com.br/feed/',                  'InfoMoney',                    'crypto',    true),
  ('rss', 'https://valor.globo.com/financas/criptoativos/rss/index.xml', 'Valor Cripto',          'crypto',    true),

  -- ─── CRIPTO EN (complementa Cointelegraph/Decrypt/etc) ────────────
  ('rss', 'https://cryptoslate.com/feed/',                       'CryptoSlate',                  'crypto',    true),
  ('rss', 'https://www.newsbtc.com/feed/',                       'NewsBTC',                      'crypto',    true),
  ('rss', 'https://beincrypto.com/feed/',                        'BeInCrypto',                   'crypto',    true),
  ('rss', 'https://www.coingecko.com/api/news/articles.rss',     'CoinGecko News',               'crypto',    true),

  -- ─── MARKETING BR (BR só tinha refs en — adicionando nacionais) ──
  ('rss', 'https://www.b9.com.br/feed/',                         'B9',                           'marketing', true),
  ('rss', 'https://meioemensagem.com.br/feed/',                  'Meio & Mensagem',              'marketing', true),
  ('rss', 'https://exame.com/feed/?post_type=marketing',         'Exame Marketing',              'marketing', true),
  ('rss', 'https://www.proxxima.com.br/rss',                     'PROXXIMA',                     'marketing', true),

  -- ─── MARKETING EN (Search Engine Journal, MarTech, etc) ──────────
  ('rss', 'https://www.searchenginejournal.com/feed/',           'Search Engine Journal',        'marketing', true),
  ('rss', 'https://martech.org/feed/',                           'MarTech',                      'marketing', true),
  ('rss', 'https://www.adweek.com/feed/',                        'Adweek',                       'marketing', true),
  ('rss', 'https://feeds.feedburner.com/socialmediatoday',       'Social Media Today',           'marketing', true),
  ('rss', 'https://feeds.feedburner.com/CopybloggerComments',    'Copyblogger',                  'marketing', true),

  -- ─── IA EN (Anthropic, OpenAI, Google, MIT) ──────────────────────
  ('rss', 'https://www.anthropic.com/news/rss.xml',              'Anthropic News',               'ai',        true),
  ('rss', 'https://openai.com/blog/rss/',                        'OpenAI Blog',                  'ai',        true),
  ('rss', 'https://blog.google/technology/ai/rss/',              'Google AI Blog',               'ai',        true),
  ('rss', 'https://www.technologyreview.com/feed/',              'MIT Technology Review',        'ai',        true),
  ('rss', 'https://huggingface.co/blog/feed.xml',                'Hugging Face Blog',            'ai',        true),
  ('rss', 'https://aws.amazon.com/blogs/machine-learning/feed/', 'AWS ML Blog',                  'ai',        true),
  ('rss', 'https://www.deepmind.com/blog/rss.xml',               'DeepMind',                     'ai',        true),

  -- ─── IA BR (poucos confiáveis — adicionando o melhor) ────────────
  ('rss', 'https://canaltech.com.br/inteligencia-artificial/rss/', 'Canaltech IA',               'ai',        true),
  ('rss', 'https://olhardigital.com.br/feed/',                   'Olhar Digital',                'ai',        true),

  -- ─── TECH EN (complementa) ───────────────────────────────────────
  ('rss', 'https://www.wired.com/feed/category/business/latest/rss', 'Wired Business',           'tech',      true),
  ('rss', 'https://www.fastcompany.com/feed',                    'Fast Company',                 'tech',      true)
) AS v(source_type, source_url, source_name, category, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.viral_tracked_sources s
  WHERE s.source_url = v.source_url
);

-- Verificação inline (não bloqueia, só log no migration runner)
DO $$
DECLARE
  total int;
  by_cat record;
BEGIN
  SELECT count(*) INTO total FROM public.viral_tracked_sources WHERE is_active = true;
  RAISE NOTICE '[0015] Total RSS active sources: %', total;
  FOR by_cat IN
    SELECT category, count(*) as c
    FROM public.viral_tracked_sources
    WHERE is_active = true AND source_type = 'rss'
    GROUP BY category
    ORDER BY c DESC
  LOOP
    RAISE NOTICE '[0015]   - %: %', by_cat.category, by_cat.c;
  END LOOP;
END $$;
