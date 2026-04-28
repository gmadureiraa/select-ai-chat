/**
 * generate-viral-carousel
 * ============================================================================
 * Motor central de geração de carrosséis Twitter-style. Chamado por:
 *   - UI manual (Sequência Viral) via supabase.functions.invoke
 *   - Tool createViralCarousel do KAI Chat
 *   - process-automations quando content_type === 'viral_carousel'
 *
 * Input:
 *   {
 *     clientId: string,
 *     briefing: string,
 *     tone?: string,
 *     slideCount?: number (default 8),
 *     profile?: { name, handle, avatarUrl? },
 *     persistAs?: 'planning' | 'carousel' | 'both' | 'none'  (default 'carousel')
 *     title?: string,
 *     source?: 'manual' | 'automation' | 'chat'  (default 'manual'),
 *     automationId?: string  (opcional, pra metadata)
 *   }
 *
 * Output:
 *   {
 *     ok: true,
 *     slides: ViralSlide[],
 *     carouselId?: string,
 *     planningItemId?: string,
 *   }
 *
 * Auth: requer JWT do usuário (a menos que chamado internamente com service role
 * via cabeçalho `x-internal-call: true` + service role key como Authorization).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

const TARGET_SLIDES_DEFAULT = 8;

interface ViralProfile {
  name: string;
  handle: string;
  avatarUrl?: string;
}

interface ViralSlide {
  id: string;
  order: number;
  body: string;
  image:
    | { kind: "none" }
    | { kind: "search"; query: string; url: string; attribution?: string };
}

/**
 * Faz cache da imagem do RSS no Storage (bucket social-images) pra evitar
 * URLs que expiram. Retorna a URL pública do storage ou a original em caso
 * de falha (não bloqueia o pipeline).
 */
async function cacheCoverImage(
  supabase: ReturnType<typeof createClient>,
  sourceUrl: string,
  clientId: string,
): Promise<string> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return sourceUrl;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return sourceUrl; // skip empty/huge
    const path = `viral-covers/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("social-images").upload(path, buf, {
      contentType: ct,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.warn("[generate-viral-carousel] cover cache upload failed:", error.message);
      return sourceUrl;
    }
    const { data } = supabase.storage.from("social-images").getPublicUrl(path);
    return data?.publicUrl ?? sourceUrl;
  } catch (err) {
    console.warn("[generate-viral-carousel] cover cache failed:", err);
    return sourceUrl;
  }
}

interface RequestBody {
  clientId: string;
  briefing: string;
  tone?: string;
  slideCount?: number;
  profile?: ViralProfile;
  persistAs?: "planning" | "carousel" | "both" | "none";
  title?: string;
  source?: "manual" | "automation" | "chat";
  automationId?: string;
  /** Se fornecido, vira a imagem do slide 1 (renderizada abaixo do texto). */
  coverImageUrl?: string | null;
  coverImageAttribution?: string | null;
}

function buildPrompt(briefing: string, slideCount: number, tone?: string): string {
  return [
    `Você vai gerar um carrossel de ${slideCount} slides estilo tweet sobre o tema abaixo.`,
    "Cada slide é UM tweet completo — texto livre com **palavras em negrito** pra destacar trechos-chave.",
    "",
    `TEMA/BRIEFING: ${briefing}`,
    tone ? `\nTOM: ${tone}` : "",
    "",
    "REGRAS DOS SLIDES:",
    `- ${slideCount} slides no total, cada um com até ~280 caracteres (pode respirar em 2-3 parágrafos curtos).`,
    "- Slide 1 (capa): hook irresistível + promessa. Pode ter uma palavra forte em **negrito**.",
    `- Slides 2-${slideCount - 1}: UM insight por slide. Pense em tweet de thread — direto ao ponto, 1-3 frases. Destaque o termo-chave com **negrito**.`,
    `- Slide ${slideCount} (CTA): chamada clara pra ação (comentar, salvar, compartilhar, seguir).`,
    "- Linguagem informal, direta, em pt-BR. Nada genérico ou corporativo.",
    "- Use **negrito** em 1-3 palavras por slide pra criar hierarquia visual.",
    "- NÃO use hashtags (é carrossel, não post solto).",
    "- NÃO numere os slides no texto — a numeração é automática.",
    "- NÃO comece com \"Slide X:\" nem títulos separados — o texto é um bloco só.",
    "",
    "FORMATO DE SAÍDA: APENAS um array JSON válido, sem texto antes nem depois.",
    "Cada item: { \"body\": string }   ← apenas o campo body, sem heading.",
    "",
    "Exemplo:",
    '[{"body":"Ninguém te conta isso sobre **self-custody**, mas aqui vai: você não é o dono do seu Bitcoin até ter as chaves."},{"body":"**Erro 1:** manter na exchange esperando \\"ficar mais fácil\\". Exchange quebra, seu Bitcoin vai junto."}]',
    "",
    `Agora gera os ${slideCount} slides pro tema acima.`,
  ].filter(Boolean).join("\n");
}

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function emptySlide(order: number): ViralSlide {
  return {
    id: `slide_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    order,
    body: "",
    image: { kind: "none" },
  };
}

function normalizeSlides(raw: unknown[], target: number): ViralSlide[] {
  const slides: ViralSlide[] = [];
  for (let i = 0; i < raw.length && i < target; i++) {
    const item = raw[i] as { body?: string; text?: string; content?: string; heading?: string; title?: string };
    const body = item.body ?? item.text ?? item.content ?? "";
    const heading = item.heading ?? item.title;
    let finalBody = typeof body === "string" ? body.trim() : "";
    if (typeof heading === "string" && heading.trim() && finalBody && !finalBody.startsWith("**")) {
      finalBody = `**${heading.trim()}**\n\n${finalBody}`;
    } else if (typeof heading === "string" && heading.trim() && !finalBody) {
      finalBody = `**${heading.trim()}**`;
    }
    slides.push({ ...emptySlide(i + 1), body: finalBody });
  }
  while (slides.length < target) slides.push(emptySlide(slides.length + 1));
  return slides;
}

/**
 * Chama kai-content-agent (non-streaming) com retry exponencial em 5xx/timeout.
 * Tentativas: 0s, 2s, 5s. Timeout por tentativa: 90s. Total worst-case ~4.5min.
 */
async function callContentAgent(
  supabaseUrl: string,
  authHeader: string,
  apiKey: string,
  clientId: string,
  prompt: string,
): Promise<string> {
  const RETRIES = [0, 2000, 5000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < RETRIES.length; attempt++) {
    if (RETRIES[attempt] > 0) {
      console.log(`[generate-viral-carousel] retry ${attempt} in ${RETRIES[attempt]}ms`);
      await new Promise((r) => setTimeout(r, RETRIES[attempt]));
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: apiKey,
        },
        body: JSON.stringify({
          clientId,
          request: prompt,
          format: "twitter",
          platform: "twitter",
          stream: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        // 5xx → retry; 4xx → fail fast
        if (res.status >= 500 && attempt < RETRIES.length - 1) {
          lastErr = new Error(`kai-content-agent ${res.status}: ${errText.slice(0, 200)}`);
          console.warn(`[generate-viral-carousel] attempt ${attempt + 1} failed: ${lastErr.message}`);
          continue;
        }
        throw new Error(`kai-content-agent ${res.status}: ${errText.slice(0, 300)}`);
      }

      const json = await res.json().catch(() => ({}));
      const content = typeof json?.content === "string" ? json.content : "";
      if (!content) {
        if (attempt < RETRIES.length - 1) {
          lastErr = new Error("kai-content-agent retornou conteúdo vazio");
          continue;
        }
        throw lastErr ?? new Error("kai-content-agent retornou conteúdo vazio");
      }
      return content;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRIES.length - 1) {
        console.warn(`[generate-viral-carousel] attempt ${attempt + 1} threw:`, lastErr.message);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("kai-content-agent falhou em todas as tentativas");
}

async function resolveDraftColumnId(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<string | null> {
  const { data: preferred } = await supabase
    .from("kanban_columns")
    .select("id, column_type, position")
    .eq("workspace_id", workspaceId)
    .in("column_type", ["draft", "idea"])
    .order("position", { ascending: true })
    .limit(1);
  if (preferred && preferred.length > 0) return preferred[0].id as string;
  const { data: first } = await supabase
    .from("kanban_columns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .limit(1);
  return first && first.length > 0 ? (first[0].id as string) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const isInternal = req.headers.get("x-internal-call") === "true";

    const body = (await req.json()) as RequestBody;
    const {
      clientId,
      briefing,
      tone,
      slideCount = TARGET_SLIDES_DEFAULT,
      profile,
      persistAs = "carousel",
      title,
      source = "manual",
      automationId,
      coverImageUrl,
      coverImageAttribution,
    } = body;

    if (!clientId || !briefing) {
      return new Response(
        JSON.stringify({ ok: false, error: "clientId e briefing são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cliente Supabase com permissões adequadas
    const supabase = isInternal
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });

    // Resolve workspace_id e user_id
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, workspace_id, avatar_url, social_media")
      .eq("id", clientId)
      .single();
    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userId: string | null = null;
    if (isInternal) {
      // Em automações: usa created_by da automation (cliente passa via service role context)
      // Caller passa userId como parte do body ou via metadata; aqui pegamos do client owner como fallback
      const { data: ownerRow } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", client.workspace_id)
        .single();
      userId = ownerRow?.owner_id ?? null;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id ?? null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sem user_id pra persistir" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Geração via kai-content-agent
    const prompt = buildPrompt(briefing, slideCount, tone);
    const agentAuthHeader = isInternal
      ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      : authHeader;
    const rawText = await callContentAgent(
      SUPABASE_URL,
      agentAuthHeader,
      SUPABASE_ANON_KEY,
      clientId,
      prompt,
    );

    const arr = extractJsonArray(rawText);
    if (!arr) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Não consegui extrair JSON do KAI agent",
          raw: rawText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const slides = normalizeSlides(arr, slideCount);

    // Aplica imagem ao slide 1 APENAS quando há imagem real (RSS/scrape).
    // Padrão Madureira: imagem fica abaixo do texto (não como cover/overlay).
    // Sem imagem real → slide text-only (não geramos mais SVG fallback indigo).
    if (slides.length > 0 && coverImageUrl) {
      const cachedUrl = await cacheCoverImage(supabase, coverImageUrl, clientId);
      slides[0] = {
        ...slides[0],
        image: {
          kind: "search",
          query: title ?? briefing.slice(0, 60),
          url: cachedUrl,
          attribution: coverImageAttribution ?? undefined,
        },
      };
    }

    const finalProfile: ViralProfile = profile ?? {
      name: client.name as string,
      handle: `@${(client.name as string).toLowerCase().replace(/\s+/g, "")}`,
      avatarUrl: (client.avatar_url as string) ?? undefined,
    };
    const finalTitle = title ?? briefing.slice(0, 60);

    let carouselId: string | undefined;
    let planningItemId: string | undefined;

    // Persiste planning_item PRIMEIRO se solicitado, pra poder vincular ID no carousel
    if (persistAs === "planning" || persistAs === "both") {
      const columnId = await resolveDraftColumnId(supabase, client.workspace_id as string);
      const { data: pi, error: piErr } = await supabase
        .from("planning_items")
        .insert({
          workspace_id: client.workspace_id,
          client_id: clientId,
          column_id: columnId,
          title: finalTitle,
          content: slides.map((s, i) => `=== Slide ${i + 1} ===\n${s.body}`).join("\n\n"),
          platform: "instagram", // carousel costuma ir pro IG; user pode mudar
          content_type: "viral_carousel",
          status: "draft",
          created_by: userId,
          metadata: {
            source: source === "automation" ? "automation:viral_carousel" : `kai:${source}:viral_carousel`,
            content_type: "viral_carousel",
            viral_carousel_briefing: briefing,
            viral_carousel_tone: tone ?? null,
            viral_carousel_slides: slides,
            automation_id: automationId ?? null,
          },
        })
        .select("id")
        .single();
      if (piErr) {
        console.error("[generate-viral-carousel] planning insert failed:", piErr);
        return new Response(
          JSON.stringify({ ok: false, error: `Falha planning_items: ${piErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      planningItemId = pi.id as string;
    }

    if (persistAs === "carousel" || persistAs === "both") {
      const { data: car, error: carErr } = await supabase
        .from("viral_carousels")
        .insert({
          client_id: clientId,
          workspace_id: client.workspace_id,
          user_id: userId,
          title: finalTitle,
          briefing,
          tone: tone ?? null,
          template: "twitter",
          profile: finalProfile as unknown as never,
          slides: slides as unknown as never,
          status: "draft",
          source,
          planning_item_id: planningItemId ?? null,
        })
        .select("id")
        .single();
      if (carErr) {
        console.error("[generate-viral-carousel] carousel insert failed:", carErr);
        return new Response(
          JSON.stringify({ ok: false, error: `Falha viral_carousels: ${carErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      carouselId = car.id as string;

      // Linka de volta no planning_item
      if (planningItemId) {
        await supabase
          .from("planning_items")
          .update({
            metadata: {
              source: source === "automation" ? "automation:viral_carousel" : `kai:${source}:viral_carousel`,
              content_type: "viral_carousel",
              viral_carousel_id: carouselId,
              viral_carousel_briefing: briefing,
              viral_carousel_tone: tone ?? null,
              viral_carousel_slides: slides,
              automation_id: automationId ?? null,
            },
          })
          .eq("id", planningItemId);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        slides,
        carouselId: carouselId ?? null,
        planningItemId: planningItemId ?? null,
        profile: finalProfile,
        title: finalTitle,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-viral-carousel] fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
