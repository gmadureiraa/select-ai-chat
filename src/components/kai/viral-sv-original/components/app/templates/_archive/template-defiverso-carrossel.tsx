
import * as React from "react";
import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H } from "./utils";

/**
 * Template 12 — Defiverso IG Carrossel
 *   (renderer_template: defiverso-ig-carrossel-html)
 *
 * Carrossel Instagram 1080x1350 do @defiverso. Repurpose de newsletter
 * Resumo Criptoverso (sexta) ou hot-take ad-hoc macro/regulação.
 *
 * Spec Camada 2: vault/99 - SISTEMA/format-standards/clients/defiverso/ig-carrossel-1080x1350.md
 *
 * Estrutura canônica (10 slides padrão sexta):
 *   1. Capa — 3 headlines empilhadas ou 1 statement + emoji 👽
 *   2-9. Um tema/slide — emoji pilar topo + título + 3-4 bullets c/ dado + "Fonte: X"
 *   10. CTA — ManyChat keyword ou bio link news.defiverso.com
 *
 * Paleta:
 *   - Verde profundo Defiverso `#0E3B2E` (background dominante)
 *   - Cream texto `#F5F1E8` (contraste alto, salvable)
 *   - Accent dado: amarelo `#F5D547` (números, % numéricos)
 *   - Accent secundário: verde alien `#7CF067` (highlights bold)
 *
 * Tipografia:
 *   - Display: Söhne / Inter Display Bold (titles)
 *   - Body: Inter 400/500 (bullets)
 *   - Mono: JetBrains Mono pra "Fonte: X" e dados isolados
 *
 * Constraints:
 *   - 8-12 slides (sweet spot 10)
 *   - 1 ideia por slide
 *   - Cada slide 2-9 → 3-4 bullets com 1 dado numérico
 *   - Rodapé "Fonte: NomeDoVeículo" em todo slide de notícia
 *   - Zero travessão, zero "Simples assim.", zero "Se você chegou até aqui"
 *   - Emoji 👽 na capa e no CTA (slide final)
 */

const BG_GREEN = "#0E3B2E";
const INK_CREAM = "#F5F1E8";
const ACCENT_DATA = "#F5D547";
const ACCENT_BOLD = "#7CF067";
const MUTED = "rgba(245,241,232,0.65)";
const RULE = "rgba(245,241,232,0.18)";

const DISPLAY_STACK =
  '"Söhne", "Inter Display", "SVInter", "Inter", "Plus Jakarta Sans", system-ui, sans-serif';
const BODY_STACK =
  '"Inter", "SVInter", "Helvetica Neue", system-ui, sans-serif';
const MONO_STACK =
  '"JetBrains Mono", "IBM Plex Mono", "SF Mono", "Courier New", ui-monospace, monospace';

const TemplateDefiversoCarrossel = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateDefiversoCarrossel(
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

    const bg = bgColor || BG_GREEN;
    const accent = accentOverride || ACCENT_DATA;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayStack = displayFontOverride || DISPLAY_STACK;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta =
      variant === "cta" || (isLastSlide && variant !== "cover" && !isCover);

    // Tamanhos (canvas 1080x1350)
    const FS_HOOK = 96 * ts;
    const FS_TITLE = 68 * ts;
    const FS_BODY = 32 * ts;
    const FS_CTA = 86 * ts;
    const FS_EYEBROW = 24 * ts;
    const FS_FOOTER = 22 * ts;
    const FS_EMOJI = 96 * ts;

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
            color: INK_CREAM,
            boxSizing: "border-box",
            padding: "96px 88px 88px",
            fontFamily: displayStack,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            // Sutil texture noise pra escapar do "flat web3"
            backgroundImage: `radial-gradient(circle at 80% 10%, rgba(124,240,103,0.06) 0%, transparent 50%), radial-gradient(circle at 10% 90%, rgba(245,213,71,0.04) 0%, transparent 45%)`,
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
              FS_EMOJI={FS_EMOJI}
              FS_FOOTER={FS_FOOTER}
              handle={profile.handle || "@defiverso"}
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
              FS_EMOJI={FS_EMOJI}
              FS_EYEBROW={FS_EYEBROW}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              handle={profile.handle || "@defiverso"}
              FS_FOOTER={FS_FOOTER}
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
              FS_FOOTER={FS_FOOTER}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              handle={profile.handle || "@defiverso"}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
            />
          )}
        </div>
      </div>
    );
  }
);

/**
 * Capa: 3 headlines empilhadas OU 1 statement forte + emoji 👽 + sub com período.
 * Convenção body opcional:
 *  - linha 1 "EYEBROW: <texto>" → mostra como sub-headline (ex: "X temas · DD-DD/MM")
 *  - se heading contiver "\n", quebras viram linhas empilhadas grandes
 */
function CoverBlock({
  heading,
  body,
  imageUrl,
  accent,
  displayStack,
  FS_HOOK,
  FS_BODY,
  FS_EMOJI,
  FS_EYEBROW,
  showTitle,
  showBody,
  showBg,
  slideNumber,
  totalSlides,
  handle,
  FS_FOOTER,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  accent: string;
  displayStack: string;
  FS_HOOK: number;
  FS_BODY: number;
  FS_EMOJI: number;
  FS_EYEBROW: number;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  slideNumber: number;
  totalSlides: number;
  handle: string;
  FS_FOOTER: number;
}) {
  // Extrai eyebrow opcional
  const lines = (body || "").split("\n");
  let eyebrow: string | null = null;
  let restBody = body || "";
  if (lines[0] && lines[0].toUpperCase().startsWith("EYEBROW:")) {
    eyebrow = lines[0].slice(8).trim();
    restBody = lines.slice(1).join("\n").trimStart();
  }

  const headingLines = (heading || "").split("\n").filter((l) => l.trim());

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 48,
        }}
      >
        <span
          style={{
            fontSize: FS_EMOJI,
            lineHeight: 1,
          }}
        >
          👽
        </span>
        {eyebrow && (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: FS_EYEBROW,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              alignSelf: "flex-end",
              textAlign: "right",
              maxWidth: 380,
              lineHeight: 1.4,
            }}
          >
            {eyebrow}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {showTitle && headingLines.length > 0 && (
          <h1
            style={{
              fontFamily: displayStack,
              fontWeight: 900,
              fontSize: FS_HOOK,
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
              color: INK_CREAM,
              margin: 0,
              maxWidth: "98%",
            }}
          >
            {headingLines.map((line, i) => (
              <div key={i} style={{ marginBottom: i < headingLines.length - 1 ? 8 : 0 }}>
                {renderRichText(line, accent)}
              </div>
            ))}
          </h1>
        )}

        {showBody && restBody && (
          <p
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.5,
              color: MUTED,
              fontWeight: 500,
              margin: 0,
              maxWidth: "88%",
              whiteSpace: "pre-line",
              marginTop: 24,
            }}
          >
            {renderRichText(restBody, accent)}
          </p>
        )}

        {showBg && imageUrl && (
          <div
            style={{
              position: "relative",
              width: 320,
              height: 320,
              borderRadius: 8,
              overflow: "hidden",
              alignSelf: "flex-end",
              marginTop: 32,
              border: `2px solid ${RULE}`,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}
      </div>

      <CoverFooter
        slideNumber={slideNumber}
        totalSlides={totalSlides}
        handle={handle}
        FS_FOOTER={FS_FOOTER}
      />
    </>
  );
}

/**
 * Slide interno: emoji pilar topo + título 1 linha + bullets com dado + rodapé "Fonte: X".
 *
 * Convenção body:
 *   - Linha 1 opcional "EYEBROW: <emoji_pilar> <Categoria>"
 *   - Linhas começando com "- " viram bullets (•) — destacar dados numéricos
 *   - Linha final opcional "FONTE: <Nome>" vira rodapé "Fonte: Nome"
 */
function InnerBlock({
  heading,
  body,
  imageUrl,
  accent,
  displayStack,
  FS_TITLE,
  FS_BODY,
  FS_EYEBROW,
  FS_FOOTER,
  slideNumber,
  totalSlides,
  handle,
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
  FS_FOOTER: number;
  slideNumber: number;
  totalSlides: number;
  handle: string;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
}) {
  const rawLines = (body || "").split("\n");
  let eyebrow: string | null = null;
  let fonte: string | null = null;
  const bodyLines: string[] = [];

  rawLines.forEach((ln) => {
    const trimmed = ln.trim();
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("EYEBROW:") && !eyebrow) {
      eyebrow = trimmed.slice(8).trim();
    } else if (upper.startsWith("FONTE:") || upper.startsWith("FONT:")) {
      fonte = trimmed.replace(/^(FONTE|FONT):\s*/i, "").trim();
    } else {
      bodyLines.push(ln);
    }
  });

  const cleanBody = bodyLines.join("\n").trim();

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 40,
        }}
      >
        {eyebrow ? (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: FS_EYEBROW,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              fontWeight: 700,
            }}
          >
            {eyebrow}
          </span>
        ) : (
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: FS_EYEBROW,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            👽 DEFIVERSO
          </span>
        )}
        <span
          style={{
            fontFamily: MONO_STACK,
            fontSize: FS_EYEBROW,
            color: MUTED,
            letterSpacing: "0.1em",
          }}
        >
          {String(slideNumber).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: 28,
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontWeight: 800,
              fontSize: FS_TITLE,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: INK_CREAM,
              margin: 0,
              maxWidth: "96%",
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
              height: 280,
              borderRadius: 8,
              overflow: "hidden",
              border: `1.5px solid ${RULE}`,
              marginTop: 8,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {showBody && cleanBody && (
          <div
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.55,
              color: INK_CREAM,
              fontWeight: 400,
              maxWidth: "94%",
              marginTop: 12,
            }}
          >
            {renderBulletedBody(cleanBody, accent)}
          </div>
        )}
      </div>

      <InnerFooter
        fonte={fonte}
        handle={handle}
        FS_FOOTER={FS_FOOTER}
        accent={accent}
      />
    </>
  );
}

function renderBulletedBody(text: string, accent: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} style={{ height: "0.5em" }} />;
    }
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
    const content = isBullet ? trimmed.slice(2) : trimmed;
    const enhanced = highlightNumbers(content, accent);

    if (isBullet) {
      return (
        <div
          key={idx}
          style={{
            display: "flex",
            gap: 14,
            marginBottom: 14,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              color: accent,
              fontWeight: 800,
              fontSize: "1em",
              lineHeight: 1.55,
              flexShrink: 0,
            }}
          >
            ●
          </span>
          <span style={{ flex: 1 }}>{enhanced}</span>
        </div>
      );
    }
    return (
      <p key={idx} style={{ margin: 0, marginBottom: 12 }}>
        {enhanced}
      </p>
    );
  });
}

function highlightNumbers(text: string, accent: string): React.ReactNode[] {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  const out: React.ReactNode[] = [];
  boldParts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(
        <strong
          key={`b${i}`}
          style={{ fontWeight: 800, color: ACCENT_BOLD }}
        >
          {part.slice(2, -2)}
        </strong>
      );
    } else {
      const numRegex =
        /(R\$\s?[\d.,]+(?:\s?(?:milh|bilh|tri)\S*)?|US\$\s?[\d.,]+(?:[KMB]|\s?(?:milh|bilh|tri)\S*)?|\$[\d.,]+[KMB]?|\d+(?:[.,]\d+)*\s?%|\d{4}|\d+(?:[.,]\d+)+)/g;
      const sub = part.split(numRegex);
      sub.forEach((seg, j) => {
        if (numRegex.test(seg)) {
          out.push(
            <span
              key={`n${i}-${j}`}
              style={{
                color: accent,
                fontFamily: MONO_STACK,
                fontWeight: 700,
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

function InnerFooter({
  fonte,
  handle,
  FS_FOOTER,
  accent,
}: {
  fonte: string | null;
  handle: string;
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
        paddingTop: 22,
        marginTop: 16,
        fontFamily: MONO_STACK,
        fontSize: FS_FOOTER,
        color: MUTED,
        letterSpacing: "0.1em",
      }}
    >
      {fonte ? (
        <span>
          Fonte:{" "}
          <span style={{ color: INK_CREAM, fontWeight: 500 }}>{fonte}</span>
        </span>
      ) : (
        <span>{handle}</span>
      )}
      <span
        style={{
          color: accent,
          fontSize: "1.4em",
          lineHeight: 1,
        }}
      >
        →
      </span>
    </div>
  );
}

function CoverFooter({
  slideNumber,
  totalSlides,
  handle,
  FS_FOOTER,
}: {
  slideNumber: number;
  totalSlides: number;
  handle: string;
  FS_FOOTER: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1px solid ${RULE}`,
        paddingTop: 22,
        marginTop: 24,
        fontFamily: MONO_STACK,
        fontSize: FS_FOOTER,
        color: MUTED,
        letterSpacing: "0.1em",
      }}
    >
      <span style={{ textTransform: "uppercase" }}>{handle}</span>
      <span>
        {String(slideNumber).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
      </span>
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
  FS_EMOJI,
  FS_FOOTER,
  handle,
  showTitle,
  showBody,
}: {
  heading: string;
  body: string;
  accent: string;
  displayStack: string;
  FS_CTA: number;
  FS_BODY: number;
  FS_EMOJI: number;
  FS_FOOTER: number;
  handle: string;
  showTitle: boolean;
  showBody: boolean;
}) {
  return (
    <>
      <div
        style={{
          fontSize: FS_EMOJI,
          lineHeight: 1,
          marginBottom: 40,
        }}
      >
        👽
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 40,
          maxWidth: "94%",
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
              color: INK_CREAM,
              margin: 0,
            }}
          >
            {renderRichText(heading || "Manda RESUMO na DM", accent)}
          </h2>
        )}

        {showBody && body && (
          <p
            style={{
              fontFamily: BODY_STACK,
              fontSize: FS_BODY,
              lineHeight: 1.5,
              color: INK_CREAM,
              fontWeight: 500,
              margin: 0,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${RULE}`,
          paddingTop: 22,
          fontFamily: MONO_STACK,
          fontSize: FS_FOOTER,
          color: MUTED,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        <span>👽 {handle}</span>
        <span style={{ color: accent }}>news.defiverso.com</span>
      </div>
    </>
  );
}

export default TemplateDefiversoCarrossel;
