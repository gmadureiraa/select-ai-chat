
import { forwardRef } from "react";
import * as React from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H, MONO_STACK } from "./utils";

/**
 * Template — Serif Duelo (ref: @tinnaloaiza / DXo0npvmSk_)
 *
 * Auditoria editorial em formato de duelos FORTE vs FRACA. Tipografia serif
 * clássica (Playfair Display 900) com itálico marrom claro como ênfase. Sem
 * fotos: texto-puro premium tipo revista editorial. Cada slide condensa um
 * princípio em uma barra dark embaixo com cor amarela `#E8C870`.
 *
 * Convenção do body para slides de duelo:
 *   "<texto FORTE>||<texto FRACA>>>><frase do princípio>"
 *
 * Exemplo:
 *   body = "Universal e atemporal.||Distante e específico demais.>>>número específico > vago"
 *
 * Se o body não tem `||` ou `>>>`, faz fallback gracioso (renderiza como
 * bloco serif central). Cover e CTA tratados separadamente.
 *
 * Spec canon:
 *   /vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/
 *   _estrategia-2026-04/formatos/formato-carrosseis-06-serif-duelo-tinnaloaiza.md
 */

const PARCHMENT = "#EFE6CB";
const PARCHMENT_LIGHT = "#F5EFD8";
const DARK_BROWN = "#2B1F12";
const GREEN_FORTE = "#5DAA5C";
const CORAL_FRACA = "#E55A3D";
const YELLOW_PRINCIPLE = "#E8C870";
const BROWN_ITALIC = "#7A6646";
const ACCENT_DEFAULT = BROWN_ITALIC;

const SERIF_STACK =
  '"Playfair Display", "Cormorant Garamond", "Georgia", "Times New Roman", serif';
const BODY_SANS_STACK =
  '"SVInter", "Inter", "Helvetica Neue", system-ui, sans-serif';

const TemplateSerifDuelo = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateSerifDuelo(
    {
      heading,
      body,
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
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;

    const bg = bgColor || PARCHMENT;
    const accent = accentOverride || ACCENT_DEFAULT;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayStack = displayFontOverride || SERIF_STACK;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && !isCover);
    const isQuote = variant === "quote";

    // Tamanhos derivados do canvas 1080x1350
    const FS_HOOK = 108 * ts;
    const FS_TITLE = 78 * ts;
    const FS_DUEL_TITLE = 44 * ts;
    const FS_DUEL_BODY = 26 * ts;
    const FS_BODY = 32 * ts;
    const FS_QUOTE = 64 * ts;
    const FS_CTA = 92 * ts;
    const FS_TAG = 20 * ts;
    const FS_PRINCIPLE_LABEL = 24 * ts;
    const FS_PRINCIPLE = 38 * ts;
    const FS_HANDLE = 22 * ts;
    const FS_PAGE = 20 * ts;
    const FS_SECTION_TAG = 22 * ts;

    const PADDING = isCover ? "110px 90px 100px" : "100px 90px 110px";

    // Parser do body para duelos
    const parsed = parseDueloBody(body || "");

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
            color: DARK_BROWN,
            boxSizing: "border-box",
            padding: PADDING,
            fontFamily: displayStack,
            display: "flex",
            flexDirection: "column",
            // Cream parchment grain — noise SVG inline em tom marrom suave
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.12  0 0 0 0 0.07  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
            backgroundRepeat: "repeat",
            overflow: "hidden",
          }}
        >
          {isCta ? (
            <CtaSlide
              heading={heading}
              body={body}
              profile={profile}
              avatarSrc={avatarSrc}
              accent={accent}
              displayStack={displayStack}
              FS_CTA={FS_CTA}
              FS_BODY={FS_BODY}
              FS_HANDLE={FS_HANDLE}
            />
          ) : isCover ? (
            <CoverSlide
              heading={heading}
              body={body}
              slideNumber={slideNumber}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              accent={accent}
              FS_HOOK={FS_HOOK}
              FS_BODY={FS_BODY}
              FS_TAG={FS_TAG}
            />
          ) : isQuote ? (
            <QuoteSlide
              body={body || heading}
              displayStack={displayStack}
              FS_QUOTE={FS_QUOTE}
              accent={accent}
            />
          ) : parsed.hasDuelo ? (
            <DueloSlide
              heading={heading}
              forte={parsed.forte}
              fraca={parsed.fraca}
              principio={parsed.principio}
              slideNumber={slideNumber}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              accent={accent}
              FS_TITLE={FS_TITLE}
              FS_DUEL_TITLE={FS_DUEL_TITLE}
              FS_DUEL_BODY={FS_DUEL_BODY}
              FS_TAG={FS_TAG}
              FS_SECTION_TAG={FS_SECTION_TAG}
              FS_PRINCIPLE={FS_PRINCIPLE}
              FS_PRINCIPLE_LABEL={FS_PRINCIPLE_LABEL}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={body}
              slideNumber={slideNumber}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              accent={accent}
              FS_TITLE={FS_TITLE}
              FS_BODY={FS_BODY}
              FS_SECTION_TAG={FS_SECTION_TAG}
            />
          )}

          {/* Footer: número de página discreto canto inferior direito */}
          {!isCta && (
            <PageIndicator
              current={slideNumber}
              total={totalSlides}
              FS_PAGE={FS_PAGE}
            />
          )}
        </div>
      </div>
    );
  }
);

// ============================================================================
// Parser body — convenção "<forte>||<fraca>>>><principio>"
// ============================================================================
function parseDueloBody(body: string): {
  hasDuelo: boolean;
  forte: string;
  fraca: string;
  principio: string;
} {
  if (!body) return { hasDuelo: false, forte: "", fraca: "", principio: "" };
  // Separa principio primeiro (delimitador `>>>`)
  const [duelosRaw, principioRaw] = body.includes(">>>")
    ? body.split(">>>")
    : [body, ""];
  if (!duelosRaw.includes("||")) {
    return {
      hasDuelo: false,
      forte: "",
      fraca: "",
      principio: (principioRaw || "").trim(),
    };
  }
  const [forteRaw, fracaRaw] = duelosRaw.split("||");
  return {
    hasDuelo: true,
    forte: (forteRaw || "").trim(),
    fraca: (fracaRaw || "").trim(),
    principio: (principioRaw || "").trim(),
  };
}

// ============================================================================
// Section tag (no.0X · TÍTULO) reaproveitada por cover + slides internos
// ============================================================================
function SectionTag({
  index,
  label,
  FS_TAG,
}: {
  index: number;
  label?: string;
  FS_TAG: number;
}) {
  const num = String(index).padStart(2, "0");
  return (
    <div
      style={{
        fontFamily: MONO_STACK,
        fontSize: FS_TAG,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: DARK_BROWN,
        fontWeight: 600,
        border: `1.5px solid ${DARK_BROWN}`,
        padding: "8px 14px",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        lineHeight: 1,
      }}
    >
      <span>no.{num}</span>
      {label && (
        <>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Cover slide
// ============================================================================
function CoverSlide({
  heading,
  body,
  slideNumber,
  showTitle,
  showBody,
  displayStack,
  accent,
  FS_HOOK,
  FS_BODY,
  FS_TAG,
}: {
  heading: string;
  body: string;
  slideNumber: number;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  accent: string;
  FS_HOOK: number;
  FS_BODY: number;
  FS_TAG: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      {/* Top-right tag */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <SectionTag
          index={slideNumber}
          label="AUDITORIA"
          FS_TAG={FS_TAG}
        />
      </div>

      {/* Hero serif centralizado verticalmente */}
      {showTitle && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <h1
            style={{
              fontFamily: displayStack,
              fontWeight: 900,
              fontSize: FS_HOOK,
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              color: DARK_BROWN,
              margin: 0,
              textAlign: "left",
              maxWidth: "100%",
              fontStyle: "normal",
            }}
          >
            {renderRichTextItalic(heading || "", accent)}
          </h1>
        </div>
      )}

      {/* Subtítulo body opcional */}
      {showBody && body && (
        <p
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.45,
            color: DARK_BROWN,
            margin: 0,
            maxWidth: "80%",
            whiteSpace: "pre-line",
            opacity: 0.85,
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Inner slide (sem duelo — fallback)
// ============================================================================
function InnerSlide({
  heading,
  body,
  slideNumber,
  showTitle,
  showBody,
  displayStack,
  accent,
  FS_TITLE,
  FS_BODY,
  FS_SECTION_TAG,
}: {
  heading: string;
  body: string;
  slideNumber: number;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  accent: string;
  FS_TITLE: number;
  FS_BODY: number;
  FS_SECTION_TAG: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 50,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SectionTag
          index={slideNumber}
          label="AUDITORIA"
          FS_TAG={FS_SECTION_TAG}
        />
      </div>

      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_TITLE,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: DARK_BROWN,
            margin: 0,
          }}
        >
          {renderRichTextItalic(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: BODY_SANS_STACK,
            fontWeight: 500,
            fontSize: FS_BODY,
            lineHeight: 1.5,
            color: DARK_BROWN,
            margin: 0,
            whiteSpace: "pre-line",
            maxWidth: "92%",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Duelo slide (FORTE vs FRACA + principio)
// ============================================================================
function DueloSlide({
  heading,
  forte,
  fraca,
  principio,
  slideNumber,
  showTitle,
  showBody,
  displayStack,
  accent,
  FS_TITLE,
  FS_DUEL_TITLE,
  FS_DUEL_BODY,
  FS_SECTION_TAG,
  FS_PRINCIPLE,
  FS_PRINCIPLE_LABEL,
}: {
  heading: string;
  forte: string;
  fraca: string;
  principio: string;
  slideNumber: number;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  accent: string;
  FS_TITLE: number;
  FS_DUEL_TITLE: number;
  FS_DUEL_BODY: number;
  FS_TAG: number;
  FS_SECTION_TAG: number;
  FS_PRINCIPLE: number;
  FS_PRINCIPLE_LABEL: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      {/* Top-right section tag */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SectionTag
          index={slideNumber}
          label="DUELO"
          FS_TAG={FS_SECTION_TAG}
        />
      </div>

      {/* Hero serif heading */}
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_TITLE,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: DARK_BROWN,
            margin: 0,
            maxWidth: "95%",
          }}
        >
          {renderRichTextItalic(heading, accent)}
        </h2>
      )}

      {/* Duelo cards lado-a-lado */}
      {showBody && (
        <div
          style={{
            display: "flex",
            gap: 24,
            flex: "0 0 auto",
            marginTop: 8,
          }}
        >
          {/* FORTE */}
          <div
            style={{
              flex: 1,
              background: PARCHMENT_LIGHT,
              border: `1.5px solid ${DARK_BROWN}`,
              padding: "26px 28px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              minHeight: 280,
            }}
          >
            <span
              style={{
                fontFamily: MONO_STACK,
                fontSize: FS_DUEL_BODY * 0.85,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#FFFFFF",
                background: GREEN_FORTE,
                padding: "5px 12px",
                alignSelf: "flex-start",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              FORTE
            </span>
            <p
              style={{
                fontFamily: displayStack,
                fontWeight: 700,
                fontStyle: "italic",
                fontSize: FS_DUEL_TITLE,
                lineHeight: 1.15,
                color: DARK_BROWN,
                margin: 0,
              }}
            >
              {renderRichText(forte, accent)}
            </p>
          </div>

          {/* FRACA */}
          <div
            style={{
              flex: 1,
              background: DARK_BROWN,
              border: `1.5px solid ${DARK_BROWN}`,
              padding: "26px 28px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              minHeight: 280,
            }}
          >
            <span
              style={{
                fontFamily: MONO_STACK,
                fontSize: FS_DUEL_BODY * 0.85,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#FFFFFF",
                background: CORAL_FRACA,
                padding: "5px 12px",
                alignSelf: "flex-start",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              FRACA
            </span>
            <p
              style={{
                fontFamily: displayStack,
                fontWeight: 700,
                fontStyle: "italic",
                fontSize: FS_DUEL_TITLE,
                lineHeight: 1.15,
                color: PARCHMENT,
                margin: 0,
              }}
            >
              {renderRichText(fraca, PARCHMENT_LIGHT)}
            </p>
          </div>
        </div>
      )}

      {/* Princípio: barra dark full-width */}
      {principio && (
        <div
          style={{
            marginTop: "auto",
            background: DARK_BROWN,
            padding: "28px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: displayStack,
              fontStyle: "italic",
              fontSize: FS_PRINCIPLE_LABEL,
              color: PARCHMENT,
              opacity: 0.85,
              lineHeight: 1,
            }}
          >
            ❀ princípio:
          </span>
          <p
            style={{
              fontFamily: displayStack,
              fontWeight: 900,
              fontSize: FS_PRINCIPLE,
              lineHeight: 1.1,
              color: YELLOW_PRINCIPLE,
              margin: 0,
            }}
          >
            {renderRichText(principio, YELLOW_PRINCIPLE)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quote slide
// ============================================================================
function QuoteSlide({
  body,
  displayStack,
  FS_QUOTE,
  accent,
}: {
  body: string;
  displayStack: string;
  FS_QUOTE: number;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: displayStack,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: FS_QUOTE,
          lineHeight: 1.2,
          color: DARK_BROWN,
          margin: 0,
          textAlign: "center",
          maxWidth: "85%",
        }}
      >
        &ldquo;{renderRichText(body, accent)}&rdquo;
      </p>
    </div>
  );
}

// ============================================================================
// CTA slide
// ============================================================================
function CtaSlide({
  heading,
  body,
  profile,
  avatarSrc,
  accent,
  displayStack,
  FS_CTA,
  FS_BODY,
  FS_HANDLE,
}: {
  heading: string;
  body: string;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
  accent: string;
  displayStack: string;
  FS_CTA: number;
  FS_BODY: number;
  FS_HANDLE: number;
}) {
  const punchline = heading || "salva esse pra auditar tua próxima capa.";
  const sub = body || "auditoria editorial · @ogmadureira";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 54,
      }}
    >
      <h2
        style={{
          fontFamily: displayStack,
          fontWeight: 900,
          fontSize: FS_CTA,
          lineHeight: 0.98,
          letterSpacing: "-0.03em",
          color: DARK_BROWN,
          margin: 0,
          maxWidth: "95%",
        }}
      >
        {renderRichTextItalic(punchline, accent)}
      </h2>

      {sub && (
        <p
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.5,
            color: DARK_BROWN,
            margin: 0,
            maxWidth: "85%",
            whiteSpace: "pre-line",
            opacity: 0.85,
          }}
        >
          {renderRichText(sub, accent)}
        </p>
      )}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: MONO_STACK,
          fontSize: FS_HANDLE,
          color: DARK_BROWN,
          fontWeight: 600,
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={profile.name}
            crossOrigin="anonymous"
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${DARK_BROWN}`,
            }}
          />
        ) : null}
        <span>{profile.handle}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Page indicator (canto inferior direito)
// ============================================================================
function PageIndicator({
  current,
  total,
  FS_PAGE,
}: {
  current: number;
  total: number;
  FS_PAGE: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 90,
        bottom: 60,
        fontFamily: MONO_STACK,
        fontSize: FS_PAGE,
        color: DARK_BROWN,
        fontWeight: 600,
        letterSpacing: "0.05em",
        opacity: 0.7,
        zIndex: 5,
      }}
    >
      {String(current).padStart(2, "0")}/{String(total).padStart(2, "0")}
    </div>
  );
}

// ============================================================================
// renderRichTextItalic — extensão do renderRichText.
// Aplica fontStyle italic + cor accent em palavras marcadas com **...**
// para o tratamento serif (palavras-chave em itálico marrom claro).
// ============================================================================
function renderRichTextItalic(
  text: string,
  accent?: string
): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <em
          key={i}
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            color: accent || BROWN_ITALIC,
          }}
        >
          {part.slice(2, -2)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default TemplateSerifDuelo;
