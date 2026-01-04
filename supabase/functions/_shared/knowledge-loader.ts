// =====================================================
// CARREGADOR DE DOCUMENTAÇÃO DE AGENTES E FORMATOS
// Versão 2.0 - Carrega do banco de dados kai_documentation
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Interface para documentação
interface KaiDocumentation {
  id: string;
  doc_type: 'format' | 'agent' | 'flow';
  doc_key: string;
  title: string;
  content: string;
  summary: string | null;
  checklist: string[];
  metadata: Record<string, unknown>;
}

// Cache em memória para documentos já carregados (por sessão da edge function)
const docsCache: Map<string, KaiDocumentation> = new Map();

// Mapeamento de aliases para chaves canônicas
const FORMAT_KEY_ALIASES: Record<string, string> = {
  "newsletter": "newsletter",
  "blog_post": "blog_post",
  "blogpost": "blog_post",
  "carousel": "carousel",
  "carrossel": "carousel",
  "thread": "thread",
  "tweet": "tweet",
  "linkedin_post": "linkedin_post",
  "linkedin": "linkedin_post",
  "stories": "stories",
  "story": "stories",
  "storie": "stories",
  "short_video": "short_video",
  "reels": "short_video",
  "tiktok": "short_video",
  "shorts": "short_video",
  "long_video": "long_video",
  "youtube": "long_video",
  "x_article": "x_article",
  "artigo_x": "x_article",
  "artigo": "x_article",
  "instagram_post": "instagram_post",
  "post_instagram": "instagram_post",
  "post": "instagram_post",
  "email": "email_marketing",
  "email_marketing": "email_marketing",
};

const AGENT_KEY_ALIASES: Record<string, string> = {
  "researcher": "researcher",
  "pesquisador": "researcher",
  "writer": "content_writer",
  "escritor": "content_writer",
  "content_writer": "content_writer",
  "editor": "editor",
  "reviewer": "reviewer",
  "revisor": "reviewer",
  "strategist": "strategist",
  "estrategista": "strategist",
  "metrics_analyst": "metrics_analyst",
  "analista": "metrics_analyst",
  "design_agent": "design_agent",
  "designer": "design_agent",
  "email_developer": "email_developer",
};

// Criar cliente Supabase para edge functions
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Busca documentação do banco de dados
 */
async function fetchDocumentation(
  docType: 'format' | 'agent',
  docKey: string
): Promise<KaiDocumentation | null> {
  const cacheKey = `${docType}_${docKey}`;
  
  // Verificar cache primeiro
  if (docsCache.has(cacheKey)) {
    return docsCache.get(cacheKey)!;
  }
  
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('*')
      .eq('doc_type', docType)
      .eq('doc_key', docKey)
      .single();
    
    if (error || !data) {
      console.log(`[KNOWLEDGE-LOADER] Doc not found: ${docType}/${docKey}`);
      return null;
    }
    
    const doc: KaiDocumentation = {
      id: data.id,
      doc_type: data.doc_type,
      doc_key: data.doc_key,
      title: data.title,
      content: data.content,
      summary: data.summary,
      checklist: data.checklist || [],
      metadata: data.metadata || {},
    };
    
    // Cachear
    docsCache.set(cacheKey, doc);
    
    return doc;
  } catch (err) {
    console.error(`[KNOWLEDGE-LOADER] Error fetching ${docType}/${docKey}:`, err);
    return null;
  }
}

/**
 * Normaliza a chave do formato
 */
function normalizeFormatKey(contentType: string): string {
  const normalized = contentType.toLowerCase().replace(/-/g, "_").trim();
  return FORMAT_KEY_ALIASES[normalized] || normalized;
}

/**
 * Normaliza a chave do agente
 */
function normalizeAgentKey(agentId: string): string {
  const normalized = agentId.toLowerCase().replace(/-/g, "_").trim();
  return AGENT_KEY_ALIASES[normalized] || normalized;
}

/**
 * Carrega documentação de um agente específico
 */
export async function getAgentDocs(agentId: string): Promise<string> {
  const normalizedKey = normalizeAgentKey(agentId);
  
  const doc = await fetchDocumentation('agent', normalizedKey);
  
  if (doc) {
    return doc.content;
  }
  
  // Fallback para documentação embeddada básica
  return getFallbackAgentDocs(normalizedKey);
}

/**
 * Carrega documentação de um formato específico
 */
export async function getFormatDocs(contentType: string): Promise<string> {
  const normalizedKey = normalizeFormatKey(contentType);
  
  const doc = await fetchDocumentation('format', normalizedKey);
  
  if (doc) {
    return doc.content;
  }
  
  // Fallback para documentação embeddada básica
  return getFallbackFormatDocs(normalizedKey);
}

/**
 * Carrega checklist de validação de um formato
 */
export async function getFormatChecklist(contentType: string): Promise<string[]> {
  const normalizedKey = normalizeFormatKey(contentType);
  
  const doc = await fetchDocumentation('format', normalizedKey);
  
  return doc?.checklist || [];
}

/**
 * Monta o contexto completo de documentação para um agente
 * baseado no tipo de conteúdo sendo criado
 */
export async function buildAgentContext(agentId: string, contentType: string): Promise<string> {
  const agentDocs = await getAgentDocs(agentId);
  const formatDocs = await getFormatDocs(contentType);
  
  let context = "";
  
  if (agentDocs) {
    context += `# DIRETRIZES DO AGENTE\n\n${agentDocs}\n\n`;
  }
  
  // Só adiciona docs de formato para agentes que criam conteúdo
  const contentAgents = ["writer", "escritor", "content_writer", "editor", "reviewer", "revisor"];
  if (formatDocs && contentAgents.includes(agentId.toLowerCase())) {
    context += `# REGRAS DO FORMATO\n\n${formatDocs}\n\n`;
  }
  
  return context;
}

/**
 * Limpa o cache de documentos
 */
export function clearDocsCache(): void {
  docsCache.clear();
}

/**
 * Retorna lista de formatos disponíveis
 */
export async function getAvailableFormats(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('doc_key')
      .eq('doc_type', 'format');
    
    if (error || !data) return Object.values(FORMAT_KEY_ALIASES);
    
    return data.map(d => d.doc_key);
  } catch {
    return Object.values(FORMAT_KEY_ALIASES);
  }
}

/**
 * Retorna lista de agentes disponíveis
 */
export async function getAvailableAgents(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('doc_key')
      .eq('doc_type', 'agent');
    
    if (error || !data) return Object.values(AGENT_KEY_ALIASES);
    
    return data.map(d => d.doc_key);
  } catch {
    return Object.values(AGENT_KEY_ALIASES);
  }
}

// =====================================================
// FALLBACKS - Documentação básica caso banco falhe
// =====================================================

function getFallbackAgentDocs(agentKey: string): string {
  const fallbacks: Record<string, string> = {
    "researcher": `## AGENTE PESQUISADOR
Analise materiais disponíveis. Use APENAS dados fornecidos. Seja objetivo e factual.`,
    
    "content_writer": `## AGENTE ESCRITOR
Crie conteúdo seguindo: 1) Identidade do cliente 2) Formato solicitado 3) Biblioteca como referência.
NUNCA use linguagem genérica de IA. SEMPRE adapte ao tom do cliente.`,
    
    "editor": `## AGENTE EDITOR
Refine o conteúdo para soar EXATAMENTE como o cliente. Compare com exemplos reais.
O leitor não deve perceber que foi escrito por IA.`,
    
    "reviewer": `## AGENTE REVISOR
Retorne APENAS o conteúdo final. NÃO inclua comentários ou explicações.
Apenas o conteúdo pronto para publicação.`,
    
    "strategist": `## AGENTE ESTRATEGISTA
Baseie estratégias em dados. Seja específico e acionável. KPIs mensuráveis.`,
    
    "design_agent": `## AGENTE DE DESIGN
Crie prompts que replicam EXATAMENTE o estilo visual do cliente.
Use cores e referências da marca.`,
    
    "metrics_analyst": `## AGENTE ANALISTA
Analise dados objetivamente. Forneça insights acionáveis.`,
  };
  
  return fallbacks[agentKey] || fallbacks["content_writer"];
}

function getFallbackFormatDocs(formatKey: string): string {
  const fallbacks: Record<string, string> = {
    "thread": `## FORMATO: THREAD (TWITTER/X)
- 5-15 tweets, max 280 chars cada
- Tweet 1 com 🧵 no final
- Numerar: 1/X, 2/X
- Último tweet pede RT do primeiro`,
    
    "stories": `## FORMATO: STORIES (INSTAGRAM)
- 3-7 stories, max 50 palavras cada
- Indicar sequência (1/5, 2/5...)
- Formato vertical 9:16
- Último story com CTA`,
    
    "carousel": `## FORMATO: CARROSSEL
- 7-10 slides, max 30 palavras cada
- Slide 1 = gancho impactante
- Último slide com CTA`,
    
    "newsletter": `## FORMATO: NEWSLETTER
- Assunto max 50 chars
- Parágrafos curtos
- 1 CTA principal`,
    
    "tweet": `## FORMATO: TWEET
- Max 280 caracteres
- Uma ideia por tweet`,
    
    "linkedin_post": `## FORMATO: LINKEDIN
- Gancho nas 2 primeiras linhas
- Tom profissional mas humano
- Terminar com pergunta`,
    
    "instagram_post": `## FORMATO: POST INSTAGRAM
- Primeira linha = gancho
- 5-10 hashtags no final`,
    
    "email_marketing": `## FORMATO: EMAIL MARKETING
- Assunto max 50 chars
- 1 CTA repetido 2-3x`,
    
    "blog_post": `## FORMATO: BLOG POST
- Título max 60 chars
- Hierarquia H2/H3
- 1.500-2.000 palavras`,
    
    "x_article": `## FORMATO: ARTIGO X
- Título max 100 chars
- Tom opinativo
- 1.500-4.000 palavras`,
  };
  
  return fallbacks[formatKey] || "";
}
