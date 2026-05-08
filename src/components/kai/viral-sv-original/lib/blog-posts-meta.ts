/**
 * Blog Posts — Metadata index
 * ----------------------------
 * Lista canonica de posts do blog. Importada por:
 *   - app/blog/page.tsx (listagem)
 *   - app/blog/[slug]/page.tsx (artigo — usa slug + category + related)
 *
 * O CONTEUDO full (markdown inline) vive em app/blog/[slug]/page.tsx.
 * Aqui fica so a meta para renderizar cards, OG, sitemap etc.
 *
 * Ordem: mais recente primeiro. Mantenha a data no formato AAAA-MM-DD.
 */

export interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;      // ISO (AAAA-MM-DD)
  readTime: string;  // ex "8 min"
  category: PostCategory;
  number?: number;   // Número editorial da edição (kicker "Nº 04")
  tint?: "green" | "pink" | "ink" | "paper"; // bloco colorido do card
}

export type PostCategory =
  | "Sequência Viral"
  | "Instagram"
  | "Estratégia"
  | "Copywriting"
  | "Análise"
  | "Produtividade"
  | "IA"
  | "Referência";

export const POSTS_META: PostMeta[] = [
  {
    slug: "sequencia-viral-novidades-abril-2026-image-picker-pdf-export",
    title:
      "Sequência Viral em Abril: Image Picker, PDF Export e o fim das gambiarras de export",
    excerpt:
      "Os updates desta leva mexem no que mais atrasava quem publica em volume — seleção de imagem com grid de 8, PDF estável e limites de plano verificados no servidor.",
    date: "2026-04-15",
    readTime: "4 min",
    category: "Sequência Viral",
    number: 11,
    tint: "green",
  },
  {
    slug: "algoritmo-instagram-2026-como-funciona-o-que-mudou",
    title:
      "O algoritmo do Instagram em 2026: o que mudou, o que continua igual, o que ninguém te contou",
    excerpt:
      "Feed, Explore, Reels e carrosséis são quatro algoritmos diferentes. Se você trata todos como um só, está otimizando pro lugar errado. Guia completo, atualizado e sem papo furado.",
    date: "2026-04-14",
    readTime: "11 min",
    category: "Instagram",
    number: 10,
    tint: "pink",
  },
  {
    slug: "12-hooks-primeiro-slide-carrossel-parar-scroll",
    title:
      "12 hooks de primeiro slide que param o scroll (com a psicologia por trás)",
    excerpt:
      "O primeiro slide tem 0,7 segundo pra segurar a pessoa. 12 padrões testados, com os gatilhos que ativam em cada um e por que funcionam.",
    date: "2026-04-12",
    readTime: "10 min",
    category: "Estratégia",
    number: 9,
    tint: "ink",
  },
  {
    slug: "como-criar-carrosseis-virais-instagram-2026",
    title: "Como criar carrosséis que viralizam no Instagram em 2026",
    excerpt:
      "Não é sorte — é sistema. Primeiro slide forte, narrativa progressiva, design limpo, CTA claro e frequência. O passo a passo que a gente usa.",
    date: "2026-04-10",
    readTime: "7 min",
    category: "Instagram",
    number: 8,
    tint: "paper",
  },
  {
    slug: "storytelling-em-carrosseis-como-contar-historias-que-engajam",
    title:
      "Storytelling em carrosséis: como contar histórias que prendem em 10 slides",
    excerpt:
      "Três arcos narrativos, micro-histórias entre slides, tensão e resolução. Técnicas de storytelling profissional aplicadas ao formato mais curto do Instagram.",
    date: "2026-04-09",
    readTime: "9 min",
    category: "Estratégia",
    number: 7,
    tint: "green",
  },
  {
    slug: "5-formatos-carrossel-mais-engajamento",
    title:
      "5 formatos de carrossel que geram mais engajamento (e quando usar cada um)",
    excerpt:
      "Listicle, Mito vs Realidade, Tutorial, Antes e Depois, Hot Take. Cada formato puxa um gatilho diferente — e performa diferente dependendo do seu objetivo.",
    date: "2026-04-08",
    readTime: "6 min",
    category: "Estratégia",
    number: 6,
    tint: "pink",
  },
  {
    slug: "copywriting-para-redes-sociais-guia-definitivo-2026",
    title:
      "Copywriting para redes sociais em 2026: o guia definitivo (sem achismo)",
    excerpt:
      "Sete fórmulas de copy que ainda funcionam, três que envelheceram mal e como escrever pra cada plataforma sem soar como um bot de LinkedIn.",
    date: "2026-04-07",
    readTime: "12 min",
    category: "Copywriting",
    number: 5,
    tint: "ink",
  },
  {
    slug: "thread-vs-carrossel-qual-funciona-melhor",
    title: "Thread vs carrossel: qual formato realmente funciona melhor?",
    excerpt:
      "Dois formatos, duas plataformas, dois objetivos diferentes. A resposta não é 'depende' — é uma matriz simples pra você decidir caso a caso.",
    date: "2026-04-05",
    readTime: "8 min",
    category: "Análise",
    number: 4,
    tint: "paper",
  },
  {
    slug: "como-transformar-artigos-em-carrosseis-repurposing",
    title:
      "Repurposing: como transformar artigo, thread e vídeo em carrossel sem perder a alma",
    excerpt:
      "Cinco fontes de matéria-prima, o processo exato pra cada uma e as regras universais de repurposing pra não parecer que você só traduziu o conteúdo dos outros.",
    date: "2026-04-03",
    readTime: "8 min",
    category: "Produtividade",
    number: 3,
    tint: "green",
  },
  {
    slug: "como-usar-ia-criar-conteudo-redes-sociais",
    title:
      "Como usar IA pra criar conteúdo sem virar um gerador automático de generalidades",
    excerpt:
      "A IA não vai substituir criadores. Criadores que usam IA vão substituir os que não usam. O framework pra integrar sem perder autenticidade.",
    date: "2026-04-02",
    readTime: "9 min",
    category: "IA",
    number: 2,
    tint: "pink",
  },
  {
    slug: "guia-completo-tamanhos-instagram-twitter-linkedin",
    title:
      "Tamanhos de imagem e vídeo 2026: Instagram, X/Twitter e LinkedIn em uma tabela só",
    excerpt:
      "A referência definitiva. Feed, Reels, Stories, capa, perfil, carrossel, ads. Salva essa e nunca mais erre uma dimensão.",
    date: "2026-03-28",
    readTime: "5 min",
    category: "Referência",
    number: 1,
    tint: "ink",
  },
];

// Utilities -------------------------------------------------------------------

export function postBySlug(slug: string): PostMeta | undefined {
  return POSTS_META.find((p) => p.slug === slug);
}

export function relatedPosts(slug: string, limit = 3): PostMeta[] {
  const current = postBySlug(slug);
  if (!current) return POSTS_META.slice(0, limit);

  // Preferência: mesma categoria, mais recentes primeiro, exceto o próprio post
  const sameCat = POSTS_META.filter(
    (p) => p.category === current.category && p.slug !== slug,
  );
  const otherCat = POSTS_META.filter(
    (p) => p.category !== current.category && p.slug !== slug,
  );
  return [...sameCat, ...otherCat].slice(0, limit);
}

export function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const idx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${months[idx]} ${y}`;
}

export const CATEGORIES: PostCategory[] = Array.from(
  new Set(POSTS_META.map((p) => p.category)),
) as PostCategory[];
