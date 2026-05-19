#!/usr/bin/env bun
/**
 * sync-alfred-vault.ts — Sincroniza vault → KAI 2.0 banco (Alfred persona)
 *
 * Cliente: Alfred (DSEC Labs persona)
 * client_id: 6889b3c1-5a8c-46a4-aab8-f1f872426e4b
 * Vault: vault/01 - KALEIDOS/011 - CLIENTES/DSEC/
 *
 * Operações (idempotentes):
 *   1) UPDATE clients SET description, brand_voice (jsonb em voice_profile), social_media
 *   2) UPSERT em client_content_library: sample tweets/threads do @alfredp2p
 *   3) UPSERT em client_reference_library: perfis de referência reply guy Bitcoin BR/EN
 *
 * Notas:
 * - Alfred é distinto da DSEC Labs (outro client_id 4e8be599-0d50-4759-b8a8-fb0b399e1551)
 * - Voz: PT-BR lowercase em TODOS canais desde 2026-05-04
 * - Regra dura: NUNCA inventar preço/URL/cupom (dsec_coldkit_no_invent.md)
 *
 * Idempotência: 'source_id' em metadata pra dedup. Re-rodar = no-op.
 *
 * Uso:
 *   bun run scripts/sync-alfred-vault.ts --dry-run
 *   bun run scripts/sync-alfred-vault.ts
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const ALFRED_CLIENT_ID = '6889b3c1-5a8c-46a4-aab8-f1f872426e4b';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function loadEnv(): Record<string, string> {
  const file = readFileSync('.env.local', 'utf-8');
  const env: Record<string, string> = {};
  for (const line of file.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const [k, ...rest] = line.split('=');
    let v = rest.join('=').trim().replace(/^"/, '').replace(/"\s*$/, '');
    env[k.trim()] = v;
  }
  return env;
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[fatal] DATABASE_URL não configurada');
  process.exit(1);
}

// ============================================================
// 1) CLIENT UPDATE
// ============================================================
const ALFRED_UPDATE = {
  description:
    'Persona pública DSEC Labs. Reply guy @alfredp2p em PT-BR lowercase. Tom casual técnico-acessível sobre segurança Bitcoin/privacidade.',
  voice_profile: {
    language: 'pt-br-lowercase',
    tom: 'reply-guy-casual',
    focus: 'bitcoin-security-privacy-self-custody',
    forbidden: ['inventar preço', 'inventar URL', 'inventar cupom', 'tom institucional'],
    // mantém payload anterior pra compatibilidade dos clients que já leem voice_profile
    style: 'reply guy, frases curtas, sem capitalização, opinião com fundamento',
    personality: ['independente', 'tecnico-mas-acessivel', 'sem hype', 'opinionado'],
    forbidden_topics: ['shill de altcoin', 'preço de bitcoin', 'previsão de mercado'],
  },
  social_media: {
    twitter: '@alfredp2p',
  },
};

// ============================================================
// 2) SAMPLE CONTENT (client_content_library)
//    source_id em metadata garante idempotência por UPSERT manual
// ============================================================
type ContentRow = {
  source_id: string; // unique key dentro do cliente
  title: string;
  content_type: 'tweet' | 'thread';
  content: string;
  metadata: Record<string, unknown>;
};

const CONTENT_ROWS: ContentRow[] = [
  // ===== Tweets diários maio 2026 =====
  {
    source_id: 'tweets-maio-2026/dom-04-05-t1',
    title: 'Alfred — Bitcoin sem CPF (Dom 04/05)',
    content_type: 'tweet',
    content:
      'Bitcoin foi criado pra eliminar intermediários. Comprar numa exchange com selfie, CPF e comprovante de endereço é adicionar intermediários de volta. O ativo é descentralizado. A compra, nem sempre.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
      pilar_split: '80% compra/p2p',
    },
  },
  {
    source_id: 'tweets-maio-2026/seg-05-05-t1',
    title: 'Alfred — Exchanges reportam pra Receita (Seg 05/05)',
    content_type: 'tweet',
    content:
      'Exchanges brasileiras reportam toda movimentação à Receita Federal via IN 1888. Cada compra, venda, saque, com seu CPF. Seu histórico financeiro em cripto é um arquivo aberto pro governo. P2P com KYC simplificado: o mesmo ativo, sem o relatório.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
    },
  },
  {
    source_id: 'tweets-maio-2026/ter-06-05-t1',
    title: 'Alfred — 270 mil clientes vazaram (Ter 06/05)',
    content_type: 'tweet',
    content:
      'Dados de 270 mil clientes vazaram de exchanges nos últimos 5 anos. Nome, CPF, endereço, selfie. Diferente de senha, você não reseta sua cara. KYC não protege o cliente. Protege a exchange.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
      contains_data: true,
    },
  },
  {
    source_id: 'tweets-maio-2026/qua-07-05-t1',
    title: 'Alfred — Como P2P funciona (Qua 07/05)',
    content_type: 'tweet',
    content:
      'P2P funciona assim: você + vendedor + escrow automático. Sem cadastro de CPF. Sem selfie. O escrow segura o BTC até o pagamento confirmar. Quando confirma, libera. Simples, direto, sem intermediário guardando seus dados.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'educacao-bitcoin',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
    },
  },
  {
    source_id: 'tweets-maio-2026/qua-07-05-t2-plataformas',
    title: 'Alfred — Plataformas P2P (Qua 07/05)',
    content_type: 'tweet',
    content:
      'Plataformas P2P com privacidade que funcionam hoje: Bisq (descentralizada, referência), HodlHodl (web, multisig), Peach Bitcoin (mobile, UX top), RoboSats (Tor, Lightning), Klever (nova, crescendo). Verificação mínima ou simplificada.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'educacao-bitcoin',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
      tools_mentioned: ['Bisq', 'HodlHodl', 'Peach Bitcoin', 'RoboSats', 'Klever'],
    },
  },
  {
    source_id: 'tweets-maio-2026/qui-08-05-poll',
    title: 'Alfred — Poll como você compra Bitcoin (Qui 08/05)',
    content_type: 'tweet',
    content:
      'Como você compra Bitcoin hoje?\n\n🔲 Exchange com KYC completo\n🔲 P2P com privacidade\n🔲 Mix dos dois\n🔲 Ainda não comprei\n\nSpoiler: 90% tá na primeira. Entregando dados de graça.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      format: 'poll',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
    },
  },
  {
    source_id: 'tweets-maio-2026/sab-10-05-gm',
    title: 'Alfred — GM rotineiro sábado (Sab 10/05)',
    content_type: 'tweet',
    content:
      'gm de sábado. Se você ainda tá usando exchange com KYC pra empilhar sat, essa semana foi pra você repensar. ☕',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'comunidade',
      format: 'gm',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S1 maio',
    },
  },
  {
    source_id: 'tweets-maio-2026/seg-12-05-bisq',
    title: 'Alfred — Bisq deep dive (Seg 12/05)',
    content_type: 'tweet',
    content:
      'Bisq: 100% descentralizada. Roda no seu computador. Sem servidor central. Sem cadastro. Trade direto com outro peer via rede P2P. O código é aberto. O escrow é multisig. Se a Bisq morrer amanhã, o protocolo continua rodando.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'educacao-bitcoin',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S2 maio',
      tools_mentioned: ['Bisq'],
    },
  },
  {
    source_id: 'tweets-maio-2026/ter-13-05-peach',
    title: 'Alfred — Peach Bitcoin (Ter 13/05)',
    content_type: 'tweet',
    content:
      'Peach Bitcoin: o app mais bonito do P2P. Mobile-first, UX de app de banco (sem ser banco). KYC simplificado. Escrow automático. Pagamento via Pix, SEPA, Revolut. Se você acha P2P complicado, Peach existe pra provar o contrário.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'educacao-bitcoin',
      vault_source: 'DSEC/02-CONTEUDO/twitter/tweets-diarios-maio-2026.md',
      week: 'S2 maio',
      tools_mentioned: ['Peach Bitcoin'],
    },
  },

  // ===== Threads originais Alfred =====
  {
    source_id: 'threads-originais/thread-07-ledger-leak',
    title: 'Thread 07 — O Vazamento da Ledger Mudou Tudo',
    content_type: 'thread',
    content:
      '1/6 🧵 Em 2020, a Ledger vazou os dados pessoais de 270 mil clientes.\n\nNomes. Endereços. Telefones. Email.\n\nDois anos depois, pessoas ainda recebiam ameaças de morte e ataques de SIM-swap.\n\nA lição que ninguém quer ouvir:\n\n2/6 Bancos de dados KYC são honeypots.\n\nToda empresa que coleta seus dados vira alvo. Não "se", "quando."\n\nA Ledger não é única. É só o exemplo mais famoso.\n\nToda exchange, toda empresa de wallet com KYC, mesmo risco.\n\n3/6 Depois do vazamento da Ledger:\n- Invasões físicas em casas de holders conhecidos\n- Ataques SIM-swap drenando contas de exchange\n- Campanhas de phishing usando nomes e endereços reais\n- Pelo menos um caso de coerção física ("wrench attack")\n\nSaber que alguém tem cripto transforma a pessoa em alvo.\n\n4/6 A solução tem duas partes:\n\n1. Compre com privacidade, plataformas P2P, sem documentos, sem banco de dados pra vazar\n2. Guarde em dispositivo air-gapped, mesmo se for alvo, ataques remotos falham\n\nSem dados expostos = ninguém sabe. Air-gap = mesmo que saibam, não alcançam.\n\n5/6 "Mas KYC protege contra lavagem de dinheiro!"\n\nKYC protege instituições. Cria risco para indivíduos.\n\nVocê entrega sua identidade pra um banco de dados que eventualmente será invadido. Isso não é proteção. É uma vulnerabilidade.\n\n6/6 Privacidade financeira não é sobre ter algo a esconder.\n\nÉ sobre não pintar um alvo nas suas costas.\n\nCompre privado. Guarde offline. Não conte pra ninguém.\n\nEsse é o padrão.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      vault_source: 'DSEC/02-CONTEUDO/twitter/threads-originais-alfred.md',
      tweets_count: 6,
      tipo: 'dados-provocador',
      week: 'S3 maio',
    },
  },
  {
    source_id: 'threads-originais/thread-08-wrench-attack',
    title: 'Thread 08 — O Ataque da Chave de Fenda É Real',
    content_type: 'thread',
    content:
      '1/6 🧵 O "wrench attack" (ataque da chave de fenda) não é mais meme.\n\nEm 2026, wrench attacks subiram 75%. 72 incidentes confirmados no mundo. Perdas acima de US$ 40 milhões.\n\nO que realmente te protege, e o que não protege:\n\n2/6 Uma hardware wallet de R$ 1.500 não ajuda se alguém aponta uma arma e diz "transfere tudo."\n\nSecurity Element? Não importa.\nCódigo PIN? Vai entregar.\nPassphrase? Só se não souberem que existe.\n\nSegurança física ≠ segurança digital.\n\n3/6 O que funciona contra coerção física:\n\nWallet isca, primeiro PIN abre wallet com saldo pequeno. Fundos reais atrás de passphrase que não sabem que existe.\n\nMultisig, precisa 2 de 3 chaves. Chaves em locais diferentes. Você literalmente NÃO CONSEGUE ceder, mesmo querendo.\n\n4/6 Memória volátil, dispositivo não armazena nada quando desligado. Atacante recebe um tijolo.\n\nDistribuição geográfica, chaves em cidades/países diferentes. Coerção em casa não acessa tudo.\n\nOPSEC, ninguém sabe que você tem cripto significativo. Melhor defesa = invisibilidade.\n\n5/6 A hierarquia de proteção:\n\n1. Não conte pra ninguém (prevenção)\n2. Wallet isca (misdirection)\n3. Multisig em locais separados (impossibilidade)\n4. Dispositivo com memória volátil (nada pra extrair)\n5. Transações time-locked (mesmo coagido, fundos travados)\n\n6/6 Segurança digital se resolve com matemática.\nSegurança física se resolve com comportamento.\n\nA melhor hardware wallet do mundo não te protege se todo mundo sabe que você tem 10 BTC.\n\nFique quiet. Acumule sats. Não conte pra ninguém. Esse é o modelo real de segurança.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'seguranca-self-custody',
      vault_source: 'DSEC/02-CONTEUDO/twitter/threads-originais-alfred.md',
      tweets_count: 6,
      tipo: 'educativo-provocador',
      week: 'S4 maio',
    },
  },
  {
    source_id: 'threads-originais/thread-10-seed-phrase-erros',
    title: 'Thread 10 — Seed Phrase: Tudo Que Você Está Fazendo Errado',
    content_type: 'thread',
    content:
      '1/7 🧵 Sua seed phrase É o seu Bitcoin.\n\nNão a wallet. Não o hardware. As 24 palavras.\n\nE quase todo mundo armazena errado.\n\nOs erros comuns, e as soluções:\n\n2/7 ❌ Print de tela no celular\n\nSeu celular sincroniza com iCloud/Google. Suas fotos são escaneadas por IA. Seu dispositivo pode ser comprometido remotamente.\n\nUm print da sua seed phrase é o pior backup possível. Apague. Agora.\n\n3/7 ❌ Escrita em papel, guardada em casa\n\nPapel degrada. Dano por água. Incêndio. Roubo.\n\nSe sua casa alaga ou pega fogo, seu backup em papel se foi. E com ele, seu Bitcoin. Permanentemente.\n\n4/7 ❌ Armazenada em gerenciador de senhas\n\nSeu gerenciador de senhas está online. Tem uma senha mestra. É um ponto único de falha.\n\nLastPass foi invadido em 2022. Clientes perderam milhões em cripto de seeds armazenadas nos vaults.\n\n5/7 ❌ Mesmo local que o dispositivo\n\nSe alguém encontra sua wallet E seu backup da seed no mesmo lugar, tem tudo.\n\nSeed e dispositivo devem estar em locais físicos diferentes. Sempre.\n\n6/7 ✅ O que realmente funciona:\n\n1. Gravada em placa de metal (sobrevive fogo + água)\n2. Armazenada em local separado do dispositivo\n3. Considere dividir com Shamir\'s Secret Sharing\n4. Passphrase (25ª palavra) memorizada, não escrita\n5. Teste de recovery ANTES de guardar fundos significativos\n\n7/7 Sua seed phrase vale o saldo inteiro do seu Bitcoin. Para sempre.\n\nTrate como se valesse isso.\n\nMetal. Local separado. Recovery testado.\n\nSem atalhos. Sem "faço depois."\n\nEssa é a única coisa que não dá pra desfazer.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'seguranca-self-custody',
      vault_source: 'DSEC/02-CONTEUDO/twitter/threads-originais-alfred.md',
      tweets_count: 7,
      tipo: 'educativo-viral-bait',
      week: 'S2 junho',
    },
  },

  // ===== Thread de maio (P2P guia completo) =====
  {
    source_id: 'threads-maio-2026/thread-01-p2p-privacidade',
    title: 'Thread S1 Maio — P2P com privacidade: o guia que ninguém te deu',
    content_type: 'thread',
    content:
      '🧵 1/8 Você quer comprar Bitcoin.\n\nA exchange pede: CPF, selfie, comprovante de endereço, e-mail, telefone. Tudo num banco de dados. Tudo reportado pra Receita.\n\nE se eu te dissesse que dá pra comprar o mesmo Bitcoin, pelo mesmo preço, sem entregar nada disso?\n\nThread. 👇\n\n2/8 P2P = peer-to-peer. Você compra direto de outra pessoa.\n\nEscrow automático segura o BTC até o pagamento confirmar. Sem empresa no meio guardando seus dados. Sem relatório pra governo. Sem selfie em servidor.\n\nO intermediário é código. Não confiança.\n\n3/8 "Mas é seguro?"\n\nEscrow multisig: o BTC fica travado num endereço que precisa de 2 de 3 assinaturas pra liberar. Você, vendedor, plataforma. Se der problema, a plataforma media. Se não der problema, ela nunca toca nos fundos.\n\nGolpe com escrow = ordens de grandeza mais difícil.\n\n4/8 As plataformas:\n\n• Bisq, 100% descentralizada. Roda no seu PC. Sem servidor central. A referência.\n• HodlHodl, escrow 2-de-3 no browser. Liquidez boa pra BRL.\n• Peach Bitcoin, mobile-first, UX linda. Aceita Pix.\n• RoboSats, Lightning + Tor. Identidade = robô aleatório.\n\n5/8 Diferença de preço? 2-3% acima do mercado. Esse é o custo de privacidade.\n\nCompare com o custo de ter seu CPF, rosto e patrimônio num banco de dados que pode ser hackeado, intimado ou vendido.\n\n270 mil clientes já tiveram dados vazados de exchanges. Você não reseta sua cara.\n\n6/8 "Mas e a Receita?"\n\nCompra P2P não é crime. Sonegação é. São coisas diferentes.\n\nVocê pode comprar com privacidade total e declarar ganhos de capital quando realizar lucro. A lei não exige que você entregue seus dados pra uma exchange pra ser legal.\n\n7/8 O ciclo completo:\n\nFiat → P2P com privacidade → Bitcoin → Cold wallet\n\nCada etapa remove um intermediário. No final sobra só você e sua chave. Isso é Bitcoin do jeito que foi projetado.\n\n8/8 Quer ir fundo? DM "ciclo" que mando o material completo.',
    metadata: {
      platform: 'twitter',
      handle: '@alfredp2p',
      pilar: 'privacidade',
      vault_source: 'DSEC/02-CONTEUDO/twitter/threads-maio-2026.md',
      tweets_count: 8,
      tipo: 'guia-p2p',
      week: 'S1 maio',
      cta_modified: 'CTA original tinha URL/cupom inventados, substituído por DM (regra dsec_coldkit_no_invent.md)',
    },
  },
];

// ============================================================
// 3) REFERENCE LIBRARY (client_reference_library)
//    Perfis curados pra reply guy + benchmark
// ============================================================
type RefRow = {
  source_id: string;
  title: string;
  reference_type: string;
  content: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
};

const REFERENCE_ROWS: RefRow[] = [
  // ===== Refs internacionais (gold standard pra reply guy) =====
  {
    source_id: 'ref/jameson-lopp',
    title: 'Jameson Lopp (@lopp) — Cypherpunk profissional',
    reference_type: 'inspiration',
    content:
      'Co-founder Casa, referência mundial #1 em self-custody. ~600k+ X.\n\nPosicionamento: "Professional Cypherpunk", engenharia de privacidade e custódia.\n\nPilares: (1) Multisig, (2) ataques físicos a holders (lista pública), (3) privacy ops, (4) recuperação/herança, (5) crítica a custódia centralizada.\n\nFrames: listas curadas (physical attacks list, resources), threads-tutorial, refutações cirúrgicas, tom "se você não tem multisig, não tem Bitcoin".\n\nTom: sóbrio, técnico, levemente sarcástico com noobs e altcoiners. Sem flexão emocional.\n\n>>> Por que importa pro Alfred: tom Lopp é o gold standard, ácido mas correto, factual, gera autoridade. DSEC pode espelhar a "lista pública de ataques" como recurso BR.',
    source_url: 'https://x.com/lopp',
    metadata: {
      handle: '@lopp',
      idioma: 'EN',
      pais: 'EUA',
      tamanho: '600k+ X',
      categoria: 'cypherpunk-self-custody',
      relevancia: 10,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['reply-guy-tom', 'thread-format', 'data-driven-replies'],
    },
  },
  {
    source_id: 'ref/nvk-coinkite',
    title: 'NVK / Rodolfo Novak (@nvk) — Coinkite/Coldcard',
    reference_type: 'inspiration',
    content:
      'CEO Coinkite (Coldcard, Opendime, Tapsigner, Blockclock). Brasileiro radicado no Canadá. ~200k+ X.\n\nPosicionamento: "Adversarial thinking", assuma que querem te roubar, projete pra isso.\n\nPilares: (1) Hardware wallet BTC-only, (2) supply-chain security, (3) review de updates de projetos BTC, (4) crítica a UX de Ledger/Trezor, (5) BTC puro (anti-altcoin total).\n\nTom: brutalmente direto, sarcástico, brasileiro raiz disfarçado de gringo. Famoso por flame wars.\n\n>>> Por que importa pro Alfred: espelhar a fórmula NVK, ácido + tecnicamente irrefutável + foco BTC-only. Validação que mercado paga premium por hardware seguro auditado.',
    source_url: 'https://x.com/nvk',
    metadata: {
      handle: '@nvk',
      idioma: 'EN',
      pais: 'Canadá (BR-born)',
      tamanho: '200k+ X',
      categoria: 'hardware-wallet-btc-only',
      relevancia: 10,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['reply-guy-tom', 'opinion-takes', 'hardware-comparativo'],
    },
  },
  {
    source_id: 'ref/matt-odell',
    title: 'Matt Odell (@matt_odell) — Rabbit Hole Recap',
    reference_type: 'inspiration',
    content:
      'Co-host Rabbit Hole Recap, evangelista Nostr, pioneiro privacidade BTC. Outrora 250k X, deletou pra Nostr.\n\nPosicionamento: "Self-custody = personal responsibility radical."\n\nPilares: (1) Nostr + Bitcoin, (2) sim swaps e ataques sociais, (3) custódia com seguro (Casa), (4) crítica a influencer culture cripto, (5) open source funding (OpenSats).\n\nTom: sério, paciente, raramente sarcástico. Voz de "tio que avisa antes do desastre".\n\n>>> Por que importa pro Alfred: voz "tio que avisa" é replicável em PT-BR. Conteúdo sobre sim-swap em BR é raro e altamente valioso.',
    source_url: 'https://x.com/matt_odell',
    metadata: {
      handle: '@matt_odell',
      idioma: 'EN',
      pais: 'EUA',
      tamanho: '250k+ (migrou pra Nostr)',
      categoria: 'privacy-self-custody',
      relevancia: 9,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['warning-format', 'sim-swap-content', 'tom-conselheiro'],
    },
  },

  // ===== Refs BR =====
  {
    source_id: 'ref/bitcoinheiros',
    title: 'Bitcoinheiros — Podcast técnico-cypherpunk PT',
    reference_type: 'inspiration',
    content:
      'Podcast técnico-cypherpunk em PT. Mais ortodoxo do BR. Dezenas de milhares de inscritos no YT, audiência cativa há 5+ anos.\n\nPosicionamento: "Bitcoin em português do Brasil", técnico, sério, sem altcoin.\n\nPilares: (1) Self-custody hardcore, (2) nodes/lightning, (3) privacidade (CoinJoin, Whirlpool), (4) técnica de carteiras, (5) economia austríaca.\n\nTom: técnico, didático, paciente. Zero hype.\n\n>>> Oportunidade Alfred: Bitcoinheiros é guia conceitual em PT. Alfred pode ser braço operacional/forense ("você aprendeu com eles, agora faça funcionar com a gente"). Frequência diária vs episódios semanais deles.',
    source_url: 'https://twitter.com/bitcoinheiros',
    metadata: {
      handle: '@bitcoinheiros',
      idioma: 'PT-BR',
      pais: 'Brasil',
      tamanho: 'milhares no YT',
      categoria: 'podcast-tecnico-btc',
      relevancia: 9,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['benchmark-pt-br', 'tom-tecnico-didatico', 'audience-overlap'],
    },
  },
  {
    source_id: 'ref/area-bitcoin',
    title: 'Area Bitcoin (Carol Souza + Kaká Furlan)',
    reference_type: 'inspiration',
    content:
      'Maior escola de Bitcoin da América Latina. Carol (32) e Kaká (33) viraram referência feminina no nicho BR. +2.500 alunos formados.\n\nPosicionamento: "A maior escola de Bitcoin do mundo." Educação completa do zero ao avançado, com viés feminino e acessível.\n\nPilares: (1) Curso Bitcoin Starter, (2) self-custody com multisig, (3) herança em BTC, (4) viagens só com BTC, (5) ferramentas open-source.\n\nTom: didático, acolhedor, pragmático. Sem maximalismo agressivo.\n\n>>> Oportunidade Alfred: Area é generalista. Alfred pode atacar verticais profundas: forensics, recuperação, OPSEC adversarial. Tom Alfred (lowercase, ácido leve) diferencia do tom acolhedor delas.',
    source_url: 'https://areabitcoin.com.br',
    metadata: {
      handle: '@area.bitcoin',
      idioma: 'PT-BR',
      pais: 'Brasil',
      tamanho: '+2500 alunos, IG ativo',
      categoria: 'escola-educacao-btc',
      relevancia: 8,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['benchmark-pt-br', 'diferenciacao-vertical', 'tom-contraste'],
    },
  },
  {
    source_id: 'ref/stephan-livera',
    title: 'Stephan Livera — Sharpest minds in Bitcoin',
    reference_type: 'inspiration',
    content:
      'Australiano, host do podcast técnico-econômico mais respeitado do nicho BTC. ~150k X, audiência super-qualificada (devs, economistas, fundos).\n\nPosicionamento: "Sharpest economic and technical minds in Bitcoin."\n\nPilares: (1) Bitcoin Core dev interviews, (2) Austrian economics, (3) Optech recaps, (4) Lightning/L2, (5) regulação global.\n\nTom: calmo, analítico, sotaque australiano marcado. Zero clickbait.\n\n>>> Use pro Alfred: fonte de munição factual pra threads. Episódios técnicos = matéria-prima pra repurpose de "1 episódio = 1 thread Alfred lowercase com 5 takeaways."',
    source_url: 'https://x.com/stephanlivera',
    metadata: {
      handle: '@stephanlivera',
      idioma: 'EN',
      pais: 'Australia',
      tamanho: '150k+ X',
      categoria: 'podcast-economia-btc',
      relevancia: 7,
      vault_source: 'vault/99 - SISTEMA/comunicacao-strategy/refs-mercado/seguranca-bitcoin-br.md',
      use_for: ['fonte-tecnica', 'repurpose-podcast-thread'],
    },
  },

  // ===== Reply guy curadoria (perfis-alvo de engajamento) =====
  {
    source_id: 'ref/reply-targets/grupo-a-bitcoin-ogs',
    title: 'Reply Targets — Grupo A: Bitcoin OGs (Segunda)',
    reference_type: 'inspiration',
    content:
      'Grupo A da curadoria reply guy DSEC, foco Bitcoin OGs & Maximalistas (Segunda):\n\n1. @loaboraschi (Lo), 250K+, Bitcoin educator, privacy advocate. Threads sobre self-custody e filosofia Bitcoin.\n2. @DocumentingBTC, 1M+, Maior conta de dados/educação Bitcoin. Perfeito pra reply Dados-Driven.\n3. @BitcoinMagazine, 4M+, Maior mídia Bitcoin. Reply Educador ou Protetor.\n4. @daboraschi (Dan), 200K+, Bitcoin educator. Threads técnicas profundas. Reply Educador.\n5. @matt_odell, 350K+, Privacy maximalist. KYC, privacidade, self-custody.\n\nTom do dia: educativo + comunitário. Segunda é dia de conceitos.',
    source_url: null,
    metadata: {
      grupo: 'A',
      dia_da_semana: 'segunda',
      categoria: 'reply-targets',
      tom_recomendado: 'educativo-comunitario',
      vault_source: 'DSEC/07-ESTRATEGIAS/reply-guy-curadoria-perfis.md',
    },
  },
  {
    source_id: 'ref/reply-targets/grupo-b-seguranca',
    title: 'Reply Targets — Grupo B: Segurança & Hardware (Terça)',
    reference_type: 'inspiration',
    content:
      'Grupo B da curadoria reply guy DSEC, foco Segurança & Hardware Wallets (Terça):\n\n6. @CertiK, 500K+, auditoria cripto. Posta exploits diariamente, gatilho reply Protetor.\n7. @SlowMist_Team, 200K+, segurança on-chain, alertas hack.\n8. @SatoshiLabs (Trezor), 300K+, concorrente hardware. Oportunidade posicionar air-gap.\n9. @COLDCARDwallet, 120K+, hardware concorrente (air-gapped). Debate técnico.\n10. @ArkadeBTC (Arkad), 80K+, dev e security researcher BTC. Reply Educador.\n\nTom do dia: dados/alerta + protetor. Terça é dia de segurança e números.',
    source_url: null,
    metadata: {
      grupo: 'B',
      dia_da_semana: 'terca',
      categoria: 'reply-targets',
      tom_recomendado: 'dados-protetor',
      vault_source: 'DSEC/07-ESTRATEGIAS/reply-guy-curadoria-perfis.md',
    },
  },
  {
    source_id: 'ref/reply-guy-municao-dados',
    title: 'Munição de Dados Permanente — Reply Guy Alfred',
    reference_type: 'inspiration',
    content:
      'Banco de dados permanente pra usar em replies (atualizar mensal):\n\n- "$2.9B lost to crypto hacks in 2025" (fonte: CertiK annual report)\n- "60% of crypto losses came from access control failures"\n- "Mt. Gox: 850K BTC. FTX: $8B. Celsius: $4.7B. O padrão é sempre o mesmo: terceiros confiáveis."\n- "Air-gapped devices eliminate remote attack vectors entirely, no USB, no Bluetooth, no Wi-Fi."\n- "Open-source firmware foi peer-reviewed por milhares. Closed-source firmware foi revisado por... a empresa que vende."\n- "Sua seed phrase tem 2048^24 combinações. Mais átomos que no universo observável."\n- "KYC databases are honeypots. Ledger leak (2020): 270K customers doxxed."\n- "Em 2025, P2P Bitcoin trading volume bateu ATH em 12 países simultaneamente."\n- "Wrench attacks 2026 subiram 75%. 72 incidentes confirmados. Perdas > US$ 40 milhões."\n- "270 mil clientes vazaram de exchanges nos últimos 5 anos. Você não reseta sua cara."',
    source_url: null,
    metadata: {
      categoria: 'data-bank',
      tipo: 'reply-ammunition',
      vault_source: 'DSEC/07-ESTRATEGIAS/reply-guy-curadoria-perfis.md',
      atualizar: 'mensal',
    },
  },
];

// ============================================================
// EXEC
// ============================================================
async function main() {
  console.log('========================================');
  console.log('sync-alfred-vault — Vault → KAI 2.0');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Alfred client_id: ${ALFRED_CLIENT_ID}`);
  console.log('========================================\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const c = await pool.connect();

  let counters = {
    client_updated: 0,
    content_inserted: 0,
    content_updated: 0,
    content_skipped: 0,
    ref_inserted: 0,
    ref_updated: 0,
    ref_skipped: 0,
  };
  const gaps: string[] = [];

  try {
    // ===== 1) UPDATE clients =====
    console.log('[1] Updating clients row...');
    if (!dryRun) {
      const r = await c.query(
        `UPDATE clients
            SET description   = $2,
                social_media  = $3::jsonb,
                voice_profile = $4::jsonb,
                updated_at    = NOW()
          WHERE id = $1
          RETURNING id`,
        [
          ALFRED_CLIENT_ID,
          ALFRED_UPDATE.description,
          JSON.stringify(ALFRED_UPDATE.social_media),
          JSON.stringify(ALFRED_UPDATE.voice_profile),
        ],
      );
      counters.client_updated = r.rowCount || 0;
      if (r.rowCount === 0) {
        gaps.push(`clients row ${ALFRED_CLIENT_ID} não encontrada, UPDATE retornou 0 rows`);
      }
    }
    console.log(`    description, voice_profile (brand_voice), social_media atualizados`);
    console.log('');

    // ===== 2) UPSERT client_content_library =====
    console.log(`[2] Upserting client_content_library (${CONTENT_ROWS.length} rows)...`);
    for (const row of CONTENT_ROWS) {
      const metadata = { ...row.metadata, source_id: row.source_id, sync_script: 'sync-alfred-vault' };

      // Idempotente: chave = (client_id, metadata->>source_id)
      const existing = await c.query(
        `SELECT id, content, title FROM client_content_library
          WHERE client_id = $1
            AND metadata->>'source_id' = $2
          LIMIT 1`,
        [ALFRED_CLIENT_ID, row.source_id],
      );

      if (existing.rows.length > 0) {
        const e = existing.rows[0];
        const needsUpdate = e.content !== row.content || e.title !== row.title;
        if (needsUpdate) {
          if (!dryRun) {
            await c.query(
              `UPDATE client_content_library
                  SET title = $2,
                      content_type = $3::content_type,
                      content = $4,
                      metadata = $5::jsonb,
                      updated_at = NOW()
                WHERE id = $1`,
              [e.id, row.title, row.content_type, row.content, JSON.stringify(metadata)],
            );
          }
          counters.content_updated++;
          console.log(`    UPD ${row.source_id}`);
        } else {
          counters.content_skipped++;
        }
      } else {
        if (!dryRun) {
          await c.query(
            `INSERT INTO client_content_library
               (client_id, title, content_type, content, metadata)
             VALUES ($1, $2, $3::content_type, $4, $5::jsonb)`,
            [ALFRED_CLIENT_ID, row.title, row.content_type, row.content, JSON.stringify(metadata)],
          );
        }
        counters.content_inserted++;
        console.log(`    NEW ${row.source_id}`);
      }
    }
    console.log('');

    // ===== 3) UPSERT client_reference_library =====
    console.log(`[3] Upserting client_reference_library (${REFERENCE_ROWS.length} rows)...`);
    for (const row of REFERENCE_ROWS) {
      const metadata = { ...row.metadata, source_id: row.source_id, sync_script: 'sync-alfred-vault' };

      const existing = await c.query(
        `SELECT id, content, title FROM client_reference_library
          WHERE client_id = $1
            AND metadata->>'source_id' = $2
          LIMIT 1`,
        [ALFRED_CLIENT_ID, row.source_id],
      );

      if (existing.rows.length > 0) {
        const e = existing.rows[0];
        const needsUpdate = e.content !== row.content || e.title !== row.title;
        if (needsUpdate) {
          if (!dryRun) {
            await c.query(
              `UPDATE client_reference_library
                  SET title = $2,
                      reference_type = $3,
                      content = $4,
                      source_url = $5,
                      metadata = $6::jsonb,
                      updated_at = NOW()
                WHERE id = $1`,
              [e.id, row.title, row.reference_type, row.content, row.source_url, JSON.stringify(metadata)],
            );
          }
          counters.ref_updated++;
          console.log(`    UPD ${row.source_id}`);
        } else {
          counters.ref_skipped++;
        }
      } else {
        if (!dryRun) {
          await c.query(
            `INSERT INTO client_reference_library
               (client_id, title, reference_type, content, source_url, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [ALFRED_CLIENT_ID, row.title, row.reference_type, row.content, row.source_url, JSON.stringify(metadata)],
          );
        }
        counters.ref_inserted++;
        console.log(`    NEW ${row.source_id}`);
      }
    }
    console.log('');

    // ===== Report =====
    console.log('========================================');
    console.log('Resumo');
    console.log('========================================');
    console.log(`clients: ${counters.client_updated} row(s) updated`);
    console.log(`client_content_library:    +${counters.content_inserted} new, ~${counters.content_updated} updated, =${counters.content_skipped} unchanged`);
    console.log(`client_reference_library:  +${counters.ref_inserted} new, ~${counters.ref_updated} updated, =${counters.ref_skipped} unchanged`);
    if (gaps.length > 0) {
      console.log('\nGAPS:');
      for (const g of gaps) console.log(`  - ${g}`);
    } else {
      console.log('\nGaps: nenhum');
    }
    if (dryRun) {
      console.log('\n(dry-run, nenhuma mutação foi feita)');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

await main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
