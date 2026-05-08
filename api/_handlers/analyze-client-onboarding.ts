// Migrated from supabase/functions/analyze-client-onboarding/index.ts
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';

const ClientDataSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  description: z.string().optional(),
  segment: z.string().optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  objectives: z.string().optional(),
  socialMedia: z
    .object({
      instagram: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      youtube: z.string().optional(),
      tiktok: z.string().optional(),
      website: z.string().optional(),
      newsletter: z.string().optional(),
    })
    .optional(),
  websites: z.array(z.string()).optional(),
  documentContents: z.array(z.string()).optional(),
});

const BodySchema = z.object({
  clientData: ClientDataSchema,
});

interface ClientData {
  name: string;
  description?: string;
  segment?: string;
  tone?: string;
  audience?: string;
  objectives?: string;
  socialMedia?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
    newsletter?: string;
  };
  websites?: string[];
  documentContents?: string[];
}

const ANALYSIS_TOOL = {
  name: 'generate_client_analysis',
  description: 'Gera uma análise estruturada completa do cliente',
  parameters: {
    type: 'object',
    properties: {
      executive_summary: {
        type: 'string',
        description: 'Resumo executivo de 2-3 frases sobre a empresa/marca',
      },
      visual_identity: {
        type: 'object',
        properties: {
          colors: { type: 'array', items: { type: 'string' } },
          typography: { type: 'array', items: { type: 'string' } },
          style: { type: 'string' },
        },
        required: ['colors', 'typography', 'style'],
      },
      tone_of_voice: {
        type: 'object',
        properties: {
          primary: { type: 'string' },
          secondary: { type: 'array', items: { type: 'string' } },
          avoid: { type: 'array', items: { type: 'string' } },
        },
        required: ['primary', 'secondary', 'avoid'],
      },
      target_audience: {
        type: 'object',
        properties: {
          demographics: {
            type: 'object',
            properties: {
              age: { type: 'string' },
              role: { type: 'string' },
              location: { type: 'string' },
            },
          },
          psychographics: { type: 'array', items: { type: 'string' } },
        },
        required: ['demographics', 'psychographics'],
      },
      objectives: { type: 'array', items: { type: 'string' } },
      content_themes: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'executive_summary',
      'visual_identity',
      'tone_of_voice',
      'target_audience',
      'objectives',
      'content_themes',
      'recommendations',
    ],
  },
};

async function extractBranding(url: string, apiKey: string): Promise<any> {
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['branding'] }),
    });
    if (!r.ok) {
      console.error('[analyze-client-onboarding] firecrawl branding error:', r.status);
      return null;
    }
    const data = await r.json();
    return data.data?.branding || data.branding || null;
  } catch (err) {
    console.error('[analyze-client-onboarding] branding exception:', err);
    return null;
  }
}

async function scrapeWebsite(url: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const md = data.data?.markdown || data.markdown;
    return md ? md.substring(0, 8000) : null;
  } catch (err) {
    console.error('[analyze-client-onboarding] scrape exception:', err);
    return null;
  }
}

async function generateAnalysisWithAI(
  clientData: ClientData,
  branding: any,
  websiteContent: string | null
) {
  const systemPrompt = `Você é um especialista em branding, marketing digital e estratégia de conteúdo.
Sua tarefa é analisar profundamente todos os dados fornecidos sobre um cliente e gerar uma análise estruturada completa.
Seja específico e baseie suas análises nos materiais reais fornecidos.
Use "[Não identificado]" apenas se realmente não houver dados suficientes.
Responda SEMPRE em português brasileiro.`;

  const brandingInfo = branding
    ? `
IDENTIDADE VISUAL EXTRAÍDA:
- Cores: ${JSON.stringify(branding.colors || {})}
- Tipografia: ${JSON.stringify(branding.fonts || branding.typography || [])}
- Logo: ${branding.logo || branding.images?.logo || 'Não encontrado'}
- Estilo: ${branding.colorScheme || 'Não identificado'}
`
    : 'Identidade visual não disponível.';

  const websiteInfo = websiteContent
    ? `
CONTEÚDO DO WEBSITE:
${websiteContent}
`
    : 'Conteúdo do website não disponível.';

  const documentsInfo =
    clientData.documentContents && clientData.documentContents.length > 0
      ? `
DOCUMENTOS DO CLIENTE (${clientData.documentContents.length} documentos):
${clientData.documentContents.join('\n\n---\n\n').substring(0, 5000)}
`
      : 'Nenhum documento disponível.';

  const userPrompt = `Analise este cliente e gere uma análise completa:

DADOS BÁSICOS:
- Nome: ${clientData.name}
- Descrição: ${clientData.description || 'Não informada'}
- Segmento: ${clientData.segment || 'Não informado'}
- Tom de voz desejado: ${clientData.tone || 'Não informado'}
- Público-alvo: ${clientData.audience || 'Não informado'}
- Objetivos: ${clientData.objectives || 'Não informados'}

REDES SOCIAIS:
- Instagram: ${clientData.socialMedia?.instagram || 'N/A'}
- LinkedIn: ${clientData.socialMedia?.linkedin || 'N/A'}
- Twitter: ${clientData.socialMedia?.twitter || 'N/A'}
- YouTube: ${clientData.socialMedia?.youtube || 'N/A'}
- TikTok: ${clientData.socialMedia?.tiktok || 'N/A'}
- Website: ${clientData.socialMedia?.website || 'N/A'}
- Newsletter: ${clientData.socialMedia?.newsletter || 'N/A'}

${brandingInfo}

${websiteInfo}

${documentsInfo}

Gere uma análise estruturada usando a função generate_client_analysis.`;

  const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (GOOGLE_API_KEY) {
    const model = 'gemini-2.5-flash';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          tools: [{ functionDeclarations: [ANALYSIS_TOOL] }],
          toolConfig: {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: [ANALYSIS_TOOL.name],
            },
          },
        }),
      }
    );
    if (!r.ok) {
      const t = await r.text();
      console.error('[analyze-client-onboarding] google error:', r.status, t);
      if (r.status === 429) throw new Error('Limite de requisições do Google atingido (429)');
      throw new Error(`Google API error: ${r.status}`);
    }
    const json = await r.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const fc = parts.find((p: any) => p?.functionCall)?.functionCall;
    if (!fc?.args) throw new Error('IA não retornou a análise estruturada');
    return fc.args;
  } else if (OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{ type: 'function', function: ANALYSIS_TOOL }],
        tool_choice: { type: 'function', function: { name: ANALYSIS_TOOL.name } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('[analyze-client-onboarding] openai error:', r.status, t);
      if (r.status === 429) throw new Error('Limite de requisições da OpenAI atingido (429)');
      throw new Error(`OpenAI error: ${r.status}`);
    }
    const json = await r.json();
    const tool = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!tool?.function?.arguments) throw new Error('IA não retornou a análise estruturada');
    return JSON.parse(tool.function.arguments);
  }

  throw new Error('Nenhuma chave de IA configurada (GOOGLE_AI_STUDIO_API_KEY/OPENAI_API_KEY)');
}

export default authedPost(async ({ body }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  const clientData = parsed.data.clientData as ClientData;

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  let branding: any = null;
  let websiteContent: string | null = null;

  const websiteUrl = clientData.socialMedia?.website || clientData.websites?.[0];
  if (websiteUrl && firecrawlApiKey) {
    const [b, c] = await Promise.all([
      extractBranding(websiteUrl, firecrawlApiKey),
      scrapeWebsite(websiteUrl, firecrawlApiKey),
    ]);
    branding = b;
    websiteContent = c;
  }

  const analysisData = await generateAnalysisWithAI(clientData, branding, websiteContent);

  const sourcesAnalyzed = {
    website: !!websiteContent,
    branding: !!branding,
    documents: clientData.documentContents?.length || 0,
    social_profiles: Object.entries(clientData.socialMedia || {})
      .filter(([_k, v]) => v)
      .map(([k]) => k),
  };

  const visualIdentity = {
    colors: analysisData.visual_identity?.colors || [],
    typography: analysisData.visual_identity?.typography || [],
    style: analysisData.visual_identity?.style || 'Não identificado',
    logo_url: branding?.logo || branding?.images?.logo,
  };

  if (visualIdentity.colors.length === 0 && branding?.colors) {
    const colors = branding.colors;
    if (colors.primary) visualIdentity.colors.push(colors.primary);
    if (colors.secondary) visualIdentity.colors.push(colors.secondary);
    if (colors.accent) visualIdentity.colors.push(colors.accent);
  }

  const analysis = {
    generated_at: new Date().toISOString(),
    executive_summary: analysisData.executive_summary,
    visual_identity: visualIdentity,
    tone_of_voice: analysisData.tone_of_voice,
    target_audience: analysisData.target_audience,
    objectives: analysisData.objectives,
    content_themes: analysisData.content_themes,
    recommendations: analysisData.recommendations,
    sources_analyzed: sourcesAnalyzed,
  };

  return { success: true, analysis };
});
