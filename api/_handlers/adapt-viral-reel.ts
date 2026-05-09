// Migrated from supabase/functions/adapt-viral-reel/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getClientContextServer,
  buildClientPromptContext,
  buildClientHistoricalReferences,
} from '../_lib/shared/client-context.js';
import { checkTokens, debitTokens, VIRAL_TOKEN_COSTS } from '../_lib/shared/tokens.js';

const APIFY_BASE = 'https://api.apify.com/v2';
const APIFY_ACTOR = 'apify~instagram-scraper';
const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `Você é o "Adaptador Viral" — pega um Reel viral existente e gera um Reel NOVO que **REPLICA A ESTRUTURA NARRATIVA EXATA** do original mas com o conteúdo adaptado ao briefing do usuário.

🔒 REGRA #1 INVIOLÁVEL — FIDELIDADE ESTRUTURAL
O reel anexado é a REFERÊNCIA SAGRADA. Você NÃO pode improvisar uma estrutura nova. Você NÃO pode pular direto pra venda. Você DEVE espelhar o original beat por beat.
Pra cada cena do original, você gera UMA cena equivalente no novo reel — mesma função narrativa, mesmo ritmo emocional, mesma duração aproximada.

🔒 REGRA #2 — ADAPTAÇÃO É SÓ DE CONTEÚDO
O QUE muda: nicho, exemplos, números, casos, palavras específicas, CTA final.
O QUE NÃO muda: ordem das cenas, tom emocional, tempo aproximado, recursos narrativos, abertura, fechamento, ritmo.

🔒 REGRA #3 — CADÊNCIA DE CORTES
Conte os cortes do original. Se ele tem 12 cortes em 60s, seu novo reel tem 12 cortes em 60s.

🔒 REGRA #4 — IDIOMA E TOM
Português brasileiro coloquial, com cadência de fala. Use o tom emocional EXATO do original.

🔒 REGRA #5 — CONTEÚDO
- Frase curta. Verbo forte. Concretude > abstração.
- Sem emojis no roteiro falado. Emojis só na caption.
- B-roll gravável: descreva o que FILMAR.
- NUNCA invente métricas, depoimentos ou casos do user.
- O CTA do user vai onde o CTA original estava.

🔒 REGRA #6 — VOCÊ É ENGENHEIRO REVERSO
Não é copywriter. Decifre o código de um reel que funcionou e replique com novo conteúdo.

🔒 REGRA #7 — TRANSCREVA O ORIGINAL
Antes de gerar o script novo, transcreva o áudio falado do reel original em PT-BR (ou idioma da fala) em texto corrido, sem timestamps, no campo \`originalTranscript\`. Se o reel não tiver áudio falado (só música/visual), retorna string vazia. Essa transcrição é REFERÊNCIA pro user comparar — não é o roteiro novo.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        resumo: { type: 'string' },
        porQueViralizou: { type: 'array', items: { type: 'string' } },
        estrutura: {
          type: 'object',
          properties: {
            hook: { type: 'object', properties: { texto: { type: 'string' }, tempo: { type: 'string' } }, required: ['texto', 'tempo'] },
            promessa: { type: 'object', properties: { texto: { type: 'string' }, tempo: { type: 'string' } }, required: ['texto', 'tempo'] },
            demonstracao: { type: 'object', properties: { texto: { type: 'string' }, tempo: { type: 'string' } }, required: ['texto', 'tempo'] },
            provaSocial: { type: 'object', properties: { texto: { type: 'string' }, tempo: { type: 'string' } }, required: ['texto', 'tempo'] },
            cta: { type: 'object', properties: { texto: { type: 'string' }, tempo: { type: 'string' } }, required: ['texto', 'tempo'] },
          },
          required: ['hook', 'promessa', 'demonstracao', 'provaSocial', 'cta'],
        },
        padroesTransferiveis: { type: 'array', items: { type: 'string' } },
      },
      required: ['resumo', 'porQueViralizou', 'estrutura', 'padroesTransferiveis'],
    },
    script: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        hook: { type: 'string' },
        roteiroCompleto: { type: 'string' },
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              n: { type: 'integer' },
              tempo: { type: 'string' },
              papel: { type: 'string', enum: ['hook', 'promessa', 'demo', 'prova', 'transicao', 'cta'] },
              visual: { type: 'string' },
              copy: { type: 'string' },
              broll: { type: 'string' },
            },
            required: ['n', 'tempo', 'papel', 'visual', 'copy'],
          },
        },
        captionSugerida: { type: 'string' },
        notasProducao: { type: 'array', items: { type: 'string' } },
      },
      required: ['titulo', 'hook', 'roteiroCompleto', 'scenes', 'captionSugerida', 'notasProducao'],
    },
    /**
     * Transcrição literal do áudio original (PT-BR ou idioma da fala).
     * Texto corrido, sem timestamps. Serve como referência pro user
     * comparar com o roteiro novo. Best-effort: pode vir vazio se o reel
     * for só visual/musical.
     */
    originalTranscript: { type: 'string' },
  },
  required: ['analysis', 'script'],
};

function extractShortCode(url: string): string | null {
  // Suporta com/sem segmento de username (instagram.com/<user>/reel/<code>).
  const m = url.match(
    /instagram\.com\/(?:[^\/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/,
  );
  return m ? m[1] : null;
}
function isValidIgUrl(url: string): boolean {
  // Aceita reel/reels/p/tv (Apify cobre todos). Validação estrita
  // happens depois (precisa ser type=Video). client-side `isValidInstagramUrl`
  // só aceita reels — esse handler aceita tudo pra dar erro mais claro
  // ("isso é foto/carrossel, cola um reel") em vez de rejeitar de cara.
  return /^https?:\/\/(?:www\.)?instagram\.com\/(?:[^\/]+\/)?(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(
    url,
  );
}

/**
 * Extrai videoUrl do item Apify. Reels normais vêm com `type='Video'` +
 * `videoUrl` direto. Sidecar (carrossel) pode ter primeiro child video,
 * então tentamos `childPosts[0].videoUrl` como fallback.
 */
function pickVideoUrl(item: any): string | null {
  if (item?.videoUrl) return item.videoUrl as string;
  if (item?.type === 'Sidecar' && Array.isArray(item.childPosts)) {
    const firstVideo = item.childPosts.find((c: any) => c?.videoUrl);
    if (firstVideo?.videoUrl) return firstVideo.videoUrl as string;
  }
  return null;
}

async function scrapeReel(sourceUrl: string, apifyKey: string) {
  const endpoint = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyKey}&timeout=60`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [sourceUrl],
      resultsType: 'details',
      resultsLimit: 1,
      addParentData: false,
    }),
  });
  if (!r.ok) {
    throw new Error(`Apify scrape failed [${r.status}]: ${await r.text()}`);
  }
  const items = await r.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Apify retornou vazio. Reel privado, removido ou URL inválida.');
  }
  return items[0];
}

async function uploadToGemini(geminiKey: string, videoBytes: Buffer): Promise<string> {
  const metadata = JSON.stringify({ file: { displayName: `rv-${Date.now()}` } });
  const boundary = '----geminiboundary' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    'utf-8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([head, videoBytes, tail]);

  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'X-Goog-Upload-Protocol': 'multipart',
      },
      body,
    }
  );
  if (!uploadRes.ok) {
    throw new Error(`Gemini upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
  }
  const uploaded = await uploadRes.json();
  let file = uploaded.file;

  let waited = 0;
  while (file.state === 'PROCESSING' && waited < 90_000) {
    await new Promise((r) => setTimeout(r, 2500));
    waited += 2500;
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${file.name.replace('files/', '')}?key=${geminiKey}`
    );
    if (!pollRes.ok) throw new Error(`Gemini poll failed: ${pollRes.status}`);
    file = await pollRes.json();
  }
  if (file.state !== 'ACTIVE') {
    throw new Error(`Gemini file não ficou ACTIVE (state: ${file.state})`);
  }
  return file.uri as string;
}

async function callGemini(geminiKey: string, fileUri: string, briefingText: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri, mimeType: 'video/mp4' } },
              { text: briefingText },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  if (!r.ok) {
    throw new Error(`Gemini generate failed [${r.status}]: ${await r.text()}`);
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini não retornou JSON.');
  return JSON.parse(text);
}

export default authedPost(async ({ user, body }) => {
  const t0 = Date.now();
  const APIFY_KEY = process.env.APIFY_API_KEY_INSTAGRAM || process.env.APIFY_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!APIFY_KEY) throw new Error('APIFY_API_KEY não configurada.');
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada.');

  const { clientId, sourceUrl, tema, objetivo, cta, persona, nicho } = (body || {}) as {
    clientId?: string;
    sourceUrl?: string;
    tema?: string;
    objetivo?: string;
    cta?: string;
    persona?: string;
    nicho?: string;
  };

  if (!clientId || !sourceUrl || !tema || !objetivo || !cta) {
    throw new Error('Campos obrigatórios: clientId, sourceUrl, tema, objetivo, cta');
  }
  if (!isValidIgUrl(sourceUrl)) {
    throw new Error('URL precisa ser de Reel/post Instagram');
  }

  const client = await queryOne<{ workspace_id: string }>(
    `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
    [clientId]
  );
  if (!client) throw new Error('Cliente não encontrado.');

  // Token check (Fase F — 2026-05-08).
  // Reel custa VIRAL_TOKEN_COSTS.reel (default 20). Cron/internal não pagam.
  const tokenCost = VIRAL_TOKEN_COSTS.reel;
  if (client.workspace_id) {
    const status = await checkTokens(client.workspace_id, tokenCost);
    if (!status.ok) {
      const err = new Error(
        `Créditos insuficientes (${status.remaining} disponíveis, ${tokenCost} necessários). Faça upgrade do seu plano.`
      ) as Error & { status?: number; code?: string };
      err.status = 402;
      err.code = 'TOKENS_EXHAUSTED';
      throw err;
    }
  }

  // Multi-tenant context — fail-soft so legacy/empty-tenant clients still work.
  let clientContextBlock = '';
  let historicalBlock = '';
  try {
    const clientContext = await getClientContextServer(clientId);
    clientContextBlock = buildClientPromptContext(clientContext);
    // Usa tema + objetivo como query pra similarity search dos refs históricos.
    const refQuery = [tema, objetivo].filter(Boolean).join(' — ');
    historicalBlock = await buildClientHistoricalReferences(clientContext, refQuery, 2);
  } catch (ctxErr) {
    console.warn('[adapt-viral-reel] context load failed (proceeding without):', ctxErr);
  }

  const shortCode = extractShortCode(sourceUrl);
  const pool = getPool();

  // Dedupe: se já existe um reel `done` desse mesmo cliente + sourceUrl no
  // último 24h, retorna ele direto sem queimar Apify+Gemini+tokens. User
  // que quiser re-rodar deve apagar o item anterior pelo HistorySidebar.
  const existing = await queryOne<{
    id: string;
    source_meta: any;
    analysis: any;
    script: any;
  }>(
    `SELECT id, source_meta, analysis, script
        FROM viral_reels
       WHERE client_id = $1
         AND source_url = $2
         AND status = 'done'
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
    [clientId, sourceUrl],
  );
  if (existing && existing.analysis && existing.script) {
    return {
      ok: true,
      reelId: existing.id,
      analysis: existing.analysis,
      script: existing.script,
      sourceMeta: existing.source_meta ?? undefined,
      cached: true,
    };
  }

  // Insert pending row
  const reelRow = await queryOne<{ id: string }>(
    `INSERT INTO viral_reels
        (client_id, workspace_id, user_id, source_url, source_short_code,
         tema, objetivo, cta, persona, nicho, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'processing')
     RETURNING id`,
    [
      clientId,
      client.workspace_id,
      user.id,
      sourceUrl,
      shortCode,
      tema,
      objetivo,
      cta,
      persona ?? null,
      nicho ?? null,
    ]
  );
  if (!reelRow) throw new Error('Falha ao registrar reel.');
  const reelId = reelRow.id;

  try {
    // 1. Scrape via Apify
    const item = await scrapeReel(sourceUrl, APIFY_KEY);
    const videoUrl = pickVideoUrl(item);
    if (!videoUrl) {
      // type='Image' ou Sidecar sem vídeo → mensagem clara pro user.
      const kind = item?.type ?? 'desconhecido';
      throw new Error(
        kind === 'Image'
          ? 'Esse link é uma FOTO. O Reels Viral só aceita vídeo (reel ou IGTV).'
          : kind === 'Sidecar'
          ? 'Esse link é um CARROSSEL sem vídeo. Cola um reel/post de vídeo.'
          : `Esse post não é vídeo (type=${kind}). Cola um link de Reel.`,
      );
    }

    const sourceMeta = {
      shortCode: item.shortCode,
      ownerUsername: item.ownerUsername,
      ownerFullName: item.ownerFullName,
      caption: item.caption,
      videoDuration: item.videoDuration,
      videoPlayCount: item.videoPlayCount,
      likesCount: item.likesCount,
      commentsCount: item.commentsCount,
      timestamp: item.timestamp,
      videoUrl,
      displayUrl: item.displayUrl,
      url: sourceUrl,
    };

    // 2. Download MP4 (com timeout pra evitar hang no edge function)
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), 45_000);
    let videoBytes: Buffer;
    try {
      const videoRes = await fetch(videoUrl, { signal: dlController.signal });
      if (!videoRes.ok) {
        throw new Error(
          `Download MP4 falhou: ${videoRes.status}. CDN do Instagram pode estar bloqueando — tenta outro reel.`,
        );
      }
      videoBytes = Buffer.from(await videoRes.arrayBuffer());
    } finally {
      clearTimeout(dlTimeout);
    }

    // Guard de tamanho — Gemini File API aguenta até ~2GB mas reels >100MB
    // são raros e geralmente significam vídeo longo (>3min). Cortamos em
    // 100MB pra não estourar timeout do Vercel function (max ~60s/300s).
    const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
    if (videoBytes.byteLength > MAX_VIDEO_BYTES) {
      throw new Error(
        `Vídeo muito grande (${(videoBytes.byteLength / 1024 / 1024).toFixed(0)}MB). Reels Viral aceita até 100MB.`,
      );
    }

    // 3. Upload to Gemini File API
    const fileUri = await uploadToGemini(GEMINI_KEY, videoBytes);

    // 4. Briefing prompt — prepend client context (voz, nicho, persona, refs históricas)
    const contextPreamble = [clientContextBlock, historicalBlock]
      .filter(Boolean)
      .join('\n\n');

    const briefingText = `${contextPreamble ? contextPreamble + '\n\n---\n\n' : ''}BRIEFING DO USUÁRIO:
- Tema: ${tema}
- Objetivo: ${objetivo}
- CTA final: ${cta}
${persona ? `- Persona: ${persona}` : ''}
${nicho ? `- Nicho: ${nicho}` : ''}

CONTEXTO DO REEL ORIGINAL (apenas referência):
- Autor: @${item.ownerUsername ?? 'desconhecido'}
- Caption original: ${item.caption ?? '(sem caption)'}
- Views: ${item.videoPlayCount ?? 'n/a'} · Likes: ${item.likesCount ?? 'n/a'}

Analise o vídeo anexado e gere o JSON conforme schema, ADAPTANDO o conteúdo à voz/nicho/persona do cliente acima.`;

    const result = await callGemini(GEMINI_KEY, fileUri, briefingText);

    // Debit tokens (Fase F) — AFTER gemini success. Failsoft.
    if (client.workspace_id) {
      try {
        await debitTokens(client.workspace_id, tokenCost, 'adapt-viral-reel');
      } catch (debitErr) {
        console.warn('[adapt-viral-reel] debit failed (non-blocking):', debitErr);
      }
    }

    const dur = Date.now() - t0;
    // Stash originalTranscript dentro de source_meta (tabela ainda não tem
    // coluna dedicada — mantemos lean evitando migration). MainApp lê via
    // `reel.source_meta?.originalTranscript`.
    const enrichedMeta = {
      ...sourceMeta,
      originalTranscript: result.originalTranscript ?? null,
    };
    await pool.query(
      `UPDATE viral_reels
          SET source_meta = $1::jsonb,
              analysis = $2::jsonb,
              script = $3::jsonb,
              status = 'done',
              duration_ms = $4
        WHERE id = $5`,
      [
        JSON.stringify(enrichedMeta),
        JSON.stringify(result.analysis),
        JSON.stringify(result.script),
        dur,
        reelId,
      ]
    );

    return {
      ok: true,
      reelId,
      analysis: result.analysis,
      script: result.script,
      sourceMeta: enrichedMeta,
      originalTranscript: result.originalTranscript ?? null,
      durationMs: dur,
    };
  } catch (innerErr: any) {
    const msg = innerErr?.message ?? String(innerErr);
    await pool
      .query(
        `UPDATE viral_reels SET status = 'error', error_message = $1, duration_ms = $2 WHERE id = $3`,
        [msg, Date.now() - t0, reelId]
      )
      .catch(() => {});
    throw innerErr;
  }
});
