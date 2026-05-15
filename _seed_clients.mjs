import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_USER_ID = '5014248e-b1ac-4306-8490-2644dcd8aeb5';

/**
 * Cada cliente: campos do schema real (clients):
 *   name, description, context_notes, social_media (jsonb), tags (jsonb),
 *   identity_guide, voice_profile (jsonb), content_guidelines, brand_assets (jsonb),
 *   workspace_id, created_by, user_id
 */
const clients = [
  // ============================ DEFIVERSO ============================
  {
    name: 'Defiverso',
    description:
      'Portal e comunidade de educação em DeFi e cripto criada por Lucas Amendola. 14.000+ alunos. Curso completo, salas de guerra, mentorias, eventos (DeFiFest). Ecossistema de educação cripto com fundamento — soberania financeira sem atalhos.',
    context_notes: [
      'Status: ativo (cliente principal Kaleidos).',
      'Criador: Lucas Amendola (@Investidor420 no X / @investidor4.20 no YouTube com 380K).',
      'Posicionamento: educação cripto com fundamento — não shilla projeto, não dá call de altcoin, não promete enriquecimento. Ensina a pensar sobre dinheiro.',
      'Mecanismo único: Lucas + 3 newsletters/sem (terça/sexta/sábado) + Discord ativo + bots + sala de guerra. Densidade técnica + clareza didática.',
      'Ofertas: curso principal 140+ aulas em 4K + Defiverso Prime + Pro Labs (premium com bots e consultorias).',
      'Lead magnet: 7 Dias DeFi (defiverso.com/7-dias-defi).',
      'Ticket curso: R$ 7.739 (com R$ 1.000 OFF Black Friday) parcelado em 12x. Garantia 7 dias.',
      'Cadência editorial fixa: terça (Cripto em Alta) + sexta (Resumo Criptoverso) + sábado (Análise) + diário Instagram + diário Twitter.',
      'KAI client_id legado (Supabase Kaleidos): c1227fa7-f9c4-4f8c-a091-ae250919dc07.',
      'ClickUp: Newsletter list 901111727480 · Instagram list 901111718528 · folder 90116936133.',
      'Skill copywriting: copywriting-defiverso v1.0 (regras duras: zero travessão, zero "Simples assim.", dado numérico em todo bloco, fonte com link direto, assinatura "Dormiu, acordou, coletou. 4.20 Lucas 👽").',
    ].join('\n'),
    social_media: {
      site: 'https://defiverso.com',
      instagram: '@defiverso',
      twitter: '@Investidor420',
      youtube: '@investidor4.20',
      newsletter: 'Beehiiv (terça + sexta + sábado)',
      discord: 'comunidade fechada (alunos Prime)',
    },
    tags: {
      list: [
        'cripto',
        'defi',
        'educacao',
        'newsletter',
        'youtube',
        'instagram',
        'lucas-amendola',
        'defiverso-prime',
      ],
    },
    identity_guide: [
      '# Defiverso — Identity Guide',
      '',
      '**Audiência:** investidores cripto BR de nível médio (R$ 50k+ em cripto, sério mas sem tempo). Funil orgânico: conteúdo educativo → newsletter → curso/mentoria.',
      '',
      '**Promessa central:** acelerar a jornada rumo à liberdade financeira com conteúdo, comunidade e execução. Soberania financeira sem atalhos.',
      '',
      '**Mecanismo único:** Lucas + 3 newsletters/sem + Discord ativo + bots + sala de guerra.',
      '',
      '**Pilares (distribuição fixa):**',
      '- 35% Bitcoin e fundamento monetário (história do dinheiro, ciclos, soberania, sistema monetário)',
      '- 25% Educação cripto prática (como começar, análise de projetos, método, erros comuns)',
      '- 20% Visão de futuro e macro (Drex, regulação, stablecoins, economia global)',
      '- 10% Bastidores e lifestyle (DeFiFest, jornada empreendedora)',
      '- 10% Liberdade financeira (mentalidade, independência, patrimônio de longo prazo)',
      '',
      '**Não-negociáveis:**',
      '- Nunca usar "Simples assim." como fechamento',
      '- Nunca usar travessão (—) no corpo do texto',
      '- Toda história precisa terminar com Fonte: [Veículo](URL)',
      '- Mesclar parágrafos com bullets em cada história',
      '- Densidade: cada história com pelo menos um dado numérico concreto',
      '- Voz direta, analítica, sem jargão. PT-BR. Frases curtas.',
    ].join('\n'),
    voice_profile: {
      tone: 'direta, analítica, didática, sem jargão',
      language: 'pt-BR',
      style: 'frases curtas, parágrafos com bullets, densidade numérica obrigatória',
      forbidden_phrases: ['Simples assim.', '—'],
      signature: 'Dormiu, acordou, coletou. 4.20 Lucas 👽',
      personality: ['analítico', 'didático', 'crítico', 'sem hype'],
    },
    content_guidelines: [
      'Cada peça deve cruzar 3+ fontes obrigatórias (Gmail newsletters Bankless/Defiant/Blockworks/The Block + WebSearch + canais Lucas).',
      'Newsletter sexta (Resumo Criptoverso) tem 6-9 histórias H2 + 8-10 bullets em "Outras novidades" + bloco "Conteúdos da semana".',
      'Newsletter terça (Cripto em Alta) baseada no vídeo Lucas de segunda 17h. 800-1500 palavras, 3-5 tópicos.',
      'Newsletter sábado (Análise) deep dive em token/tema. Cruzar 1 newsletter gringa + 1 research firm + 1 dado on-chain. Estrutura: O que é → Por que importa agora → Os números → 3 cenários (bull/base/bear) → "O que eu (Lucas) faria".',
      'Carrosséis Instagram: 8-12 slides, repurpose das newsletters.',
      'Tweets: 5/dia, 280 chars cada, sem hashtag.',
    ].join('\n'),
    brand_assets: {
      colors: {
        primary: '#00ff9d',
        secondary: '#00cc7a',
        background_dark: '#031919',
        black: '#000000',
        white: '#ffffff',
      },
      typography: {
        body: 'Inter',
      },
    },
  },

  // ============================ LUCAS AMENDOLA (marca pessoal) ============================
  {
    name: 'Lucas Amendola',
    description:
      'Marca pessoal de Lucas Amendola, educador de cripto mais influente do Brasil. Fundador do Defiverso (14.000+ alunos), criador do DeFiFest, referência em soberania financeira. Ensina a pensar sobre dinheiro, não a seguir calls. ⚠️ Marca pessoal Lucas ≠ Defiverso (produto/comunidade) — conteúdo de comunidade/newsletter/mentoria fica no cliente Defiverso.',
    context_notes: [
      'Status: ativo (cliente Kaleidos — canais pessoais Lucas).',
      'Posicionamento: educação cripto com fundamento. Soberania financeira sem atalhos. Anti-guru, anti-coach, anti-call de altcoin. Bitcoin-only em conteúdo público.',
      'Audiência primária: investidores cripto BR iniciantes (25-45, classe B-C), buscando alternativa à enxurrada de calls de altcoin.',
      'Mecanismo único: discorda publicamente quando algo é tecnicamente errado. Lucas como pessoa (não como produto Defiverso).',
      'Funil: conteúdo educativo no canal pessoal Lucas → brand awareness + autoridade → CTA sutil "quem quer ir fundo, entra no Defiverso" → Defiverso converte (newsletter → curso → mentoria). Lucas NÃO faz venda direta no canal pessoal.',
      'Handles: Instagram @lucas.amendolaa (174K, base da comunidade) · Twitter @Investidor420 (meta 50K+) · LinkedIn em ramp-up (meta 25K dez/2026) · YouTube @investidor4.20 (380K, gerenciado pela equipe Lucas, fora escopo Kaleidos).',
      'Skill compartilhada: copywriting-defiverso v1.0 (Lucas é a voz do Defiverso, mesma skill aplica com ajustes finos pra canal pessoal).',
      'Decisão pendente: criar copywriting-lucas-amendola próprio depois de 4 semanas testando.',
      'Séries recorrentes: "Bitcoin Importa" (Reel IG seg) · "Macro em 60s" (Reel IG qua) · "Lições de 4 Anos" (IG+LI quinzenal) · "O que Seu CFO Precisa Saber" (LI quinzenal) · "Bastidores do Builder" (Reel IG + LI mensal).',
      '7 specs Camada 2 mapeados em vault/format-standards/clients/lucas-amendola/: ig-reels-9x16, ig-carrossel-1080x1350, ig-story-1080x1920, x-single, x-thread, linkedin-post (piloto), linkedin-carrossel (piloto).',
    ].join('\n'),
    social_media: {
      instagram: '@lucas.amendolaa',
      twitter: '@Investidor420',
      linkedin: 'Lucas Amendola',
      youtube: '@investidor4.20',
      youtube_note: 'gerenciado pela equipe Lucas, fora escopo Kaleidos/KAI',
      defiverso_site: 'https://defiverso.com',
    },
    tags: {
      list: [
        'marca-pessoal',
        'cripto',
        'bitcoin',
        'educacao',
        'lucas-amendola',
        'defiverso',
        'soberania-financeira',
        'instagram',
        'twitter',
        'linkedin',
      ],
    },
    identity_guide: [
      '# Lucas Amendola — Identity Guide',
      '',
      '**Quem é:** Lucas Amendola, educador de cripto mais influente do Brasil. Fundador do Defiverso. Marca pessoal distinta do produto Defiverso.',
      '',
      '**Posicionamento:** Educação cripto com fundamento. Soberania financeira sem atalhos.',
      '',
      '**Audiência primária:** investidores cripto BR iniciantes (25-45, classe B-C), buscando alternativa à enxurrada de calls de altcoin.',
      '',
      '**Pilares (35/25/20/10/10):**',
      '- 35% Bitcoin e fundamento monetário (história do dinheiro, ciclos, soberania, sistema monetário)',
      '- 25% Educação cripto prática (como começar, análise de projetos, método, erros comuns)',
      '- 20% Visão de futuro e macro (Drex, regulação, economia global, stablecoins, tendências)',
      '- 10% Bastidores e lifestyle (jornada empreendedora, DeFiFest, vida de educador)',
      '- 10% Liberdade financeira (mentalidade, independência, patrimônio de longo prazo)',
      '',
      '**Séries recorrentes:**',
      '- "Bitcoin Importa" — Reel IG semanal (segunda)',
      '- "Macro em 60s" — Reel IG semanal (quarta)',
      '- "Lições de 4 Anos" — Post IG + LinkedIn (quinzenal)',
      '- "O que Seu CFO Precisa Saber" — LinkedIn (quinzenal)',
      '- "Bastidores do Builder" — Reel IG + Post LinkedIn (mensal)',
      '',
      '**Tom:** direto, analítico, didático. Pode discordar publicamente quando algo for tecnicamente errado. Mais opinião e mais "eu" do que o Defiverso institucional.',
      '',
      '**Não-negociáveis:**',
      '- Bitcoin-only em conteúdo público (zero altcoin shilling)',
      '- Sem hashtag em LinkedIn',
      '- Sem travessão (—) no corpo do texto',
      '- Toda história precisa terminar com Fonte: [Veículo](URL) quando aplicável',
      '- Densidade: dado numérico concreto em pelo menos um parágrafo',
      '- CTA sutil pra Defiverso, nunca venda direta',
    ].join('\n'),
    voice_profile: {
      tone: 'direto, analítico, didático, opinião forte com argumento',
      language: 'pt-BR',
      style: 'frases curtas, primeira pessoa, bastidor real, discorda publicamente quando preciso',
      forbidden_phrases: ['Simples assim.', '—'],
      forbidden_topics: ['altcoin shilling', 'call de investimento', 'promessa de retorno', 'venda direta no canal pessoal'],
      personality: ['analítico', 'didático', 'crítico', 'anti-hype', 'opinião com argumento'],
    },
    content_guidelines: [
      'Reels IG (2-3x/semana, opinativos + séries).',
      'Carrossel IG (1x/semana, terça educativo).',
      'Stories IG (5-7x/semana, diário).',
      'X single (3-5x/dia).',
      'X thread (1x/semana).',
      'LinkedIn post piloto (meta 3-4x/semana, em ramp-up).',
      'LinkedIn carrossel quinzenal (série "O que Seu CFO Precisa Saber").',
      'Compartilha skill copywriting-defiverso v1.0 — Lucas é a voz do Defiverso, mesma skill aplica com ajustes pra canal pessoal (mais opinião, mais "eu", mais bastidor).',
      'Specs Camada 2 oficiais: vault/99 - SISTEMA/format-standards/clients/lucas-amendola/*.md (7 specs ativos).',
    ].join('\n'),
    brand_assets: {
      colors: {
        // Lucas marca pessoal — sem paleta oficial validada ainda. Direção: alinhado a Defiverso (#00ff9d / #031919) mas com identidade pessoal a definir.
        note: 'Paleta oficial Lucas marca pessoal a validar. Hoje compartilha visual com Defiverso (verde neon + dark) mas identidade pessoal pode pivotar.',
      },
      typography: {
        direction: 'a definir — alinhada inicialmente com Defiverso (Inter)',
      },
    },
  },

  // ============================ KALEIDOS (marca própria) ============================
  {
    name: 'Kaleidos',
    description:
      'Agência de marketing digital especializada em cripto/web3/fintech. Fundada por Gabriel Madureira. Time de ~5 pessoas. ~3 anos de operação. Voz institucional ("a Kaleidos", "nosso time") distinta da voz pessoal de Gabriel Madureira.',
    context_notes: [
      'Status: cliente interno (a própria agência como marca).',
      'Posicionamento sugerido (NÃO validado oficialmente): "A agência de marketing nativa do mercado cripto brasileiro." Bloqueado em P0 da skill copywriting-kaleidos — falta entrevista Gabriel.',
      'Audiência: decisores B2B (CMOs, founders, heads de growth) de exchanges, fintechs, projetos cripto/web3 BR e globais. Ticket alvo: R$ 10-50k/mês de retainer + projetos pontuais.',
      'Portfólio blue-chip: Crypto.com, Mercado Bitcoin, Ledger, Parfin, Defiverso, Bit das Minas, Paradigma Education.',
      'Cases âncora (números públicos): Defiverso 29K inscritos + 12M views em 90 dias; Bit das Minas +200% faturamento; 150+ vídeos produzidos; 50+ lançamentos; 98% satisfação.',
      'Problema-âncora: ~80% do awareness depende da audiência pessoal de Gabriel. Frente existe pra construir voz institucional como ativo independente.',
      'Skill copywriting-kaleidos v1.0 (651 linhas, 8 GAPS marcados, 3 P0 abertos: brand voice formal escrita, manifesto, política tom em situações sensíveis).',
      'Scheduled task kaleidos-conteudo-mensal abortou em 2026-05-01 por causa dos 3 P0. Re-rodar prevista 2026-06-01.',
      'Marketing Audit (2026-03-11): score 56/100, projeção R$ 25-80k/mês de receita adicional em 12 meses.',
      'Plano Growth Q2 2026 estruturado em 5 pilares: LinkedIn Gabriel / X Gabriel EN / Outbound / CRM ClickUp / SEO+Blog.',
    ].join('\n'),
    social_media: {
      site: 'https://kaleidos.com.br',
      linkedin: 'linkedin.com/company/kaleidos',
      instagram: '@kaleidos.agencia',
      newsletter: 'Kaleidos Dispatch (planejada, não lançada)',
      blog: 'kaleidos.com.br/blog (não publicado — bloqueio SEO 28/100)',
    },
    tags: {
      list: [
        'agencia',
        'marketing-digital',
        'cripto',
        'web3',
        'fintech',
        'b2b',
        'institucional',
        'kaleidos-marca',
      ],
    },
    identity_guide: [
      '# Kaleidos (marca da agência) — Identity Guide',
      '',
      '**Voz:** 3ª pessoa institucional ("a Kaleidos") + 1ª pessoa do plural ("nosso time"). Distinta da voz Madureira pessoa.',
      '',
      '**Idiomas:** PT-BR (principal) + EN (planejado pra mercado global cripto).',
      '',
      '**Pilares (40/25/20/15 — não validado oficialmente):**',
      '- 40% Estratégia de marketing para cripto (frameworks, metodologias, análises BR)',
      '- 25% Cases e resultados (dados reais com permissão)',
      '- 20% Bastidores e processo da agência',
      '- 15% Tendências do mercado com análise crítica',
      '',
      '**Tópicos PROIBIDOS:** análise de preço, calls de investimento, hype de projeto sem fundamento, conselho financeiro, "10 dicas" genérico.',
      '',
      '**Frame de oposição:** "Não somos Pmweb (data-driven), não somos Tátil (branding clássico). Somos Kaleidos — agência cripto-fluente, founder-led, comunidade-first."',
      '',
      '**Posicionamento blue-chip:** Crypto.com, Mercado Bitcoin, Ledger, Parfin, Defiverso, Bit das Minas, Paradigma Education.',
    ].join('\n'),
    voice_profile: {
      tone: 'autoridade institucional sem condescendência, cripto-fluente, founder-led',
      language: 'pt-BR + en (planejado)',
      person: '3ª pessoa institucional ("a Kaleidos") + 1ª plural ("nosso time")',
      forbidden_words: [
        'potencializar',
        'ecossistema',
        'DNA',
        'sinergia',
        'disruptivo',
        '—',
      ],
      style: 'voz institucional, distinta da voz pessoal Madureira',
      personality: ['cripto-fluente', 'founder-led', 'comunidade-first'],
    },
    content_guidelines: [
      'Case study (1.200-2.500 palavras): Backend Kaleidos (MCP) + briefing original do cliente + aprovação formal antes de publicar números nominais.',
      'Blog/Newsletter: cruzar 3+ fontes (HubSpot/Webflow/Anthropic Blog + dados próprios + mídia cripto BR + reguladores).',
      'Hot take: 3+ casos no portfólio sustentam a tese + 1 dado de mercado externo.',
      'Densidade numérica obrigatória nas primeiras 100 palavras.',
      'Hook nos 3 testes da skill copywriting-kaleidos.',
      '5 formatos canônicos: case-study | linkedin | carrossel | newsletter | blog.',
      'Para peças com cliente nominal: validação obrigatória do cliente antes de publicar.',
    ].join('\n'),
    brand_assets: {
      colors: {
        // brand visual placeholder — não há paleta oficial validada (P0 da skill)
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#7C3AED',
      },
      note: 'Paleta oficial não validada. Bloqueado em P0 da skill copywriting-kaleidos (brand voice + manifesto + tom situações sensíveis).',
    },
  },

  // ============================ MADUREIRA (UPDATE — já existe) ============================
  {
    name: 'Madureira',
    description:
      'Marca pessoal de Gabriel Madureira, founder da Kaleidos (agência de marketing digital pra cripto/web3) e builder de produtos próprios. Insider do mercado cripto que entende marketing de verdade — não é influencer de cripto, é estrategista que usa cripto como contexto.',
    context_notes: [
      'Status: ativo (cliente interno Kaleidos — sem faturamento, alimenta pipeline da agência).',
      'Mecanismo único: bastidor real Kaleidos + agentes Claude Code aplicados ao trabalho diário + 36 produtos em construção como laboratório vivo.',
      'Handle migrado de @madureira0x → @ogmadureira em 2026-04-29.',
      'Cadência: Instagram 6 feed/sem + 5 reels-03/sem · Twitter 3-5 tweets/dia + 1-2 thread/sem · LinkedIn 3 posts/sem (seg/qua/sex) · Threads espelha Instagram.',
      'KAI client_id legado: c3fdf44d-1eb5-49f0-aa91-a030642b5396.',
      'ClickUp: LinkedIn list 901111718549 · Twitter list 901111718551.',
      'Sub-agentes: client-madureira (genérico) + agente-madureira-linkedin + agente-madureira-twitter.',
      'Skill copywriting-madureira v1.2 (~420 linhas) com diagnóstico crítico (28 carrosséis reprovados em 30, scheduled tasks pausadas).',
      'Padrão CTA ManyChat consolidado desde 2026-04-29: punchline + caixa highlight com palavra-chave + subtexto "automação rola sozinha" + rodapé discreto. NUNCA nome em tipografia gigante.',
      'Produtos próprios em construção mencionáveis: Kaleidos, Sequência Viral, Reels Viral, KAI, AutoBlogger, AdFlow.',
    ].join('\n'),
    social_media: {
      instagram: '@ogmadureira',
      twitter: '@ogmadureira',
      linkedin: 'Gabriel Madureira',
      threads: '@ogmadureira',
      site: 'madureira.cc',
      link_in_bio: 'mad.link / madureira.kaleidos.com.br',
    },
    tags: {
      list: [
        'marca-pessoal',
        'marketing-digital',
        'ia-aplicada',
        'automacao',
        'growth',
        'founder',
        'kaleidos',
        'gabriel-madureira',
      ],
    },
    identity_guide: [
      '# Madureira — Identity Guide',
      '',
      '**Quem é:** Gabriel Madureira. Founder de agência + builder. NÃO é influencer de cripto. Estrategista que usa cripto como contexto.',
      '',
      '**Posicionamento:** Founder de agência + builder de IA aplicada que mostra bastidor real, números reais e processos reais.',
      '',
      '**Audiência primária:** founders, builders, profissionais de marketing/IA que querem ver como se opera uma agência por dentro.',
      '',
      '**Mix editorial 70/25/5:**',
      '- 70% Marketing / strategy / growth (bastidores Kaleidos, lançamentos, processos, números reais, hot takes)',
      '- 25% IA / Claude Code / automação (stack de agentes, sistemas de trabalho, MCPs, workflows)',
      '- 5% Cripto como contexto (cases de projetos cripto, NUNCA análise de preço)',
      '',
      '**Linhas editoriais Instagram (8 eixos):** LE-01 Bastidores Kaleidos · LE-02 Marketing que Funciona · LE-03 Hot Takes · LE-04 Como Uso IA · LE-05 Números Reais · LE-06 Stack & Sistema · LE-07 Provocação · LE-08 Cripto contexto.',
      '',
      '**Tom:** informal, direto, "gente como a gente". Pode usar palavrão leve. Pode ser polêmico com argumento. CAPS em 1-2 frases por texto.',
      '',
      '**Não-negociáveis:**',
      '- Sem hashtags em nenhum canal',
      '- Sem travessão (—) no corpo do texto',
      '- Sem gerundismo',
      '- Sem fechamento com "Simples assim."',
      '- Sempre 1 dado numérico concreto por peça',
      '- Sempre referência real (projeto, cliente, screenshot)',
    ].join('\n'),
    voice_profile: {
      tone: 'informal, direto, sharp, opinionated',
      language: 'pt-BR (100%)',
      style: 'bastidor real, números reais, processos reais, exemplos concretos',
      forbidden_phrases: ['Simples assim.', '—'],
      forbidden_topics: ['notícias de cripto', 'análise de preço', 'calls de altcoin'],
      personality: ['founder', 'builder', 'crítico', 'polêmico com argumento'],
    },
    content_guidelines: [
      'Reels (4 formatos): Leia a Legenda · Talking Head · Rosto Mudo Lista · Renato Duran passo-a-passo.',
      'Carrosséis (8 formatos canônicos + 1 extra): cream-serif-list, tweet-card, pov-paper-grain, win95-skeu, editorial-newsletter, hot-take-1slide, bell-curve-meme, pergaminho-verde + carrosseis-04-renato-passo-a-passo.',
      'Padrão CTA ManyChat: 1) Punchline curta · 2) Caixa highlight com palavra-chave ManyChat · 3) Subtexto "automação rola sozinha — sem cobrança, sem spam" · 4) Rodapé discreto com avatar pequeno + @ogmadureira.',
      'NUNCA usar nome em tipografia gigante.',
      'Validação obrigatória pelo Gabriel antes de publicar.',
      'Refs trackeadas: 24 perfis em _REFS-TRANSCRICAO/por-owner com transcrição completa.',
    ].join('\n'),
    brand_assets: {
      colors: {
        primary: '#0D4D3D',
        secondary: '#2D7A5F',
        accent: '#10B981',
        white: '#FFFFFF',
      },
      visual_dna: 'Greenprint — DNA visual proprietário (verde escuro + médio + vibrante)',
    },
  },

  // ============================ JORNAL CRIPTO ============================
  {
    name: 'Jornal Cripto',
    description:
      'Portal de notícias e análises sobre criptomoedas. Foco em conteúdo atualizado, blog, newsletter (Crypto Today diária às 7h) e ferramenta Radar para monitoramento de mercado. Educa e informa investidores no ecossistema cripto brasileiro.',
    context_notes: [
      'Status: ativo (projeto pessoal de Gabriel Madureira ligado à Kaleidos).',
      'Stack: site Vite + React, automação n8n para 6 blog posts/dia, newsletter manual estruturada 2x/semana.',
      'Personagem desenvolvido para identidade da marca.',
      'Newsletter diária Crypto Today às 7h.',
      'Ebooks produzidos: 3 (revisão e design pela Kaleidos).',
      'Tráfego pago: gestão de campanhas pela Kaleidos impulsionou audiência significativamente.',
      'Webapp Radar para insights em tempo real.',
      'Cores oficiais: Preto + Branco + Laranja Bitcoin (#F7931A).',
    ].join('\n'),
    social_media: {
      site: 'https://jornalcripto.com.br',
      site_alt: 'https://jornalcripto.com',
      newsletter: 'https://news.jornalcripto.com',
      radar: 'https://radar.jornalcripto.com',
    },
    tags: {
      list: [
        'cripto',
        'noticias',
        'newsletter',
        'blog',
        'radar',
        'jornalismo-cripto',
        'projeto-pessoal',
        'n8n-automation',
      ],
    },
    identity_guide: [
      '# Jornal Cripto — Identity Guide',
      '',
      '**Tipo:** portal de notícias e análises sobre criptomoedas.',
      '',
      '**Audiência:** investidores e interessados em criptomoedas no Brasil. Iniciantes a intermediários querendo conteúdo atualizado e didático.',
      '',
      '**Promessa:** educar e informar investidores no ecossistema cripto brasileiro com conteúdo atualizado, didático e ferramentas (Radar) para acompanhar mercado em tempo real.',
      '',
      '**Diferencial:** newsletter diária Crypto Today às 7h + 6 blog posts/dia automatizados via n8n + Radar para insights em tempo real + tráfego pago para escala.',
      '',
      '**Tom:** jornalístico, didático, atualizado. Não é hype, não é call de altcoin.',
    ].join('\n'),
    voice_profile: {
      tone: 'jornalístico, didático, informativo',
      language: 'pt-BR',
      style: 'notícia + análise + contexto educacional',
      personality: ['atualizado', 'didático', 'isento'],
    },
    content_guidelines: [
      'Newsletter diária Crypto Today às 7h — manual estruturada.',
      'Newsletter semanal: 2x/semana manual estruturada.',
      'Blog: 6 posts/dia via automação n8n (revisão humana antes de publicar).',
      'Personagem da marca usado em comunicação visual e branding.',
      'Foco em notícias relevantes pro investidor BR (regulação, mercado, projetos com tração).',
      'Radar é ativo de retenção: insights em tempo real.',
    ].join('\n'),
    brand_assets: {
      colors: {
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#F7931A',
      },
      note: 'Cores oficiais: Preto + Branco + Laranja Bitcoin.',
    },
  },

  // ============================ HUGO DORIA ============================
  {
    name: 'Hugo Doria',
    description:
      'Criador de conteúdo focado em IA prática, vibe coding e ferramentas tech para o público brasileiro. "Fireship brasileiro de IA + vibe coding". Builder pragmático que mostra demo na tela, declara limitação real e ensina aplicação no dia seguinte.',
    context_notes: [
      'Status: ativo.',
      'Posicionamento interno: "Fireship brasileiro de IA + vibe coding".',
      'Cadência: YouTube 6 vídeos/mês (8-15min, terça/quinta) · Instagram 12 reels/mês (30-60s, seg/qua/sex).',
      'LinkedIn esporádico. Twitter/X ainda não estruturado (gap a fechar).',
      '⚠️ Status de calibração: pastas 02-CONTEUDO/ e 03-ROTEIROS/ vazias. Skill escrita a partir de diretrizes, sem amostra publicada real. PRIMEIRO: rodar youtube-transcript em 3-5 vídeos publicados.',
      'Skill copywriting-hugo v1.0 (727 linhas, 12 seções, 25-item checklist).',
      'KAI client_id: não mapeado ainda.',
      'ClickUp lists: não documentadas (gap aberto).',
    ].join('\n'),
    social_media: {
      youtube: 'Hugo Doria (vídeos 8-15 min, 6/mês)',
      instagram: 'Hugo Doria (reels 30-60s, 12/mês)',
      linkedin: 'Hugo Doria (esporádico)',
      twitter: 'gap — não estruturado',
    },
    tags: {
      list: [
        'criador-conteudo',
        'ia-pratica',
        'vibe-coding',
        'youtube',
        'instagram',
        'fireship-br',
        'devs-aspirantes',
      ],
    },
    identity_guide: [
      '# Hugo Doria — Identity Guide',
      '',
      '**Audiência primária (70%):** devs e aspirantes a dev (20-35, BR, classe B-C, querem aplicar IA pra construir mais rápido).',
      '**Audiência secundária (20%):** empreendedores digitais (28-45, querem automação e ROI, não precisam ser dev).',
      '**Audiência leads (10%):** futuros compradores de curso/comunidade/coaching.',
      '',
      '**Pilares (oficial — skill copywriting-hugo):**',
      '- 40% IA Prática (reviews honestos, tutoriais Claude/Cursor/v0/Replit/Bolt/Lovable/Windsurf/Perplexity/MCP)',
      '- 30% Vibe Coding (build-alongs com IA, "fiz X em Y minutos", limites do approach)',
      '- 20% Tutoriais How-To (automações, setup, integração APIs, produtividade dev)',
      '- 10% Opinião / Tendência (hot takes sobre futuro de dev com IA)',
      '',
      '**Tom:** acessível, entusiasmado mas não exagerado. Prático — sempre mostra na tela, demo real. Explica para quem não é técnico.',
      '',
      '**Referências/inspiração:** Fireship, Theo (t3.gg), Matt Wolfe, AI Jason, Lucas Montano (BR), Filipe Deschamps (BR).',
      '',
      '**Posicionamento livre identificado:** "solo-builder BR que constrói com IA, mostra revenue real, ensina hands-on" — combinação Levels + Deschamps em PT-BR. Opção de pivotar pra "AI Builder" / "Solo Coder com IA" (tag "vibe coding" sendo capturada por Arreche).',
    ].join('\n'),
    voice_profile: {
      tone: 'acessível, entusiasmado mas não exagerado, prático',
      language: 'pt-BR coloquial',
      style: 'demo na tela + limitação real + aplicação no dia seguinte',
      forbidden_words: [
        'incrível',
        'game-changer',
        'simplesmente',
        'você sabia que',
        'hoje vou',
        'e aí pessoal',
      ],
      personality: ['builder pragmático', 'entusiasmado', 'didático'],
    },
    content_guidelines: [
      'Hook nos 4 testes da skill copywriting-hugo antes de produzir.',
      'Estrutura YouTube e Reel canônica (definida em SKILL §4).',
      'Regra demo+limitação: sempre mostrar funcionando + sempre declarar onde quebra.',
      'Checklist de 25 itens da SKILL §8 antes de entregar.',
      'Pesquisa: cruzar 3+ fontes (docs oficiais Anthropic/OpenAI/Cursor + GitHub repo/release notes + comunidade r/ClaudeAI/r/cursor/HN/PH + ref tonal).',
      'Antes de produzir primeiro lote: rodar youtube-transcript em 3-5 vídeos publicados pra calibrar tom verbal real.',
    ].join('\n'),
    brand_assets: {
      colors: {
        primary: '#0A86FF',
        secondary: '#10B981',
        accent: '#F59E0B',
        dark: '#0F172A',
        light: '#F8FAFC',
        text: '#E2E8F0',
      },
      typography: {
        primary: 'Inter, sans-serif',
      },
    },
  },

  // ============================ DSEC LABS ============================
  {
    name: 'DSEC Labs',
    description:
      'Holding brasileira de segurança Bitcoin (set/2024). Não é exchange, não é fintech. É educadora + fabricante de hardware open-source (COLDKIT, Krux) + facilitadora de trade P2P sem KYC (Alfred P2P). Slogan: "No Trust. Do It Yourself (DIY)."',
    context_notes: [
      'Status: ativo (contrato R$ 3.800/mês — Abr-Jul 2026, 4 meses, renovável).',
      'CNPJ: 57.308.970/0001-76.',
      'CEO/Fundador: Leonardo Maximiliano Martins (alfredp2p@gmail.com). BTC maximalist, foco em impacto social do Bitcoin. São Paulo.',
      'Time: Giovanni Dittrich (Co-founder & CPO), Vinicius Brito (Time DIY), Rodrigo Lage (Design/Inovação).',
      'Posicionamento: ponte entre tecnologia Bitcoin complexa e usuários não-técnicos. Anti-intermediário, anti-custódia, pró-soberania individual. Bitcoin-only (zero altcoin).',
      'Produtos: COLDKIT (kit hardware wallet 100% air-gapped, sem Wi-Fi/BT/NFC, roda Krux) · COLDKIT X (com bateria) · Krux (firmware open-source) · Alfred P2P (P2P sem KYC, BR/EU/PY/AR/AU, 4,99% taxa, 187+ traders) · D-Academy (educação Bitcoin).',
      'Audiência: Bitcoiners BR (iniciante → intermediário → avançado). Makers/hackers DIY. Privacy-focused. Libertarians. Brasileiros sentindo crise econômica.',
      'KAI client_id: bd641f19-2524-4128-9a9c-a1d2eb679c67.',
      'Newsletter: RD Station.',
      'Branding: "Powered by D-Sec" (co-branding).',
      'Skill copywriting-dsec v1.0 (691 linhas) com 2 vozes: DSEC institucional PT-BR (LinkedIn/blog/newsletter) + Alfred Reply Guy EN (Twitter @alfredp2p).',
      '⚠️ Decisão 2026-05-04: Alfred é PT-BR em tudo (não EN). Twitter @alfredp2p PT-BR lowercase, LI/Blog/News PT-BR normal.',
      '⚠️ ColdKit — não inventar preço/URL/cupom. Aguardar Leonardo passar dados reais.',
    ].join('\n'),
    social_media: {
      site: 'https://dseclab.io',
      shop: 'https://shop.dseclab.io',
      instagram: '@dseclab.io (15K, não gerido pela Kaleidos)',
      instagram_alfred: '@alfredp2p',
      twitter_dsec: '@diyseclab',
      twitter_alfred: '@alfredp2p (Kaleidos opera: 1/dia + thread/quarta + reply guy)',
      youtube: '@dseclabs (675 subs, 53 vídeos)',
      linkedin: 'linkedin.com/company/dseclabs (Kaleidos opera: 2 posts/semana)',
      newsletter: 'RD Station',
    },
    tags: {
      list: [
        'bitcoin',
        'segurança',
        'self-custody',
        'hardware-wallet',
        'p2p',
        'no-kyc',
        'soberania',
        'open-source',
        'alfred',
        'coldkit',
      ],
    },
    identity_guide: [
      '# DSEC Labs / Alfred P2P — Identity Guide',
      '',
      '**Slogan:** "No Trust. Do It Yourself (DIY)."',
      '',
      '**Pilares (distribuição fixa 40/25/20/10/5):**',
      '- 40% Segurança & Self-Custody (air-gapped, multisig, hardware reviews, OPSEC)',
      '- 25% Privacidade & Soberania (anti-KYC, P2P, censura financeira, vigilância)',
      '- 20% Educação Bitcoin (conceitos, glossário, "níveis de Bitcoin")',
      '- 10% Mercado & Tendências (hacks, regulação, dados de perda, análise)',
      '- 5% Comunidade & Bastidores (eventos, time, parcerias)',
      '',
      '**2 Vozes:**',
      '- DSEC institucional PT-BR (LinkedIn, blog, newsletter): autoridade técnica sem condescendência',
      '- Alfred Reply Guy PT-BR (Twitter @alfredp2p): mordomo protetor, ácido com cuidado, lowercase, humor mais ácido mas nunca leviandade com patrimônio',
      '',
      '**Mensagens que ressoam:**',
      '- Liberdade financeira é direito',
      '- Privacidade é necessidade, não luxo',
      '- Bitcoin é ferramenta anti-censura',
      '- Você é seu próprio banco',
      '- Código aberto = confiança',
      '- Self-custody = real ownership',
      '- Educação = empoderamento',
      '',
      '**TABU (evitar):**',
      '- Altcoins (zero — Bitcoin-only)',
      '- Especulação',
      '- Promessas de retorno',
      '- Linguagem muito técnica',
      '- Intermediários/custódia de terceiros',
    ].join('\n'),
    voice_profile: {
      voices: {
        dsec_institucional: {
          tone: 'autoridade técnica sem condescendência',
          language: 'pt-BR',
          channels: ['linkedin', 'blog', 'newsletter'],
        },
        alfred_reply_guy: {
          tone: 'mordomo protetor, ácido com cuidado',
          language: 'pt-BR (lowercase)',
          channels: ['twitter', 'instagram_alfred'],
          personality: ['ácido', 'protetor', 'humor seco', 'nunca leviandade com patrimônio'],
        },
      },
      forbidden_phrases: ['—'],
      forbidden_topics: ['altcoins', 'calls de investimento', 'preço'],
      style: 'tutorial passo-a-passo é canônico do blog · densidade numérica obrigatória · zero travessão',
    },
    content_guidelines: [
      'Cadência: 16 blogs escritos · 6 newsletters · 5 emails mini-curso · 16 posts LinkedIn (Abr+Mai) · 16 SVGs Alfred + 6 imagens Gemini.',
      'Blog (2/mês): tutorial princípio + dado + próximo passo.',
      'Newsletter (2/mês): derivada de blog ou tema próprio.',
      'LinkedIn (2/sem, ter+qui): /post-dsec-semanal a partir do blog/news.',
      'Twitter Alfred (1/dia seg-sex + thread/quarta): repurpose de blog/news, tom Alfred PT-BR lowercase.',
      'Reply Guy (até 10/dia): playbook em 07-ESTRATEGIAS/reply-guy-playbook.md.',
      'Validação: zero travessão, dado numérico, pilar identificável.',
      'Não inventar preço/URL/cupom — aguardar dados oficiais.',
    ].join('\n'),
    brand_assets: {
      colors: {
        primary: '#f6911b', // Laranja primário
        secondary: '#a81580', // Roxo/Magenta — CTA
        black: '#000000',
        white: '#ffffff',
        success: '#36b376',
        gray: '#6C757D',
      },
      brand_assets_doc: '08-DESIGN-SYSTEM/design-system-completo.md',
      gemini_model: 'nano-banana-pro-preview (geração de imagens Alfred)',
    },
  },

  // ============================ LAYLA FOZ ============================
  {
    name: 'Laylä Föz',
    description:
      'Comunicadora, criadora de conteúdo e empreendedora brasileira que une arte, conhecimento e experiência vivida num ecossistema de expansão feminina. Plataforma fundada em 2018. Tagline: "Abrindo portais para mundos internos e externos."',
    context_notes: [
      'Status: ativo.',
      'Posicionamento: NÃO é guru espiritual nem coach. É comunicadora + artista que fala de autoconhecimento feminino através de práticas reais (tarot, meditação, ciclos, rituais, viagem transformadora).',
      'Filosofia central: viver é processo contínuo de autotransformação, com liberdade e propósito ancorados nas escolhas do momento presente — não em resultados futuros.',
      'Background: surfista, vegana, praticante de neuroplasticidade aplicada ao autoconhecimento.',
      'Histórico Kaleidos × Layla: Instagram cresceu de 100K → 184K. Reels passaram 20M views.',
      'Endereçamento padrão: "Deusa,". Assinatura: "Com carinho, Laylä Föz 🌙".',
      'Newsletter Brisa da Semana: semanal, domingo 16:20 (Beehiiv — brisadasemana.com).',
      'Eventos com CTA: Peru (1-9/05/2026 — referenciar antes/depois) · Águas Amazônicas (6-12/08/2026 — warm-up nas newsletters de jul) · App Sonhei lançado 01/05/2026.',
      '12 newsletters mai-jul 2026 já escritas + subidas no ClickUp.',
      'KAI client_id: 88cb0078-1d88-43a7-8075-7a21ccdc05fa.',
      'ClickUp list LaylaFoz: 901111718507.',
      'Skill copywriting-layla v1.0 (808 linhas) com voz reflexiva, poética, íntima.',
    ].join('\n'),
    social_media: {
      instagram: '@laylafoz (184K seguidores)',
      newsletter: 'brisadasemana.com (Beehiiv, dom 16:20)',
      site: 'laylafoz.com',
      app: 'sonheiapp.com (iOS + Android, lançado 01/05/2026)',
      yaz_experiences: 'yazexperiences.com (high ticket — esgota rápido)',
      youtube: '@laylafoz',
    },
    tags: {
      list: [
        'feminino',
        'autoconhecimento',
        'espiritualidade',
        'tarot',
        'meditacao',
        'newsletter',
        'instagram',
        'high-ticket',
        'viagens-transformadoras',
        'brisa-da-semana',
      ],
    },
    identity_guide: [
      '# Laylä Föz — Identity Guide',
      '',
      '**Tagline:** "Abrindo portais para mundos internos e externos."',
      '',
      '**Audiência:** Mulheres BR, 25-45, urbanas, leitoras, "Deusa". Buscam profundidade, autoconhecimento, viagens transformadoras. Lifestyle: veganismo, surf, mindfulness, viagem consciente. Dispostas a pagar premium por experiências curadas.',
      '',
      '**Pilares (35/25/25/15):**',
      '- 35% Autoconhecimento e Feminino (arquétipos, ciclos menstruais, ancestralidade, múltiplos eus, corpo)',
      '- 25% Espiritualidade Prática (tarot, meditação, rituais, ciclicidade)',
      '- 25% Viagens YAZ Experiences (retiros internacionais, experiências curadas, CTA high ticket)',
      '- 15% Lifestyle (veganismo, surf, viagem consciente, leituras, filosofia acessível)',
      '',
      '**Endereçamento padrão:** "Deusa,"',
      '**Assinatura:** "Com carinho, **Laylä Föz** 🌙"',
      '',
      '**Vocabulário do universo:** Deusa, portal, presença, soltar, sentir, ciclo, ancestral, feminino, honrar, liberdade, consciência, intuição, corpo, expansão, silêncio, brisa, leveza.',
      '',
      '**ANTI:** autoajuda genérica · motivacional vazio · coaching corporativo · esotérico excessivo · venda agressiva · urgência.',
      '',
      '**Posicionamento vs concorrentes:**',
      '- vs Eliane Brum ("carta da trincheira") → Layla é "carta de domingo", contemplação sem peso político',
      '- vs coaches autoajuda → Layla é poética, não instrucional',
      '- vs astrólogas/terapeutas → Layla cobre o feminino integral com ecossistema completo',
    ].join('\n'),
    voice_profile: {
      tone: 'reflexiva, poética, íntima — carta para amiga próxima',
      language: 'pt-BR',
      addressing: 'Deusa,',
      signature: 'Com carinho, Laylä Föz 🌙',
      vocabulary: [
        'Deusa',
        'portal',
        'presença',
        'soltar',
        'sentir',
        'ciclo',
        'ancestral',
        'feminino',
        'honrar',
        'liberdade',
        'consciência',
        'intuição',
        'corpo',
        'expansão',
        'silêncio',
        'brisa',
        'leveza',
      ],
      personality: ['reflexiva', 'poética', 'contemplativa', 'íntima'],
      forbidden: [
        'autoajuda genérica',
        'motivacional vazio',
        'coaching corporativo',
        'esotérico excessivo',
        'venda agressiva',
        'urgência',
      ],
    },
    content_guidelines: [
      'Newsletter Brisa (semanal, dom 16:20): seguir PLAYBOOK-NEWSLETTER + skill copywriting-layla.',
      'Estrutura canônica: abertura pessoal → conceito filosófico/cultural → aplicação prática → seção "Entre nós" → CTA YAZ/Sonhei.',
      'Capa newsletter: curadoria Pinterest (estética cinematográfica, tom quente, grão de filme, sem texto sobreposto).',
      'Divisória: ornamento floral recorrente entre seções.',
      'Newsletters de viagem (Japão, Peru, Tailândia, Marrocos): pedir fotos da Layla no destino.',
      'Sempre referenciar YAZ Experiences quando o tema for viagem.',
      'Quando citar App Sonhei: CTA explícito de download.',
      'Tom reflexivo, pessoal, leve — não é cripto, não é finanças.',
    ].join('\n'),
    brand_assets: {
      colors: {
        // sem paleta hex oficial validada (Manual de Marca em-andamento)
        // direção: tons quentes, cinematográficos e organicamente femininos
        note: 'Direção: tons quentes, cinematográficos e organicamente femininos. Manual de Marca em-andamento.',
      },
      typography: {
        direction: 'elegante, editorial, sensação de carta/manifesto',
      },
      image_direction: 'Pinterest curado, filme, grão, fotos sem texto sobreposto',
    },
  },
];

// ====== UPSERT ======
const results = [];

for (const c of clients) {
  // Verificar se já existe (case-insensitive)
  const existing = await sql`
    SELECT id, name FROM clients
    WHERE workspace_id = ${WORKSPACE_ID}
      AND lower(name) = lower(${c.name})
    LIMIT 1
  `;

  let row;
  if (existing.length > 0) {
    // UPDATE
    const id = existing[0].id;
    [row] = await sql`
      UPDATE clients SET
        description = ${c.description},
        context_notes = ${c.context_notes},
        social_media = ${JSON.stringify(c.social_media)}::jsonb,
        tags = ${JSON.stringify(c.tags)}::jsonb,
        identity_guide = ${c.identity_guide},
        voice_profile = ${JSON.stringify(c.voice_profile)}::jsonb,
        content_guidelines = ${c.content_guidelines},
        brand_assets = ${JSON.stringify(c.brand_assets)}::jsonb,
        updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, created_at
    `;
    results.push({ ...row, action: 'UPDATE' });
  } else {
    // INSERT
    [row] = await sql`
      INSERT INTO clients (
        workspace_id, user_id, created_by,
        name, description, context_notes,
        social_media, tags, identity_guide,
        voice_profile, content_guidelines, brand_assets
      ) VALUES (
        ${WORKSPACE_ID}, ${OWNER_USER_ID}, ${OWNER_USER_ID},
        ${c.name}, ${c.description}, ${c.context_notes},
        ${JSON.stringify(c.social_media)}::jsonb,
        ${JSON.stringify(c.tags)}::jsonb,
        ${c.identity_guide},
        ${JSON.stringify(c.voice_profile)}::jsonb,
        ${c.content_guidelines},
        ${JSON.stringify(c.brand_assets)}::jsonb
      )
      RETURNING id, name, created_at
    `;
    results.push({ ...row, action: 'INSERT' });
  }
}

console.log('\n===== RESULTADOS =====');
console.table(results);

// Relatório final por cliente
console.log('\n===== RELATÓRIO COMPLETO =====');
const all = await sql`
  SELECT
    id, name,
    (description IS NOT NULL AND description <> '') AS has_description,
    (context_notes IS NOT NULL AND context_notes <> '') AS has_context_notes,
    (social_media IS NOT NULL AND social_media <> '{}'::jsonb) AS has_social_media,
    (tags IS NOT NULL AND tags <> '{}'::jsonb) AS has_tags,
    (identity_guide IS NOT NULL AND identity_guide <> '') AS has_identity_guide,
    (voice_profile IS NOT NULL AND voice_profile <> '{}'::jsonb) AS has_voice_profile,
    (content_guidelines IS NOT NULL AND content_guidelines <> '') AS has_content_guidelines,
    (brand_assets IS NOT NULL AND brand_assets <> '{}'::jsonb) AS has_brand_assets,
    (avatar_url IS NOT NULL) AS has_avatar_url,
    (ai_analysis IS NOT NULL) AS has_ai_analysis,
    (function_templates IS NOT NULL AND function_templates <> '[]'::jsonb) AS has_function_templates
  FROM clients
  WHERE workspace_id = ${WORKSPACE_ID}
  ORDER BY name
`;
console.table(all);
