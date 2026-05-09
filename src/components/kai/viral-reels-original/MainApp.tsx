/**
 * MainApp — Reels Viral dentro do KAI.
 *
 * Port LITERAL do `code/reels-viral/app/app/page.tsx` preservando estética
 * cream + REC coral + brutalist shadows. Diferença: este componente vive
 * dentro do tab Kai e recebe `clientId` + `client` via props (sem
 * landing/auth wall — o KAI já cuida da autenticação na entrada do app).
 *
 * Adaptações vs. standalone:
 * - removido `"use client"` (Vite)
 * - `next/navigation useSearchParams` → `react-router-dom useSearchParams`
 * - `useNeonSession` / `getJwtToken` → `apiInvoke` (handler `adapt-viral-reel`
 *   já leva JWT do user logado no KAI)
 * - landing flow (sessionStorage PendingBrief, AuthDialog, OAuth redirect)
 *   removido — KAI sempre tem user autenticado
 * - QuotaCard removido (KAI não tem quota por user)
 * - histórico via Supabase `viral_reels` (RLS por user_id) com sidebar à
 *   esquerda mostrando reels já adaptados pro cliente
 * - "Salvar como ideia" e "Salvar na library" expostos como ações no
 *   ResultView, delegando pras mutations de useReelHistory
 *
 * Estética 100% preservada — toda classe rv-* + tokens --color-rv-*
 * vivem em `./styles/globals.css` (escopados em `.rv-scope`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Clipboard,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
import { trackEvent } from "@/lib/analytics";
import type { Client } from "@/hooks/useClients";

import "./styles/globals.css";
import { isValidInstagramUrl } from "./lib/utils";
import type { AdaptBrief, AdaptResponse, ReelRow } from "./types";
import { ResultView } from "./components/result-view";
import { LoadingPipeline } from "./components/loading-pipeline";
import { HistorySidebar } from "./components/history-sidebar";

// KAI multi-tenant integration (Fase A.2 + B):
// - useClientWorkspaceContext: lê tom/persona/refs/concorrentes do cliente
// - ClientContextHeader: banner "Trabalhando em <cliente>" no topo
// - ClientReferencesPanel: thumbs + concorrentes pra inspiração no form
// - useViralContext: consume cross-app bridge (Radar/SV → Reels)
// - localStorage draft: rascunho persistido por cliente (não perde ao trocar)
import { useClientWorkspaceContext } from "@/components/kai/viral/lib/use-client-workspace-context";
import { ClientContextHeader } from "@/components/kai/viral/ClientContextHeader";
import { ClientReferencesPanel } from "@/components/kai/viral/ClientReferencesPanel";
import { AutoSaveIndicator } from "@/components/kai/viral/AutoSaveIndicator";
import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";
import { useViralContext } from "@/store/viral-context";
import { useViralAutoSave } from "@/hooks/useViralAutoSave";

const OBJETIVOS: Array<{
  id: AdaptBrief["objetivo"];
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "leads", label: "Gerar leads", icon: <Target size={14} /> },
  { id: "produto", label: "Vender produto", icon: <Zap size={14} /> },
  {
    id: "seguidores",
    label: "Crescer seguidores",
    icon: <Users size={14} />,
  },
  {
    id: "engajamento",
    label: "Engajamento",
    icon: <TrendingUp size={14} />,
  },
];

interface Props {
  clientId: string;
  client: Client;
}

const REELS_KEY = (clientId: string) => ["viral-reels-original", clientId];

export default function MainApp({ clientId, client }: Props) {
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tema, setTema] = useState("");
  const [objetivo, setObjetivo] =
    useState<AdaptBrief["objetivo"]>("seguidores");
  const [cta, setCta] = useState("");
  const [persona, setPersona] = useState("");
  const [nicho, setNicho] = useState("");
  const [result, setResult] = useState<AdaptResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qc = useQueryClient();
  const userFirstName = useFirstName(client);

  // ── histórico ─────────────────────────────────────────────────────
  const reelsQuery = useQuery<ReelRow[]>({
    queryKey: REELS_KEY(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_reels")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ReelRow[];
    },
    enabled: !!clientId,
  });
  const reels = useMemo(() => reelsQuery.data ?? [], [reelsQuery.data]);
  const selected: ReelRow | null = useMemo(
    () => reels.find((r) => r.id === selectedId) ?? null,
    [reels, selectedId],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("viral_reels").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: REELS_KEY(clientId) });
      if (selectedId === id) {
        setSelectedId(null);
        setStep("form");
      }
      toast.success("Roteiro excluído");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao excluir"),
  });

  const saveAsIdeaMutation = useMutation({
    mutationFn: async (reel: ReelRow) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário autenticado");
      const title = reel.script?.titulo ?? reel.tema;
      const body = [
        `Roteiro adaptado do reel @${reel.source_meta?.ownerUsername ?? "—"}`,
        reel.source_url,
        "",
        `Hook: ${reel.script?.hook ?? ""}`,
        "",
        reel.script?.roteiroCompleto ?? "",
      ].join("\n");
      const { error } = await supabase.from("planning_items").insert([
        {
          client_id: clientId,
          workspace_id: (client as any).workspace_id,
          title,
          content: body,
          status: "idea",
          platform: "instagram",
          created_by: u.user.id,
        },
      ]);
      if (error) throw error;
      return reel.id;
    },
    onSuccess: () => toast.success("Salvo como ideia no Planning"),
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar"),
  });

  const saveToLibraryMutation = useMutation({
    mutationFn: async (reel: ReelRow) => {
      const title = reel.script?.titulo ?? reel.tema;
      const content = [
        `# ${title}`,
        ``,
        `**Hook:** ${reel.script?.hook ?? ""}`,
        ``,
        `## Roteiro completo`,
        reel.script?.roteiroCompleto ?? "",
        ``,
        `## Caption sugerida`,
        reel.script?.captionSugerida ?? "",
        ``,
        `## Cenas`,
        ...(reel.script?.scenes ?? []).map(
          (s) => `- #${s.n} (${s.tempo}) [${s.papel}] ${s.copy}`,
        ),
        ``,
        `Fonte: ${reel.source_url} (@${reel.source_meta?.ownerUsername ?? "—"})`,
      ].join("\n");
      // Mantém em client_content_library (conteúdo gerado pelo cliente,
      // tipo histórico de scripts produzidos)
      const { error: ccError } = await supabase
        .from("client_content_library")
        .insert([
          {
            client_id: clientId,
            title,
            content,
            content_type: "reel_script",
            metadata: {
              source: "viral-reels-original",
              reelId: reel.id,
              sourceUrl: reel.source_url,
              ownerUsername: reel.source_meta?.ownerUsername,
              objetivo: reel.objetivo,
              cta: reel.cta,
            },
          },
        ]);
      if (ccError) throw ccError;

      // PLUS: salva em client_reference_library com format=reel + scenes[]
      // pro ReferenceGalleryDialog renderizar cenas-chave + estrutura.
      // Best-effort — falha não bloqueia.
      const refMeta = {
        format: "reel",
        source: "viral-reels-original",
        reelId: reel.id,
        platform: "instagram",
        source_handle: reel.source_meta?.ownerUsername,
        objetivo: reel.objetivo,
        cta: reel.cta,
        // shape pra RefSceneStrip: { papel, tempo, copy, visual, broll }
        scenes: reel.script?.scenes ?? [],
        script: reel.script,
        analysis: reel.analysis,
        hook: reel.script?.hook,
        transcribed_text: reel.script?.roteiroCompleto,
        tags: ["reel", "engenharia-reversa"],
      };
      await supabase
        .from("client_reference_library")
        .insert([
          {
            client_id: clientId,
            title,
            reference_type: "video_script",
            content,
            source_url: reel.source_url,
            thumbnail_url: reel.source_meta?.displayUrl ?? null,
            metadata: refMeta as any,
          },
        ])
        .then(({ error }) => {
          if (error) console.warn("[reels] ref_library insert failed:", error);
        });

      return reel.id;
    },
    onSuccess: () => toast.success("Salvo na Library + Refs"),
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar"),
  });

  // ── KAI client context (Fase A.2): tom/persona/refs/concorrentes ──
  const { data: clientCtx } = useClientWorkspaceContext(clientId);

  // ── pre-fill nicho/persona com dados do client context ──────────────
  // Source de verdade: client.industry (col da clients table) +
  // client_preferences (persona_age/pain/goal). Hidrata só uma vez por
  // cliente — useRef trava a operação pra não sobrescrever input do user.
  const initialNichoSet = useRef(false);
  const initialPersonaSet = useRef(false);
  useEffect(() => {
    if (!initialNichoSet.current && !nicho && (client as any)?.industry) {
      setNicho((client as any).industry);
      initialNichoSet.current = true;
    }
  }, [client, nicho]);
  useEffect(() => {
    if (initialPersonaSet.current) return;
    if (!clientCtx) return;
    if (persona) {
      // user já mexeu — respeita.
      initialPersonaSet.current = true;
      return;
    }
    const parts: string[] = [];
    if (clientCtx.persona.age) parts.push(clientCtx.persona.age);
    if (clientCtx.persona.pain) parts.push(`dor: ${clientCtx.persona.pain}`);
    if (clientCtx.persona.goal) parts.push(`quer: ${clientCtx.persona.goal}`);
    if (parts.length > 0) {
      setPersona(parts.join(" · "));
      initialPersonaSet.current = true;
    }
  }, [clientCtx, persona]);

  // ── auto-save por cliente via useViralAutoSave (Fase G) ─────────────
  // Key namespacing: `kai-viral-reels-draft-<clientId>`. Trocar de cliente
  // não perde o draft do anterior. Hook centraliza debounce + status
  // ('saving'/'saved'/'error') pro `AutoSaveIndicator`.
  const draftKey = `kai-viral-reels-draft-${clientId}`;
  const draftHydratedRef = useRef(false);
  const draft = useMemo(
    () => ({ sourceUrl, tema, cta, persona, nicho, objetivo }),
    [sourceUrl, tema, cta, persona, nicho, objetivo],
  );
  const autoSave = useViralAutoSave({
    key: draftKey,
    data: draft,
    enabled: !!clientId && step === "form",
    shouldPersist: (d) =>
      d.sourceUrl.trim().length > 0 ||
      d.tema.trim().length > 0 ||
      d.cta.trim().length > 0,
  });
  // Hidratar uma vez por cliente — `restore()` lê do storage. Respeitamos
  // valores que o user já digitou (não sobrescreve).
  useEffect(() => {
    if (draftHydratedRef.current) return;
    if (!clientId) return;
    const restored = autoSave.restore();
    if (restored) {
      if (restored.sourceUrl && !sourceUrl) setSourceUrl(restored.sourceUrl);
      if (restored.tema && !tema) setTema(restored.tema);
      if (restored.cta && !cta) setCta(restored.cta);
      if (restored.persona && !persona) setPersona(restored.persona);
      if (restored.nicho && !nicho) setNicho(restored.nicho);
      if (restored.objetivo) setObjetivo(restored.objetivo);
    }
    draftHydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  // Limpa draft quando user gera com sucesso.
  useEffect(() => {
    if (step === "result" && clientId) {
      autoSave.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, clientId]);

  // ── bridge cross-app via Zustand (Fase B): consume pendingBriefing ──
  // Quando user chega aqui de "→ Reel" no Radar/SV, lê o payload uma vez,
  // popula sourceUrl/tema, e exibe toast indicando origem.
  const consumePending = useViralContext((s) => s.consumePendingBriefing);
  useEffect(() => {
    const pending = consumePending();
    if (!pending || pending.source === "reels") return;
    if (pending.url && isValidInstagramUrl(pending.url)) {
      setSourceUrl(pending.url);
    }
    if (pending.topic && !tema) {
      setTema(pending.topic.slice(0, 280));
    }
    if (pending.briefing && !cta) {
      // briefing vira contexto inicial pra "Ângulo" — user pode limpar.
      setCta(`Ângulo: ${pending.briefing.slice(0, 200)}`);
    }
    const sourceLabel =
      pending.source === "radar" ? "Radar Viral" : "Sequência Viral";
    toast.info(`Briefing trazido do ${sourceLabel}`, {
      description: pending.topic?.slice(0, 80),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── bridge Radar Viral: ?tema= / ?briefing= / ?url= pre-popula form ──
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tema") ?? searchParams.get("topic");
    const b = searchParams.get("briefing");
    const u =
      searchParams.get("url") ??
      searchParams.get("source") ??
      searchParams.get("reel");
    let consumed = false;
    if (u && isValidInstagramUrl(u)) {
      setSourceUrl(u.trim());
      consumed = true;
    }
    if (t && !tema) {
      setTema(t.trim());
      consumed = true;
    }
    if (b && !cta) {
      setCta((c) => c || `Ângulo: ${b}`);
      consumed = true;
    }
    if (consumed) {
      const next = new URLSearchParams(searchParams);
      ["tema", "topic", "briefing", "url", "source", "reel"].forEach((k) =>
        next.delete(k),
      );
      setSearchParams(next, { replace: true });
      toast.info("Briefing puxado do Radar Viral.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidInstagramUrl(text)) {
        setSourceUrl(text);
        toast.success("Link colado");
      } else {
        toast.error("Clipboard não tem URL de Reel válida");
      }
    } catch {
      toast.error("Não consegui ler o clipboard");
    }
  }

  /** Executa a chamada à edge function `adapt-viral-reel`. */
  async function runAdapt(brief: AdaptBrief) {
    setStep("loading");
    setResult(null);
    setSelectedId(null);

    try {
      const { data, error } = await apiInvoke<AdaptResponse>("adapt-viral-reel", {
        body: {
          clientId,
          sourceUrl: brief.sourceUrl.trim(),
          tema: brief.tema.trim(),
          objetivo: brief.objetivo,
          cta: brief.cta.trim(),
          persona: brief.persona?.trim() || undefined,
          nicho: brief.nicho?.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (!data || data.ok === false)
        throw new Error((data as any)?.error ?? "Falha desconhecida");

      trackEvent("reel_analyzed", {
        client_id: clientId,
        objetivo: brief.objetivo,
        tema_length: brief.tema.trim().length,
        has_persona: Boolean(brief.persona?.trim()),
        has_nicho: Boolean(brief.nicho?.trim()),
      });

      setResult(data);
      setStep("result");
      // refresca lista do histórico (handler já persistiu em viral_reels)
      qc.invalidateQueries({ queryKey: REELS_KEY(clientId) });
      if (data.reelId) setSelectedId(data.reelId);
      if ((data as AdaptResponse).cached) {
        toast.info("Reabri o roteiro que você já gerou desse reel (<24h).");
      } else {
        toast.success("Roteiro gerado!");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao gerar roteiro";
      toast.error(msg, { duration: 4500 });
      setStep("form");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidInstagramUrl(sourceUrl)) {
      toast.error("Cola um link de Reel/post Instagram válido");
      return;
    }
    if (tema.trim().length < 3) {
      toast.error("Descreve o tema do TEU vídeo (mínimo 3 chars)");
      return;
    }
    if (cta.trim().length < 2) {
      toast.error("Define o CTA — o que o user vai fazer?");
      return;
    }

    void runAdapt({
      sourceUrl: sourceUrl.trim(),
      tema: tema.trim(),
      objetivo,
      cta: cta.trim(),
      persona: persona.trim() || undefined,
      nicho: nicho.trim() || undefined,
    });
  }

  function handleReset() {
    setStep("form");
    setResult(null);
    setSelectedId(null);
    setSourceUrl("");
    setTema("");
    setCta("");
    setPersona("");
    setNicho("");
  }

  function handleSelectFromHistory(reel: ReelRow) {
    setSelectedId(reel.id);
    if (reel.status === "done" && reel.analysis && reel.script) {
      setResult({
        ok: true,
        reelId: reel.id,
        analysis: reel.analysis,
        script: reel.script,
        sourceMeta: reel.source_meta ?? undefined,
        source: reel.source_meta
          ? { ...reel.source_meta, url: reel.source_meta.url ?? reel.source_url }
          : { url: reel.source_url },
      });
      setStep("result");
    } else {
      // pending/processing/error → mantém form mas marca selectedId
      setStep("form");
    }
  }

  return (
    <div
      className="rv-scope"
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
    >
      {/* KAI: banner contextual com nome/indústria/tom do cliente atual */}
      <ClientContextHeader context={clientCtx ?? null} variant="light" />

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <HistorySidebar
        reels={reels}
        selectedId={selectedId}
        onSelect={handleSelectFromHistory}
        onDelete={(id) => deleteMutation.mutate(id)}
        loading={reelsQuery.isLoading}
      />

      <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.section
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mx-auto"
              style={{
                maxWidth: 1180,
                padding: "clamp(28px, 6vw, 60px) clamp(16px, 4vw, 28px) 100px",
              }}
            >
              {/* HEADER COMPACTO */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 18,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <span className="rv-eyebrow">
                    <span className="rv-rec-dot" /> NOVO REEL · ENGENHARIA REVERSA
                  </span>
                  <h1
                    className="rv-display mt-3"
                    style={{
                      fontSize: "clamp(32px, 4vw, 48px)",
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Olá{userFirstName ? <>, <em>{userFirstName}</em></> : <em></em>}.
                    Cole o link e <em>adapta</em>.
                  </h1>
                </div>
              </div>
              <p
                className="rv-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--color-rv-muted)",
                  marginBottom: 32,
                }}
              >
                Reel viral → análise estrutural → roteiro novo cena por cena
              </p>

              {/* FORM PRINCIPAL */}
              <form
                onSubmit={handleSubmit}
                className="mt-16"
                style={{
                  background: "var(--color-rv-cream)",
                  border: "1.5px solid var(--color-rv-ink)",
                  boxShadow: "8px 8px 0 0 var(--color-rv-ink)",
                  padding: "32px 32px 28px",
                }}
              >
                <div className="rv-eyebrow mb-3">
                  <span className="rv-rec-dot" /> 01 · COLE O LINK DO REEL VIRAL
                </div>
                <div
                  className="flex items-stretch gap-2"
                  style={{
                    border: "1.5px solid var(--color-rv-ink)",
                    background: "white",
                  }}
                >
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    spellCheck={false}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: "16px 18px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      color: "var(--color-rv-ink)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="flex items-center gap-2 px-4"
                    style={{
                      borderLeft: "1.5px solid var(--color-rv-ink)",
                      background: "var(--color-rv-paper)",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    <Clipboard size={14} /> Colar
                  </button>
                </div>

                <div className="mt-7 grid gap-5 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <label className="rv-eyebrow mb-2 block">
                      02 · O TEMA DO SEU VÍDEO
                    </label>
                    <textarea
                      value={tema}
                      onChange={(e) => setTema(e.target.value)}
                      rows={2}
                      placeholder="Ex: ferramenta IA pra editar fotos / consultoria fitness pra mães / newsletter de cripto..."
                      style={{
                        width: "100%",
                        border: "1.5px solid var(--color-rv-ink)",
                        background: "white",
                        padding: "12px 14px",
                        fontFamily: "var(--font-jakarta), sans-serif",
                        fontSize: 14,
                        lineHeight: 1.4,
                        resize: "none",
                        outline: "none",
                        color: "var(--color-rv-ink)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="rv-eyebrow mb-2 block">04 · CTA DESEJADO</label>
                    <textarea
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      rows={2}
                      placeholder="Ex: comenta APP que mando o link / clica no link da bio / manda DM..."
                      style={{
                        width: "100%",
                        border: "1.5px solid var(--color-rv-ink)",
                        background: "white",
                        padding: "12px 14px",
                        fontFamily: "var(--font-jakarta), sans-serif",
                        fontSize: 14,
                        lineHeight: 1.4,
                        resize: "none",
                        outline: "none",
                        color: "var(--color-rv-ink)",
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="rv-eyebrow mb-3 block">
                    03 · OBJETIVO PRINCIPAL
                  </label>
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                    {OBJETIVOS.map((o) => {
                      const active = objetivo === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setObjetivo(o.id)}
                          className="flex items-center justify-center gap-2"
                          style={{
                            border: "1.5px solid var(--color-rv-ink)",
                            background: active
                              ? "var(--color-rv-ink)"
                              : "white",
                            color: active
                              ? "var(--color-rv-cream)"
                              : "var(--color-rv-ink)",
                            padding: "12px 10px",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            boxShadow: active
                              ? "3px 3px 0 0 var(--color-rv-rec)"
                              : "none",
                            transition: "all 120ms",
                          }}
                        >
                          {o.icon} {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 grid gap-5 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <label className="rv-eyebrow mb-2 block">
                      05 · PERSONA / PÚBLICO <span style={{ opacity: 0.6 }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      placeholder="Ex: criadores iniciantes 18-25 anos"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="rv-eyebrow mb-2 block">
                      06 · NICHO <span style={{ opacity: 0.6 }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={nicho}
                      onChange={(e) => setNicho(e.target.value)}
                      placeholder="Ex: marketing digital, finanças, fitness..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <p
                    className="rv-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--color-rv-muted)",
                      maxWidth: 480,
                      lineHeight: 1.6,
                    }}
                  >
                    ⚡ Pipeline: Apify scrape → Gemini transcreve & analisa → roteiro novo
                  </p>
                  <div className="flex items-center gap-3">
                    <AutoSaveIndicator
                      status={autoSave.status}
                      lastSavedAt={autoSave.lastSavedAt}
                      variant="light"
                    />
                    <button type="submit" className="rv-btn rv-btn-rec">
                      <Sparkles size={14} /> Adaptar reel
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </form>

              {/* KAI client refs — concorrentes/library/visual refs como inspiração */}
              {clientCtx && (
                <div className="mt-8">
                  <ClientReferencesPanel context={clientCtx} variant="light" />
                </div>
              )}

              {/* HOW IT WORKS */}
              <section className="mt-24">
                <div className="rv-eyebrow"><span className="rv-rec-dot" /> COMO FUNCIONA</div>
                <h2
                  className="rv-display mt-3"
                  style={{ fontSize: "clamp(34px, 4vw, 52px)" }}
                >
                  Três passos. <em>Trinta segundos.</em>
                </h2>
                <div className="mt-10 grid gap-6 grid-cols-1 md:grid-cols-3">
                  <Step
                    n="01"
                    title="Cola o link"
                    desc="Reel do TikTok/IG que viralizou. Pode ser seu, do concorrente, ou de qualquer criador grande do nicho."
                  />
                  <Step
                    n="02"
                    title="Define o briefing"
                    desc="Tema do TEU vídeo, objetivo (leads/produto/seguidor) e o CTA. A IA mantém a estrutura mas troca o conteúdo."
                  />
                  <Step
                    n="03"
                    title="Recebe o storyboard"
                    desc="Análise estrutural + roteiro cena por cena com tempo, visual, copy falada e nota de B-roll. Grava direto."
                  />
                </div>
              </section>
            </motion.section>
          )}

          {step === "loading" && (
            <motion.section
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto"
              style={{ maxWidth: 720, padding: "120px 28px" }}
            >
              <LoadingPipeline />
            </motion.section>
          )}

          {step === "result" && result && (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mx-auto"
              style={{
                maxWidth: 1280,
                padding: "clamp(20px, 4vw, 40px) clamp(16px, 4vw, 28px) 100px",
              }}
            >
              <ResultView
                data={result}
                tema={tema}
                onReset={handleReset}
                onSaveAsIdea={
                  selected
                    ? () => saveAsIdeaMutation.mutate(selected)
                    : undefined
                }
                onSaveToLibrary={
                  selected
                    ? () => saveToLibraryMutation.mutate(selected)
                    : undefined
                }
                isSavingIdea={saveAsIdeaMutation.isPending}
                isSavingLibrary={saveToLibraryMutation.isPending}
                crossActions={
                  <CrossAppActions
                    source="reels"
                    topic={result.script?.titulo ?? tema}
                    briefing={
                      [
                        result.script?.hook,
                        result.script?.roteiroCompleto,
                      ]
                        .filter(Boolean)
                        .join("\n\n") || undefined
                    }
                    metadata={{
                      reelId: result.reelId,
                      sourceUrl: sourceUrl,
                    }}
                    showReel={false}
                  />
                }
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid var(--color-rv-ink)",
  background: "white",
  padding: "12px 14px",
  fontFamily: "var(--font-jakarta), sans-serif",
  fontSize: 14,
  outline: "none",
  color: "var(--color-rv-ink)",
};

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div
      style={{
        background: "var(--color-rv-cream)",
        border: "1.5px solid var(--color-rv-ink)",
        padding: "28px 26px",
        boxShadow: "5px 5px 0 0 var(--color-rv-ink)",
      }}
    >
      <div
        className="rv-mono"
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: "var(--color-rv-rec)",
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        {n}
      </div>
      <h3
        className="rv-display"
        style={{ fontSize: 26, lineHeight: 1.05, marginBottom: 10 }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--color-rv-muted)",
        }}
      >
        {desc}
      </p>
    </div>
  );
}

/** Tenta primeiro nome do user via supabase.auth — fallback no client.name. */
function useFirstName(client: Client) {
  const [firstName, setFirstName] = useState("");
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancel) return;
        const u = data.user;
        if (!u) {
          setFirstName(((client as any)?.name ?? "").split(" ")[0] ?? "");
          return;
        }
        const nameMeta = (u.user_metadata?.name ?? u.user_metadata?.full_name ?? "") as string;
        if (nameMeta) {
          setFirstName(nameMeta.split(" ")[0]);
        } else if (u.email) {
          setFirstName(u.email.split("@")[0].split(".")[0]);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [client]);
  return firstName;
}
