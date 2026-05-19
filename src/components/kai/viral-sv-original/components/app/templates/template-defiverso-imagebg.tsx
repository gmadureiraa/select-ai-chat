
import { forwardRef } from "react";
import * as React from "react";
import type { SlideProps } from "./types";
import {
  resolveImgSrc,
  renderRichText,
  CANVAS_W,
  CANVAS_H,
  MONO_STACK,
} from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template 13 — Defiverso ImageBG
 *
 * Carrossel Defiverso "imagem-fundo + editorial frame". Inspirado no feed
 * real do @defiverso (refs do Canva 2026-05-19):
 *
 *   01. CAPA — imagem full-bleed cover, logo Defiverso topo (branco),
 *       título Aston Serif 72 bottom-centralizado, body Poppins 29,
 *       setinha "▶" inferior direita.
 *   02-N. INNER — imagem de fundo + frame interno cream (border 32px),
 *       logo Defiverso topo, imagem destacada terço superior (opcional),
 *       título "Nº NOME" estilo Aston 72 c/ números em cor accent,
 *       bloco de texto Poppins 29 com **bold**. Setinha "▶" no canto.
 *   LAST. CTA — fundo preto sólido, frame branco interno, logo topo,
 *       texto grande branco c/ **bold**, alien 👽 mascote, "COMENTA AÍ"
 *       handwritten rotacionado. Sem setinha.
 *
 * Props extras vs SlideProps padrão (mapeados por convenção):
 *  - `imageUrl`     → URL imagem de fundo (capa/inner) ou imagem destacada inner
 *  - `bgColor`      → escurece fundo via overlay; mas controle dedicado é
 *                     `accentOverride` (hack reutilizando prop existente):
 *                     ⚠️ TODO: adicionar `backgroundDarken` (0-100) e
 *                     `titleColor` ('white'|'green'|'black') no SlideProps.
 *                     Por ora reutiliza `accentOverride` pra cor do título
 *                     (default = `#FFFFFF`, ou hex custom passado pelo editor).
 *  - `displayFontOverride` → override Aston Serif (Antic Slab fallback)
 *
 * NOTA SOBRE FONTES — "Aston" não está disponível por Google Fonts. Stack
 * usada: "Antic Slab" (Google), "Playfair Display" (Google), fallback serif.
 * Gabriel pode comprar Aston Serif depois e adicionar via @font-face.
 *
 * Paleta:
 *   - Cream paper  `#F5F1E8`
 *   - Black        `#0A0908`
 *   - White        `#FFFFFF`
 *   - Green accent `#7CF067` (verde alien Defiverso)
 */

const CREAM = "#F5F1E8";
const BLACK = "#0A0908";
const WHITE = "#FFFFFF";
const GREEN_ACCENT = "#7CF067";

const DEFAULT_DISPLAY =
  '"Aston Serif", "Antic Slab", "Playfair Display", "Cormorant Garamond", "Times New Roman", serif';
const BODY_STACK =
  '"Poppins", "SVInter", "Inter", "Helvetica Neue", system-ui, sans-serif';
const HAND_STACK =
  '"Caveat", "Permanent Marker", "Bradley Hand", cursive';

// Ciclo de cores pra título inner: número fica em verde quando título é branco
function pickTitleColors(titleColor: string): { main: string; accent: string } {
  if (titleColor === GREEN_ACCENT || titleColor.toLowerCase() === "green") {
    return { main: GREEN_ACCENT, accent: WHITE };
  }
  if (titleColor === BLACK || titleColor.toLowerCase() === "black") {
    return { main: BLACK, accent: GREEN_ACCENT };
  }
  // default white
  return { main: WHITE, accent: GREEN_ACCENT };
}

const TemplateDefiversoImageBG = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateDefiversoImageBG(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      isLastSlide,
      scale = 0.38,
      exportMode = false,
      accentOverride,
      displayFontOverride,
      textScale = 1,
      variant,
      bgColor,
      layers,
    },
    ref,
  ) {
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const hasImage = Boolean(bodyImgSrc);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    // Convenções de override usando props existentes do SlideProps:
    // - bgColor: hex `#RRGGBB[AA]` — quando começa com `#000000` no alpha,
    //   tratamos como overlay darken (ver TODO acima)
    // - accentOverride: cor do título (default white)
    const titleColorRaw = accentOverride || WHITE;
    const { main: titleMain, accent: titleNumberAccent } =
      pickTitleColors(titleColorRaw);

    // Background darken: aceita rgba do bgColor (alpha custom) ou parse
    // de "darken:NN" hack. Por simplicidade: se bgColor for um rgba com
    // alpha, usa esse rgba como overlay direto.
    const darkenOverlay = parseDarkenOverlay(bgColor);

    const displayStack = displayFontOverride || DEFAULT_DISPLAY;

    const ts = Math.max(0.6, Math.min(1.6, textScale));

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && !isCover);
    // Tudo que não for capa/CTA = inner

    const FS_COVER_TITLE = 72 * ts;
    const FS_COVER_BODY = 29 * ts;
    const FS_INNER_TITLE = 72 * ts;
    const FS_INNER_BODY = 29 * ts;
    const FS_CTA_BODY = 44 * ts;
    const FS_LOGO = 28 * ts;
    const FS_HAND = 64 * ts;

    return (
      <div
        className="flex-shrink-0"
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          ref={ref}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: isCta ? BLACK : BLACK, // base preto pra qualquer modo
            color: WHITE,
            boxSizing: "border-box",
            overflow: "hidden",
            fontFamily: BODY_STACK,
          }}
        >
          {isCover ? (
            <CoverSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              displayStack={displayStack}
              titleMain={titleMain}
              titleNumberAccent={titleNumberAccent}
              darkenOverlay={darkenOverlay}
              FS_TITLE={FS_COVER_TITLE}
              FS_BODY={FS_COVER_BODY}
              FS_LOGO={FS_LOGO}
            />
          ) : isCta ? (
            <CtaSlide
              heading={heading}
              body={body}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              FS_BODY={FS_CTA_BODY}
              FS_LOGO={FS_LOGO}
              FS_HAND={FS_HAND}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              hasImage={hasImage}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              displayStack={displayStack}
              titleMain={titleMain}
              titleNumberAccent={titleNumberAccent}
              darkenOverlay={darkenOverlay}
              FS_TITLE={FS_INNER_TITLE}
              FS_BODY={FS_INNER_BODY}
              FS_LOGO={FS_LOGO}
            />
          )}
        </div>
      </div>
    );
  },
);

/* ============================================================
 * COVER — imagem full-bleed + logo topo + título bottom-centralizado
 * ============================================================ */
function CoverSlide({
  heading,
  body,
  imageUrl,
  hasImage,
  showTitle,
  showBody,
  showBg,
  displayStack,
  titleMain,
  titleNumberAccent,
  darkenOverlay,
  FS_TITLE,
  FS_BODY,
  FS_LOGO,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  hasImage: boolean;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  displayStack: string;
  titleMain: string;
  titleNumberAccent: string;
  darkenOverlay: string | null;
  FS_TITLE: number;
  FS_BODY: number;
  FS_LOGO: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Imagem fundo full bleed */}
      {showBg && hasImage && (
        <MediaTag
          src={imageUrl!}
          alt={heading}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {/* Fallback sem imagem */}
      {showBg && !hasImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #1A2E1F 0%, #0A0908 100%)`,
          }}
        />
      )}
      {/* Overlay darken */}
      {darkenOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: darkenOverlay,
          }}
        />
      )}
      {/* Gradient bottom pra legibilidade do título */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "60%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,9,8,0.0) 30%, rgba(10,9,8,0.55) 75%, rgba(10,9,8,0.85) 100%)",
        }}
      />

      {/* Logo Defiverso topo */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <DefiversoWordmark color={WHITE} fontSize={FS_LOGO} />
      </div>

      {/* Título bottom-centralizado */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 70,
          right: 70,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 2,
        }}
      >
        {showTitle && heading && (
          <h1
            style={{
              fontFamily: displayStack,
              fontSize: FS_TITLE,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.01em",
              margin: 0,
              color: titleMain,
              textAlign: "center",
              textShadow: "0 4px 24px rgba(0,0,0,0.5)",
            }}
          >
            {renderRichText(heading, titleNumberAccent)}
          </h1>
        )}
        {showBody && body && (
          <p
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.4,
              margin: 0,
              color: WHITE,
              textAlign: "center",
              maxWidth: 820,
              fontWeight: 400,
              whiteSpace: "pre-line",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {renderRichText(body, GREEN_ACCENT)}
          </p>
        )}
      </div>

      {/* Setinha "▶" inferior direita */}
      <ArrowBadge />
    </div>
  );
}

/* ============================================================
 * INNER — imagem fundo + frame cream + bloco texto e imagem
 * ============================================================ */
function InnerSlide({
  heading,
  body,
  imageUrl,
  hasImage,
  showTitle,
  showBody,
  showBg,
  displayStack,
  titleMain,
  titleNumberAccent,
  darkenOverlay,
  FS_TITLE,
  FS_BODY,
  FS_LOGO,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  hasImage: boolean;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  displayStack: string;
  titleMain: string;
  titleNumberAccent: string;
  darkenOverlay: string | null;
  FS_TITLE: number;
  FS_BODY: number;
  FS_LOGO: number;
}) {
  // Heurística: se a heading começa com "1° ", "2° ", "Nº 1", número solto etc,
  // separa o número (accent color) do resto (main color)
  const { numberToken, titleRest } = splitNumberFromTitle(heading);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Imagem fundo full bleed */}
      {showBg && hasImage && (
        <MediaTag
          src={imageUrl!}
          alt={heading}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {showBg && !hasImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: BLACK,
          }}
        />
      )}
      {/* Overlay darken */}
      {darkenOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: darkenOverlay,
          }}
        />
      )}

      {/* Frame interno (gap ~32px) — borda branca translúcida */}
      <div
        style={{
          position: "absolute",
          inset: 32,
          border: `2px solid rgba(255,255,255,0.85)`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Logo Defiverso topo */}
      <div
        style={{
          position: "absolute",
          top: 72,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <DefiversoWordmark color={WHITE} fontSize={FS_LOGO} />
      </div>

      {/* Bloco título + body — terço inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 90,
          right: 90,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 28,
          zIndex: 2,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: FS_TITLE,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              margin: 0,
              color: titleMain,
              textAlign: "left",
              textShadow: "0 4px 18px rgba(0,0,0,0.55)",
            }}
          >
            {numberToken && (
              <span
                style={{
                  color: titleNumberAccent,
                  fontStyle: "italic",
                  marginRight: 12,
                }}
              >
                {numberToken}
              </span>
            )}
            {renderRichText(titleRest, titleNumberAccent)}
          </h2>
        )}
        {showBody && body && (
          <p
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.45,
              margin: 0,
              color: WHITE,
              maxWidth: 880,
              fontWeight: 400,
              whiteSpace: "pre-line",
              textShadow: "0 2px 10px rgba(0,0,0,0.65)",
            }}
          >
            {renderRichText(body, GREEN_ACCENT)}
          </p>
        )}
      </div>

      {/* Setinha "▶" inferior direita */}
      <ArrowBadge />
    </div>
  );
}

/* ============================================================
 * CTA — fundo preto + frame branco + alien mascote + handwritten
 * ============================================================ */
function CtaSlide({
  heading,
  body,
  showTitle,
  showBody,
  displayStack,
  FS_BODY,
  FS_LOGO,
  FS_HAND,
}: {
  heading: string;
  body: string;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  FS_BODY: number;
  FS_LOGO: number;
  FS_HAND: number;
}) {
  const ctaHead = heading || "comenta aí 👇";
  const ctaBody =
    body ||
    "Manda esse pro amigo que ainda **não tá ligado** no que tá rolando no mercado cripto.";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: BLACK,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Frame interno */}
      <div
        style={{
          position: "absolute",
          inset: 32,
          border: `2px solid rgba(255,255,255,0.85)`,
          pointerEvents: "none",
        }}
      />

      {/* Logo Defiverso topo */}
      <div
        style={{
          position: "absolute",
          top: 72,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <DefiversoWordmark color={WHITE} fontSize={FS_LOGO} />
      </div>

      {/* Conteúdo central */}
      <div
        style={{
          position: "absolute",
          inset: "180px 90px 180px 90px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          textAlign: "center",
        }}
      >
        {showTitle && (
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.015em",
              margin: 0,
              color: WHITE,
              maxWidth: 820,
            }}
          >
            {renderRichText(ctaHead, GREEN_ACCENT)}
          </h2>
        )}

        {/* Alien mascote */}
        <AlienMascot size={220} />

        {showBody && (
          <p
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.42,
              margin: 0,
              color: WHITE,
              maxWidth: 780,
              fontWeight: 400,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(ctaBody, GREEN_ACCENT)}
          </p>
        )}
      </div>

      {/* "COMENTA AÍ" rotacionado */}
      <div
        style={{
          position: "absolute",
          bottom: 110,
          right: 90,
          transform: "rotate(-8deg)",
          fontFamily: HAND_STACK,
          fontSize: FS_HAND,
          color: GREEN_ACCENT,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textShadow: "0 2px 12px rgba(124,240,103,0.25)",
        }}
      >
        COMENTA AÍ
      </div>
    </div>
  );
}

/* ============================================================
 * Componentes auxiliares
 * ============================================================ */

/** Wordmark "DEFIVERSO" simples — fallback até ter SVG do logo real. */
function DefiversoWordmark({
  color,
  fontSize,
}: {
  color: string;
  fontSize: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        fontFamily: MONO_STACK,
        fontSize,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        fontWeight: 700,
        color,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: GREEN_ACCENT,
          boxShadow: `0 0 12px ${GREEN_ACCENT}`,
        }}
      />
      DEFIVERSO
    </div>
  );
}

/** Botão circular "▶" branco no canto inferior direito (próxima página). */
function ArrowBadge() {
  return (
    <div
      style={{
        position: "absolute",
        right: 70,
        bottom: 70,
        width: 84,
        height: 84,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        zIndex: 3,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 5L19 12L8 19V5Z"
          fill={BLACK}
        />
      </svg>
    </div>
  );
}

/** Alien mascote — placeholder simples em SVG (verde alien). */
function AlienMascot({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {/* Cabeça */}
      <ellipse cx="100" cy="100" rx="68" ry="80" fill={GREEN_ACCENT} />
      {/* Olhos */}
      <ellipse cx="78" cy="100" rx="14" ry="22" fill={BLACK} />
      <ellipse cx="122" cy="100" rx="14" ry="22" fill={BLACK} />
      {/* Brilho olhos */}
      <ellipse cx="82" cy="92" rx="4" ry="6" fill={WHITE} />
      <ellipse cx="126" cy="92" rx="4" ry="6" fill={WHITE} />
      {/* Boca */}
      <path
        d="M 80 140 Q 100 152, 120 140"
        stroke={BLACK}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

/**
 * Separa o "número" do começo do título (ex: "1° PETER TODD" → number="1°"
 * + rest="PETER TODD"). Suporta formatos: "1°", "1º", "Nº 1", "01.", "#1".
 */
function splitNumberFromTitle(title: string): {
  numberToken: string | null;
  titleRest: string;
} {
  if (!title) return { numberToken: null, titleRest: "" };
  const t = title.trimStart();
  // 1° / 1º / 2° etc
  const ordMatch = t.match(/^(\d+\s*[°º])\s+(.*)/);
  if (ordMatch) return { numberToken: ordMatch[1], titleRest: ordMatch[2] };
  // Nº 1 / N° 01
  const nMatch = t.match(/^(N[°º]\s*\d+)\s+(.*)/i);
  if (nMatch) return { numberToken: nMatch[1], titleRest: nMatch[2] };
  // 01. ALGUMA COISA
  const dotMatch = t.match(/^(\d{1,2}\.)\s+(.*)/);
  if (dotMatch) return { numberToken: dotMatch[1], titleRest: dotMatch[2] };
  // #1 ALGUMA COISA
  const hashMatch = t.match(/^(#\d+)\s+(.*)/);
  if (hashMatch) return { numberToken: hashMatch[1], titleRest: hashMatch[2] };
  return { numberToken: null, titleRest: title };
}

/**
 * Parse overlay darken a partir de bgColor.
 * Hack: bgColor pode ser uma rgba escura (ex: "rgba(0,0,0,0.45)") que vai
 * ser usada como overlay sobre a imagem de fundo.
 *
 * TODO: trocar por prop dedicada `backgroundDarken: number` (0-100).
 */
function parseDarkenOverlay(bgColor?: string): string | null {
  if (!bgColor) return null;
  const c = bgColor.trim().toLowerCase();
  // Reconhece rgba com alpha < 1
  const rgba = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)/);
  if (rgba) {
    const [, , , , a] = rgba;
    if (Number(a) < 1) return bgColor;
  }
  // Reconhece sintaxe própria "darken:NN" (0-100)
  const dk = c.match(/^darken:(\d+)$/);
  if (dk) {
    const pct = Math.max(0, Math.min(100, Number(dk[1])));
    return `rgba(0,0,0,${(pct / 100).toFixed(2)})`;
  }
  return null;
}

/* ============================================================
 * TODO — controles do editor (edit.tsx)
 * ============================================================
 *
 * Quando templateId === "defiverso-imagebg", o editor deveria mostrar:
 *
 *   1. Color picker do título: pills branco / verde / preto
 *      → mapeia pra `accentOverride` (white | #7CF067 | #0A0908)
 *
 *   2. Slider 0-100 "escurecer fundo"
 *      → seta `bgColor = "darken:NN"` ou `rgba(0,0,0,NN/100)`
 *      → renderer pega via parseDarkenOverlay()
 *
 *   3. Upload de imagem de fundo
 *      → já existe (campo imageUrl) — só precisa abrir UI no editor
 *
 *   4. Toggle highlight words (já funciona via **bold** no body)
 *
 * Local: src/components/kai/viral-sv-original/pages-app/create-id/edit.tsx
 * Onde adicionar: junto ao TemplateChooser (~ linha 1870), criar bloco
 * condicional `templateId === "defiverso-imagebg" && <DefiversoControls />`.
 *
 * Próximo passo idealmente: adicionar props dedicadas em SlideProps
 * (backgroundDarken: number, titleColor: 'white'|'green'|'black') em vez
 * de reusar accentOverride/bgColor. Mas isso requer migrar todos os
 * templates — pode ficar pra próxima iteração.
 */

export default TemplateDefiversoImageBG;
