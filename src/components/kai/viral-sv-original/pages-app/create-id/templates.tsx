
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  TEMPLATES_META,
  TemplateRenderer,
  type TemplateId,
} from "@sv/components/app/templates";
import { useAuth } from "@sv/lib/auth-context";
import { supabase } from "@sv/lib/supabase";
import { upsertUserCarousel } from "@sv/lib/carousel-storage";
import { useKaiContext } from "@sv/lib/use-kai-context";
import { buildSVPreviewProfile } from "@sv/lib/client-profile";
import { useDraft } from "@sv/lib/create/use-draft";
import { defaultImagesForTemplate } from "@sv/lib/create/default-images";
import type { SlideVariant } from "@sv/lib/create/types";
import { isAdminEmail } from "@sv/lib/admin-emails";
import { useSVClient } from "../../MainApp";

/**
 * Distribuição narrativa default quando um slide vem sem `variant` (rascunhos
 * antigos ou respostas do Gemini incompletas). Mesma lógica da normalização
 * do lado servidor em `/api/generate/route.ts`.
 */
function fillVariants<T extends { variant?: SlideVariant }>(slides: T[]): T[] {
  const total = slides.length;
  if (total === 0) return slides;
  // BrandsDecoded overhaul (2026-04-22): ritmo fixo solid-brand ↔
  // full-photo-bottom alternando, com text-only em slide denso.
  const rotation: SlideVariant[] = [
    "solid-brand",
    "full-photo-bottom",
    "solid-brand",
    "full-photo-bottom",
    "text-only",
    "solid-brand",
    "full-photo-bottom",
  ];
  return slides.map((s, i) => {
    if (s.variant) return s;
    // Edge case: 1 slide → é capa; 2 slides → capa + CTA.
    if (total === 1) return { ...s, variant: "cover" as const };
    if (i === 0) return { ...s, variant: "cover" as const };
    if (i === total - 1) return { ...s, variant: "cta" as const };
    // Penúltimo: foto cheia.
    if (i === total - 2) return { ...s, variant: "full-photo-bottom" as const };
    return { ...s, variant: rotation[(i - 1) % rotation.length] };
  });
}

/**
 * Tela 02 — Seleção de template. Grid 2×2 com preview REAL dos 4 templates
 * usando os slides do rascunho. Baseado em `v-templates` do handoff.
 */

// 2026-05-18 — paper-mono RESTAURADO (é o `paper-mono-story` tobi validado
// pelo Gabriel em 2026-04-29 — formato preferido pra Madureira). dsec-dark
// removido (Gabriel: DSEC e outros não precisam template custom, usa twitter).
const TEMPLATE_ORDER: TemplateId[] = [
  "twitter",
  "manifesto",
  "futurista",
  "ambitious",
  "blank",
  "bohdan",
  "autoral",
  // Madureira (Gabriel 2026-05-18: SÓ Twitter + madureira-dark Fraunces/Geist)
  "paper-mono",        // mantido no order pra retrocompat de carrosseis salvos
  "serif-duelo",       // idem
  "madureira",         // idem
  "madureira-reflection", // idem
  "madureira-dark",    // ⭐ formato ativo anterior
  "madureira-minimal", // ⭐ formato ativo (2026-05-19) polaroid B&W
  // Defiverso (Gabriel 2026-05-18: SÓ Twitter + defiverso-cripto-dark)
  "defiverso-carrossel",  // mantido pra retrocompat
  "defiverso-cripto-dark", // mantido pra retrocompat
  "defiverso-imagebg",     // ⭐ formato ativo (2026-05-19)
];

const TEMPLATE_DESC: Record<TemplateId, string> = {
  manifesto: "Editorial cinemático · caps dramático · imagem dominante",
  futurista: "Navy + ciano · Space Grotesk · tech-lean (legado)",
  autoral: "Zine · serif itálica · colagem editorial (legado)",
  twitter: "Mockup de tweet · avatar + handle limpo",
  ambitious: "Motivacional · foto moody full-bleed · sans bold altura variável",
  blank: "Editorial educativo · serif Playfair + sans · cada slide um layout",
  bohdan: "Design-forward · B&W contraste alto · serif italic lime · handwritten",
  "paper-mono": "Confessional · cream paper-grain · sans bold + mono · B&W halftone · arco numerado (ref: tobi.the.og)",
  "serif-duelo": "Auditoria editorial · cream parchment + Playfair · duelos FORTE/FRACA + princípio dark (ref: tinnaloaiza)",
  madureira: "Futurista simples · capa IA dominante · navy + accent verde · slides com quadrado 1:1",
  "madureira-reflection": "Texto-puro · 7 layouts DS (capa emoji/type, curva, barras, bullets, reflexão, CTA) · Geist + Fraunces italic accent · zero imagem",
  "madureira-dark": "Dark · Fraunces italic 55pt capa (com emoji/imagem opcional) + Geist 35pt body · centralizado vertical · heart + N/total footer",
  "madureira-minimal": "Polaroid B&W · preto puro + frame branco · Fraunces italic 56 + Geist 21/35 · 3 modos (capa emoji / texto puro / imagem) · pager discreto",
  "dsec-dark": "(deprecated — DSEC usa twitter genérico agora)",
  "defiverso-carrossel": "Defiverso · verde profundo + cream · bullets c/ dado destacado · CTA ManyChat (👽) [v1 newsletter-repurpose]",
  "defiverso-cripto-dark": "Defiverso v2 · dark + foto B&W full-bleed · título multi-cor (laranja/verde) · alien CTA handwritten",
  "defiverso-imagebg": "Defiverso v3 · imagem-fundo full-bleed + frame cream + Aston Serif 72 + setinha ▶ + alien CTA",
};

/**
 * 2026-05-18 — Allowlist por cliente: templates custom só aparecem quando
 * o cliente alvo é selecionado. Evita user pegar template Madureira pra fazer
 * post de outro cliente.
 *
 * Match feito por substring do client.name lowercase (madureira → madureira*,
 * defiverso → defiverso*, dsec → dsec*). null = sem cliente selecionado.
 */
// 2026-05-18 (atualizado pelo Gabriel): cada cliente vê SÓ 2 templates no
// picker — twitter (genérico) + 1 template custom validado. Os antigos
// continuam funcionando pra carrosseis JÁ salvos (não escondidos do switch
// case do renderer) mas não aparecem mais no picker pra novos carrosseis.
const TEMPLATE_CLIENT_ALLOWLIST: Partial<Record<TemplateId, string[]>> = {
  // Madureira — formato ativo: madureira-dark (Fraunces 55 + Geist 35).
  // Os anteriores ficam restritos a [] (= ninguém vê no picker).
  'paper-mono': [],
  'serif-duelo': [],
  madureira: [],
  'madureira-reflection': [],
  'madureira-dark': ['madureira'],
  'madureira-minimal': ['madureira'],
  // Defiverso — formato ativo: defiverso-imagebg (imagem-fundo + Aston Serif).
  // defiverso-cripto-dark mantido pra retrocompat de carrosseis JÁ salvos.
  'defiverso-carrossel': [],
  'defiverso-cripto-dark': [],
  'defiverso-imagebg': ['defiverso'],
  // 'dsec-dark' nem aparece no TEMPLATE_ORDER.
};

function isTemplateAvailableForClient(
  tid: TemplateId,
  clientName: string | null | undefined,
): boolean {
  const entry = TEMPLATE_CLIENT_ALLOWLIST[tid];
  // Sem entry no allowlist = genérico, aparece pra todos.
  if (entry === undefined) return true;
  // Entry com array vazio = template desabilitado pra todos clientes
  // (mantido só pra retrocompat de carrosseis salvos).
  if (entry.length === 0) return false;
  const name = (clientName ?? '').toLowerCase();
  return entry.some((needle) => name.includes(needle));
}

const TEMPLATE_NAME_OVERRIDE: Partial<Record<TemplateId, string>> = {
  manifesto: "Futurista",
};

/**
 * Templates em dev — visíveis no picker com badge "em breve" mas NÃO
 * selecionáveis pra usuários comuns. Admin (gf.madureiraa@gmail.com etc)
 * pode usar normalmente, sem badge — pra testar antes de soltar geral.
 *
 * Decisão Gabriel 28/04: APENAS Twitter público por enquanto. Os outros 4
 * templates (Manifesto/Futurista, Ambição, Editorial Blank, Bohdan)
 * voltam pro modo beta-only-admin pra estabilizar antes de liberar geral.
 */
const COMING_SOON_BASE: Partial<Record<TemplateId, true>> = {
  manifesto: true,
  ambitious: true,
  blank: true,
  bohdan: true,
  "paper-mono": true,
  futurista: true,
  autoral: true,
};

export default function TemplatesPage(props: {
  params: ({ id: string });
}) {
  const { id } = (props.params as unknown as { id: string });
  const router = useRouter();
  const { user, profile } = useAuth();
  const kaiCtx = useKaiContext();
  const { client } = useSVClient();
  const { draft, loading, error } = useDraft(id);

  const [selected, setSelected] = useState<TemplateId | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = isAdminEmail(user?.email);
  // Admin ignora badges "em breve" — pode usar todos os templates pra
  // validar antes de liberar pra geral.
  const COMING_SOON: Partial<Record<TemplateId, true>> = isAdmin
    ? {}
    : COMING_SOON_BASE;

  useEffect(() => {
    if (draft?.visualTemplate) setSelected(draft.visualTemplate);
  }, [draft]);

  const previewProfile = useMemo(
    () => buildSVPreviewProfile(client, profile),
    [client, profile]
  );

  const slides = draft?.slides ?? [];

  async function handleContinue() {
    if (!selected) {
      toast.error("Escolha um template antes de continuar.");
      return;
    }
    if (!user || !supabase || !draft) return;
    setSaving(true);
    try {
      // Pré-popula imagens default do template, respeitando URLs que o usuário
      // já tenha definido (imageUrl existente prevalece). Também aplica
      // distribuição narrativa de `variant` em slides que vieram sem um.
      const defaults = defaultImagesForTemplate(selected, draft.slides.length);
      const withVariants = fillVariants(draft.slides);
      const slidesWithImages = withVariants.map((s, i) => ({
        ...s,
        imageUrl: s.imageUrl && s.imageUrl.trim() ? s.imageUrl : defaults[i],
      }));

      await upsertUserCarousel(supabase, user.id, {
        id: draft.id,
        title: draft.title,
        slides: slidesWithImages,
        slideStyle: draft.style === "dark" ? "dark" : "white",
        status: "draft",
        visualTemplate: selected,
        workspaceId: kaiCtx.workspaceId,
        clientId: kaiCtx.clientId,
      });
      router.push(`/app/create/${draft.id}/edit?template=${selected}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar template.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Carregando rascunho...
        </p>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <p style={{ color: "var(--sv-ink)" }}>{error ?? "Rascunho não encontrado."}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200 }}
    >
      <span className="sv-eyebrow">
        <span className="sv-dot" /> Passo 02 · Escolher template
      </span>

      <h1
        className="sv-display mt-4"
        style={{
          fontSize: "clamp(38px, 6vw, 56px)",
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
        }}
      >
        Escolha o <em>tratamento</em>{" "}
        <span
          style={{
            background: "var(--sv-green)",
            padding: "0 10px",
            fontStyle: "italic",
          }}
        >
          visual
        </span>
        .
      </h1>
      <p
        className="mt-2"
        style={{
          color: "var(--sv-muted)",
          fontSize: 15,
          lineHeight: 1.55,
          maxWidth: 620,
        }}
      >
        Clique em um template pra selecionar. O preview abaixo mostra os
        slides reais do seu carrossel em cada estética — pode trocar a
        qualquer momento sem perder o conteúdo.
      </p>

      {/* Grid 2x2 com previews REAIS */}
      <div
        className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2"
      >
        {TEMPLATE_ORDER.filter((tplId) =>
          // 2026-05-18 — Filtragem em camadas:
          // 1. Allowlist por cliente (mais específico): só mostra template
          //    custom quando o cliente correto está ativo. Aplica pra todos
          //    (admin incluído) — separação por cliente é semântica, não
          //    permissão.
          isTemplateAvailableForClient(tplId, client?.name),
        )
          // 2026-05-19 — Skip IDs que foram arquivados (não estão mais em
          // TEMPLATES_META). Retrocompat: carrosseis salvos com esse ID
          // ainda renderizam (fallback pra Twitter no TemplateRenderer).
          .filter((tplId) => TEMPLATES_META.some((m) => m.id === tplId))
          .map((tplId) => {
          const meta = TEMPLATES_META.find((m) => m.id === tplId)!;
          const isOn = selected === tplId;
          const comingSoon = Boolean(COMING_SOON[tplId]);
          const sample = slides.slice(0, 3);
          return (
            <button
              key={tplId}
              type="button"
              onClick={() => {
                if (comingSoon) {
                  toast.info("Template em breve — tô ajustando os detalhes.");
                  return;
                }
                setSelected(tplId);
              }}
              className="relative text-left"
              style={{
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: isOn
                  ? "6px 6px 0 0 var(--sv-green)"
                  : "3px 3px 0 0 var(--sv-ink)",
                overflow: "hidden",
                cursor: comingSoon ? "not-allowed" : "pointer",
                transition: "transform .15s, box-shadow .15s",
                transform: isOn ? "translate(-2px,-2px)" : "translate(0,0)",
                opacity: comingSoon ? 0.55 : 1,
              }}
            >
              {isOn && !comingSoon && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "2.5px solid var(--sv-green)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
              {comingSoon && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    zIndex: 3,
                    padding: "6px 10px",
                    background: "var(--sv-ink)",
                    color: "var(--sv-paper)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    border: "1.5px solid var(--sv-ink)",
                    boxShadow: "2px 2px 0 0 var(--sv-green)",
                  }}
                >
                  Em breve
                </div>
              )}

              {/* Preview stack com 3 slides reais, offset + rotate */}
              <div
                style={{
                  position: "relative",
                  padding: 18,
                  background: "var(--sv-soft)",
                  height: 280,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 1080 * 0.22 * 3 * 0.33,
                    height: 1350 * 0.22,
                  }}
                >
                  {sample.map((slide, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: i * 26,
                        transform: `rotate(${(i - 1) * 2.2}deg)`,
                        boxShadow: "4px 4px 0 0 rgba(10,10,10,0.15)",
                      }}
                    >
                      <TemplateRenderer
                        templateId={tplId}
                        heading={slide.heading || "Sample"}
                        body={slide.body || ""}
                        imageUrl={slide.imageUrl}
                        slideNumber={i + 1}
                        totalSlides={slides.length || 3}
                        profile={previewProfile}
                        style={draft.style === "dark" ? "dark" : "white"}
                        scale={0.22}
                        showFooter={false}
                        accentOverride={draft.accentOverride}
                        displayFontOverride={draft.displayFont}
                        textScale={draft.textScale}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div
                className="flex items-start justify-between gap-4"
                style={{
                  padding: "18px 22px",
                  borderTop: "1.5px solid var(--sv-ink)",
                  background: "var(--sv-paper)",
                }}
              >
                <div className="min-w-0">
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                      marginBottom: 4,
                      fontWeight: 700,
                    }}
                  >
                    {meta.kicker}
                  </div>
                  <h3
                    className="sv-display"
                    style={{
                      fontSize: 24,
                      letterSpacing: "-0.01em",
                      marginBottom: 4,
                    }}
                  >
                    {TEMPLATE_NAME_OVERRIDE[tplId] ?? meta.name}
                  </h3>
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9.5,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                      maxWidth: 320,
                      lineHeight: 1.5,
                    }}
                  >
                    {TEMPLATE_DESC[tplId]}
                  </div>
                </div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: isOn ? "var(--sv-green)" : "var(--sv-white)",
                    border: "1.5px solid var(--sv-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: "var(--sv-display)",
                    fontStyle: "italic",
                    color: "var(--sv-ink)",
                  }}
                >
                  {isOn ? "✓" : "→"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Nav actions */}
      <div
        className="mt-8 flex flex-wrap items-center justify-between gap-3"
        style={{ paddingTop: 22, borderTop: "1.5px solid var(--sv-ink)" }}
      >
        <button
          type="button"
          className="sv-btn sv-btn-outline"
          onClick={() => router.push(`/app/create/${draft.id}/edit`)}
        >
          ← Voltar pro editor
        </button>
        <div className="flex items-center gap-3">
          {selected && draft.visualTemplate && selected !== draft.visualTemplate && (
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--sv-pink)",
              }}
            >
              ✱ Trocando de {TEMPLATE_NAME_OVERRIDE[draft.visualTemplate] ?? draft.visualTemplate} →{" "}
              {TEMPLATE_NAME_OVERRIDE[selected] ?? selected}
            </span>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || saving}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "14px 22px",
              fontSize: 11.5,
              opacity: !selected || saving ? 0.55 : 1,
              cursor: !selected || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Salvando..."
              : selected && draft.visualTemplate && selected !== draft.visualTemplate
                ? "Aplicar template e continuar →"
                : "Continuar pro editor →"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
