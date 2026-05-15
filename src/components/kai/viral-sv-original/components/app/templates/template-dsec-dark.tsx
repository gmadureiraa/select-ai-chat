
import * as React from "react";
import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 11 — DSEC Dark (renderer_template: dsec_design_system_dark)
 *
 * Sistema visual canônico do DSEC Labs / Alfred para LinkedIn carrossel
 * institucional PT-BR. Repurpose de blog top em 8-10 slides escaneáveis.
 *
 * Spec Camada 2: vault/99 - SISTEMA/format-standards/clients/dsec/linkedin-carrossel.md
 *
 * Paleta:
 *  - Fundo: preto profundo `#0A0A0B` com sutil ruído/grid técnico
 *  - Texto base: branco-osso `#F5F5F7`
 *  - Accent primário (Bitcoin): laranja `#F7931A`
 *  - Accent dado/dado-shock: verde elétrico `#00FF88` (highlights numéricos)
 *  - Muted: cinza `rgba(245,245,247,0.55)`
 *
 * Tipografia:
 *  - Display: Inter 900 (clean tech, sem serifa)
 *  - Mono dado: JetBrains Mono pra números, % e cifras (telegrafa "técnico")
 *
 * Variantes:
 *  - cover       → hook curto serifado + indicador "Arrasta →" + sigil DSEC
 *  - inner       → eyebrow uppercase + título + corpo + rodapé "fonte"
 *  - quote       → takeaway forte centralizado (slide N-1)
 *  - cta         → CTA orgânico (mini curso / blog / COLDKIT)
 *
 * Hard constraints (do spec):
 *  - 8-10 slides (sweet spot)
 *  - Slide 1 = capa+hook com tensão
 *  - Slide 2 = problema + DADO numérico
 *  - Slide N-1 = takeaway forte
 *  - Slide N = CTA orgânico
 *  - Branding DSEC discreto em todos os slides
 *  - Max 50 palavras/slide (escaneável)
 *  - Sem hashtag, sem travessão "—" (regras DSEC PT-BR)
 */

const BG_DARK = "#0A0A0B";
const INK_LIGHT = "#F5F5F7";
const ACCENT_BTC = "#F7931A";
const ACCENT_DATA = "#00FF88";
const MUTED = "rgba(245,245,247,0.55)";
const RULE = "rgba(245,245,247,0.12)";

const DISPLAY_STACK =
  '"Inter", "SVInter", "Helvetica Neue", system-ui, sans-serif';
const MONO_STACK =
  '"JetBrains Mono", "IBM Plex Mono", "SF Mono", "Courier New", ui-monospace, monospace';

const TemplateDsecDark = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateDsecDark(
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
    ref
  ) {
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const bg = bgColor || BG_DARK;
    const accent = accentOverride || ACCENT_BTC;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayStack = displayFontOverride || DISPLAY_STACK;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta =
      variant === "cta" || (isLastSlide && variant !== "cover" && !isCover);
    const isQuote = variant === "quote";

    // Tamanhos (canvas 1080x1350)
    const FS_HOOK = 92 * ts;
    const FS_TITLE = 64 * ts;
    const FS_BODY = 34 * ts;
    const FS_QUOTE = 60 * ts;
    const FS_CTA = 84 * ts;
    const FS_EYEBROW = 22 * ts;
    const FS_FOOTER = 22 * ts;

    // Grid técnico discreto (lines verticais sutis no fundo)
    const techGrid =
      "linear-gradient(to right, rgba(0,255,136,0.025) 1px, transparent 1px)";

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
            background: bg,
            color: INK_LIGHT,
            boxSizing: "border-box",
            padding: "100px 88px",
            fontFamily: displayStack,
            display: "flex",
            flexDirection: "column",
            backgroundImage: techGrid,
            backgroundSize: "32px 100%",
            overflow: "hidden",
          }}
        >
          {/* Header: brand mark + slide counter */}
          <Header
            slideNumber={slideNumber}
            totalSlides={totalSlides}
            accent={accent}
            FS_EYEBROW={FS_EYEBROW}
          />

          {/* Body slot */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: isCover ? "flex-end" : "center",
              gap: 32,
              paddingTop: 60,
              paddingBottom: 60,
            }}
          >
            {isCta ? (
              <CtaBlock
                heading={heading}
                body={body}
                accent={accent}
                displayStack={displayStack}
                FS_CTA={FS_CTA}
                FS_BODY={FS_BODY}
                showTitle={showTitle}
                showBody={showBody}
              />
            ) : isCover ? (
              <CoverBlock
                heading={heading}
                body={body}
                imageUrl={bodyImgSrc}
                accent={accent}
                displayStack={displayStack}
                FS_HOOK={FS_HOOK}
                FS_BODY={FS_BODY}
                showTitle={showTitle}
                showBody={showBody}
                showBg={showBg}
              />
            ) : isQuote ? (
              <QuoteBlock
                body={body || heading}
                accent={accent}
                displayStack={displayStack}
                FS_QUOTE={FS_QUOTE}
              />
            ) : (
              <InnerBlock
                heading={heading}
                body={body}
                imageUrl={bodyImgSrc}
                accent={accent}
                displayStack={displayStack}
                FS_TITLE={FS_TITLE}
                FS_BODY={FS_BODY}
                FS_EYEBROW={FS_EYEBROW}
                showTitle={showTitle}
                showBody={showBody}
                showBg={showBg}
              />
            )}
          </div>

          {/* Footer: Powered by D-Sec + arrow */}
          <Footer
            handle={profile.handle || "@alfredp2p"}
            isCover={isCover}
            isLast={isLastSlide || slideNumber === totalSlides}
            FS_FOOTER={FS_FOOTER}
            accent={accent}
          />
        </div>
      </div>
    );
  }
);

function Header({
  slideNumber,
  totalSlides,
  accent,
  FS_EYEBROW,
}: {
  slideNumber: number;
  totalSlides: number;
  accent: string;
  FS_EYEBROW: number;
}) {
  const counter = `${String(slideNumber).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${RULE}`,
        paddingBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: MONO_STACK,
          fontSize: FS_EYEBROW,
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            background: accent,
            display: "inline-block",
            transform: "rotate(45deg)",
          }}
        />
        <span>D-SEC LABS</span>
      </div>
      <span
        style={{
          fontFamily: MONO_STACK,
          fontSize: FS_EYEBROW,
          color: MUTED,
          letterSpacing: "0.1em",
        }}
      >
        {counter}
      </span>
    </div>
  );
}

function CoverBlock({
  heading,
  body,
  imageUrl,
  accent,
  displayStack,
  FS_HOOK,
  FS_BODY,
  showTitle,
  showBody,
  showBg,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  accent: string;
  displayStack: string;
  FS_HOOK: number;
  FS_BODY: number;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {showBg && imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 360,
            borderRadius: 4,
            overflow: "hidden",
            background: "#111",
            border: `1px solid ${RULE}`,
            marginBottom: 24,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(40%) contrast(1.1)",
              opacity: 0.7,
            }}
          />
        </div>
      )}

      {showTitle && heading && (
        <h1
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_HOOK,
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            color: INK_LIGHT,
            margin: 0,
            maxWidth: "95%",
          }}
        >
          {renderRichText(heading, accent)}
        </h1>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: displayStack,
            fontSize: FS_BODY,
            lineHeight: 1.45,
            color: MUTED,
            fontWeight: 500,
            margin: 0,
            maxWidth: "88%",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

function InnerBlock({
  heading,
  body,
  imageUrl,
  accent,
  displayStack,
  FS_TITLE,
  FS_BODY,
  FS_EYEBROW,
  showTitle,
  showBody,
  showBg,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  accent: string;
  displayStack: string;
  FS_TITLE: number;
  FS_BODY: number;
  FS_EYEBROW: number;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
}) {
  // Extrai prefix "EYEBROW: ..." opcional do body
  const lines = (body || "").split("\n");
  let eyebrow: string | null = null;
  let restBody = body || "";
  if (lines[0] && lines[0].toUpperCase().startsWith("EYEBROW:")) {
    eyebrow = lines[0].slice(8).trim();
    restBody = lines.slice(1).join("\n").trimStart();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_EYEBROW,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            fontWeight: 600,
          }}
        >
          {eyebrow}
        </div>
      )}

      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_TITLE,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            color: INK_LIGHT,
            margin: 0,
            maxWidth: "95%",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBg && imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 320,
            borderRadius: 4,
            overflow: "hidden",
            background: "#111",
            border: `1px solid ${RULE}`,
            marginTop: 12,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(30%) contrast(1.08)",
              opacity: 0.75,
            }}
          />
        </div>
      )}

      {showBody && restBody && (
        <div
          style={{
            fontFamily: displayStack,
            fontSize: FS_BODY,
            lineHeight: 1.55,
            color: INK_LIGHT,
            fontWeight: 400,
            maxWidth: "92%",
            whiteSpace: "pre-line",
          }}
        >
          {renderInnerBody(restBody, accent)}
        </div>
      )}
    </div>
  );
}

/**
 * Renderiza body com suporte a:
 *  - linhas começando com "- " viram bullets (•) com indent
 *  - números/% destacados em ACCENT_DATA (verde elétrico)
 *  - **bold** vira accent (laranja BTC)
 */
function renderInnerBody(text: string, accent: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} style={{ height: "0.6em" }} />;
    }
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
    const content = isBullet ? trimmed.slice(2) : trimmed;
    const enhanced = highlightNumbers(content, accent);

    if (isBullet) {
      return (
        <div
          key={idx}
          style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "flex-start" }}
        >
          <span
            style={{
              color: accent,
              fontWeight: 700,
              fontSize: "1.1em",
              lineHeight: 1.4,
            }}
          >
            ▸
          </span>
          <span style={{ flex: 1 }}>{enhanced}</span>
        </div>
      );
    }
    return (
      <p
        key={idx}
        style={{ margin: 0, marginBottom: 12 }}
      >
        {enhanced}
      </p>
    );
  });
}

/**
 * Destaca números/%/cifras em verde elétrico DATA accent.
 * Mantém **bold** em laranja BTC accent.
 */
function highlightNumbers(text: string, accent: string): React.ReactNode[] {
  // Primeiro processa **bold**
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  const out: React.ReactNode[] = [];
  boldParts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(
        <strong key={`b${i}`} style={{ fontWeight: 800, color: accent }}>
          {part.slice(2, -2)}
        </strong>
      );
    } else {
      // Detecta números: US$ 5M, 47%, 2024, R$ 1.290 etc.
      const numRegex =
        /(R\$\s?[\d.,]+(?:\s?(?:milh|bilh|tri)\S*)?|US\$\s?[\d.,]+(?:[KMB]|\s?(?:milh|bilh|tri)\S*)?|\$[\d.,]+[KMB]?|\d+(?:[.,]\d+)*\s?%|\d{4}|\d+(?:[.,]\d+)+)/g;
      const sub = part.split(numRegex);
      sub.forEach((seg, j) => {
        if (numRegex.test(seg)) {
          out.push(
            <span
              key={`n${i}-${j}`}
              style={{
                color: ACCENT_DATA,
                fontFamily: MONO_STACK,
                fontWeight: 600,
              }}
            >
              {seg}
            </span>
          );
        } else if (seg) {
          out.push(<span key={`t${i}-${j}`}>{seg}</span>);
        }
      });
    }
  });
  return out;
}

function QuoteBlock({
  body,
  accent,
  displayStack,
  FS_QUOTE,
}: {
  body: string;
  accent: string;
  displayStack: string;
  FS_QUOTE: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 32,
        maxWidth: "92%",
      }}
    >
      <div
        style={{
          width: 80,
          height: 4,
          background: accent,
        }}
      />
      <p
        style={{
          fontFamily: displayStack,
          fontWeight: 800,
          fontSize: FS_QUOTE,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: INK_LIGHT,
          margin: 0,
        }}
      >
        {renderRichText(body, accent)}
      </p>
    </div>
  );
}

function CtaBlock({
  heading,
  body,
  accent,
  displayStack,
  FS_CTA,
  FS_BODY,
  showTitle,
  showBody,
}: {
  heading: string;
  body: string;
  accent: string;
  displayStack: string;
  FS_CTA: number;
  FS_BODY: number;
  showTitle: boolean;
  showBody: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 40,
        maxWidth: "92%",
      }}
    >
      {showTitle && (
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_CTA,
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            color: INK_LIGHT,
            margin: 0,
          }}
        >
          {renderRichText(heading || "Próximo passo:", accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: displayStack,
            fontSize: FS_BODY,
            lineHeight: 1.5,
            color: MUTED,
            fontWeight: 500,
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}

      <div
        style={{
          marginTop: 24,
          padding: "20px 28px",
          border: `1.5px solid ${accent}`,
          alignSelf: "flex-start",
          fontFamily: MONO_STACK,
          fontSize: 24,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          fontWeight: 600,
        }}
      >
        Link no comentário →
      </div>
    </div>
  );
}

function Footer({
  handle,
  isCover,
  isLast,
  FS_FOOTER,
  accent,
}: {
  handle: string;
  isCover: boolean;
  isLast: boolean;
  FS_FOOTER: number;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1px solid ${RULE}`,
        paddingTop: 24,
        fontFamily: MONO_STACK,
        fontSize: FS_FOOTER,
        color: MUTED,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      <span>Powered by D-SEC</span>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>{handle}</span>
        {!isLast && (
          <span
            style={{
              color: accent,
              fontSize: "1.4em",
              lineHeight: 1,
            }}
          >
            →
          </span>
        )}
      </span>
    </div>
  );
}

export default TemplateDsecDark;
