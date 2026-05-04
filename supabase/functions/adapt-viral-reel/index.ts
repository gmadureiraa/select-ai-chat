/**
 * adapt-viral-reel
 * ============================================================================
 * Engenharia reversa de um Reel viral. Recebe link IG + briefing, scrapeia o
 * vídeo via Apify, sobe pro Gemini File API e devolve análise + roteiro novo
 * adaptado ao tema/objetivo/CTA do cliente.
 *
 * Adaptado de https://github.com/gmadureiraa/reels-viral (lib/gemini.ts +
 * app/api/adapt-reel/route.ts) pra rodar como Supabase Edge Function dentro
 * do kAI, vinculado a client_id e workspace_id.
 *
 * Input:
 *   {
 *     clientId: string,
 *     sourceUrl: string,         // link Reel IG
 *     tema: string,
 *     objetivo: 'leads'|'produto'|'seguidores'|'engajamento',
 *     cta: string,
 *     persona?: string,
 *     nicho?: string,
 *   }
 *
 * Output:
 *   { ok: true, reelId: string, analysis, script, sourceMeta }
 *
 * Auth: JWT do usuário (auth.getUser).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_ACTOR = "apify~instagram-scraper";
const GEMINI_MODEL = "gemini-2.5-flash";

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
Não é copywriter. Decifre o código de um reel que funcionou e replique com novo conteúdo.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        resumo: { type: "string" },
        porQueViralizou: { type: "array", items: { type: "string" } },
        estrutura: {
          type: "object",
          properties: {
            hook: { type: "object", properties: { texto: { type: "string" }, tempo: { type: "string" } }, required: ["texto", "tempo"] },
            promessa: { type: "object", properties: { texto: { type: "string" }, tempo: { type: "string" } }, required: ["texto", "tempo"] },
            demonstracao: { type: "object", properties: { texto: { type: "string" }, tempo: { type: "string" } }, required: ["texto", "tempo"] },
            provaSocial: { type: "object", properties: { texto: { type: "string" }, tempo: { type: "string" } }, required: ["texto", "tempo"] },
            cta: { type: "object", properties: { texto: { type: "string" }, tempo: { type: "string" } }, required: ["texto", "tempo"] },
          },
          required: ["hook", "promessa", "demonstracao", "provaSocial", "cta"],
        },
        padroesTransferiveis: { type: "array", items: { type: "string" } },
      },
      required: ["resumo", "porQueViralizou", "estrutura", "padroesTransferiveis"],
    },
    script: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        hook: { type: "string" },
        roteiroCompleto: { type: "string" },
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              n: { type: "integer" },
              tempo: { type: "string" },
              papel: { type: "string", enum: ["hook", "promessa", "demo", "prova", "transicao", "cta"] },
              visual: { type: "string" },
              copy: { type: "string" },
              broll: { type: "string" },
            },
            required: ["n", "tempo", "papel", "visual", "copy"],
          },
        },
        captionSugerida: { type: "string" },
        notasProducao: { type: "array", items: { type: "string" } },
      },
      required: ["titulo", "hook", "roteiroCompleto", "scenes", "captionSugerida", "notasProducao"],
    },
  },
  required: ["analysis", "script"],
};

function extractShortCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function isValidIgUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(url);
}

async function scrapeReel(sourceUrl: string, apifyKey: string) {
  const endpoint = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyKey}&timeout=60`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [sourceUrl],
      resultsType: "details",
      resultsLimit: 1,
      addParentData: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify scrape failed [${res.status}]: ${await res.text()}`);
  }
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify retornou vazio. Reel privado, removido ou URL inválida.");
  }
  return items[0];
}

async function uploadToGemini(geminiKey: string, videoBytes: Uint8Array): Promise<string> {
  // Gemini File API — upload multipart
  const metadata = JSON.stringify({ file: { displayName: `rv-${Date.now()}` } });
  const boundary = "----geminiboundary" + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + videoBytes.length + tail.length);
  body.set(head, 0);
  body.set(videoBytes, head.length);
  body.set(tail, head.length + videoBytes.length);

  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "X-Goog-Upload-Protocol": "multipart",
      },
      body,
    },
  );
  if (!uploadRes.ok) {
    throw new Error(`Gemini upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
  }
  const uploaded = await uploadRes.json();
  let file = uploaded.file;

  // Polling até ACTIVE
  let waited = 0;
  while (file.state === "PROCESSING" && waited < 90_000) {
    await new Promise((r) => setTimeout(r, 2500));
    waited += 2500;
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${file.name.replace("files/", "")}?key=${geminiKey}`,
    );
    if (!pollRes.ok) throw new Error(`Gemini poll failed: ${pollRes.status}`);
    file = await pollRes.json();
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini file não ficou ACTIVE (state: ${file.state})`);
  }
  return file.uri as string;
}

async function callGemini(
  geminiKey: string,
  fileUri: string | null,
  inlineData: { mimeType: string; base64: string } | null,
  briefingText: string,
) {
  const parts: any[] = [];
  if (fileUri) parts.push({ fileData: { fileUri, mimeType: "video/mp4" } });
  if (inlineData) parts.push({ inlineData: { mimeType: inlineData.mimeType, data: inlineData.base64 } });
  parts.push({ text: briefingText });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini generate failed [${res.status}]: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini não retornou JSON.");
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APIFY_KEY = Deno.env.get("APIFY_API_KEY_INSTAGRAM") || Deno.env.get("APIFY_API_KEY");
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");

    if (!APIFY_KEY) throw new Error("APIFY_API_KEY não configurada.");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const { clientId, sourceUrl, tema, objetivo, cta, persona, nicho } = body ?? {};

    if (!clientId || !sourceUrl || !tema || !objetivo || !cta) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: clientId, sourceUrl, tema, objetivo, cta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidIgUrl(sourceUrl)) {
      return new Response(JSON.stringify({ error: "URL precisa ser de Reel/post Instagram" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolver workspace do cliente
    const { data: client, error: clientErr } = await admin
      .from("clients").select("workspace_id").eq("id", clientId).single();
    if (clientErr || !client) throw new Error("Cliente não encontrado.");

    const shortCode = extractShortCode(sourceUrl);

    // Insert pending
    const { data: reel, error: insertErr } = await admin
      .from("viral_reels")
      .insert({
        client_id: clientId,
        workspace_id: client.workspace_id,
        user_id: userId,
        source_url: sourceUrl,
        source_short_code: shortCode,
        tema, objetivo, cta,
        persona: persona ?? null,
        nicho: nicho ?? null,
        status: "processing",
      })
      .select("id").single();
    if (insertErr) throw insertErr;
    const reelId = reel.id;

    try {
      // 1. Apify scrape
      const item = await scrapeReel(sourceUrl, APIFY_KEY);
      if (item.type !== "Video" || !item.videoUrl) {
        throw new Error("URL não é um Reel/vídeo. Cola um link de Reel, não foto/carrossel.");
      }

      const sourceMeta = {
        shortCode: item.shortCode,
        ownerUsername: item.ownerUsername,
        caption: item.caption,
        videoDuration: item.videoDuration,
        videoPlayCount: item.videoPlayCount,
        likesCount: item.likesCount,
        commentsCount: item.commentsCount,
        timestamp: item.timestamp,
        videoUrl: item.videoUrl,
        displayUrl: item.displayUrl,
      };

      // 2. Download MP4
      const videoRes = await fetch(item.videoUrl);
      if (!videoRes.ok) throw new Error(`Download MP4 falhou: ${videoRes.status}`);
      const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

      // 3. Upload Gemini (sempre via File API — mais robusto em edge)
      const fileUri = await uploadToGemini(GEMINI_KEY, videoBytes);

      // 4. Briefing prompt
      const briefingText = `BRIEFING DO USUÁRIO:
- Tema: ${tema}
- Objetivo: ${objetivo}
- CTA final: ${cta}
${persona ? `- Persona: ${persona}` : ""}
${nicho ? `- Nicho: ${nicho}` : ""}

CONTEXTO DO REEL ORIGINAL (apenas referência):
- Autor: @${item.ownerUsername ?? "desconhecido"}
- Caption original: ${item.caption ?? "(sem caption)"}
- Views: ${item.videoPlayCount ?? "n/a"} · Likes: ${item.likesCount ?? "n/a"}

Analise o vídeo anexado e gere o JSON conforme schema.`;

      const result = await callGemini(GEMINI_KEY, fileUri, null, briefingText);

      const dur = Date.now() - t0;
      await admin
        .from("viral_reels")
        .update({
          source_meta: sourceMeta,
          analysis: result.analysis,
          script: result.script,
          status: "done",
          duration_ms: dur,
        })
        .eq("id", reelId);

      return new Response(
        JSON.stringify({ ok: true, reelId, analysis: result.analysis, script: result.script, sourceMeta }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerErr: any) {
      const msg = innerErr?.message ?? String(innerErr);
      await admin
        .from("viral_reels")
        .update({ status: "error", error_message: msg, duration_ms: Date.now() - t0 })
        .eq("id", reelId);
      throw innerErr;
    }
  } catch (err: any) {
    console.error("[adapt-viral-reel] error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
