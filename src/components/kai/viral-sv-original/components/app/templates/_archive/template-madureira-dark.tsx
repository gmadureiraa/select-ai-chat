
import { forwardRef } from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H, MONO_STACK } from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template — Madureira Dark
 *
 * Inspiração: carrosséis publicados do @ogmadureira. Minimalismo premium em
 * preto profundo `#0A0A0A`, Fraunces italic na capa (serif), Geist sans no
 * body. Accent REC coral `#FF3D2E` no heart + CTA. Verde alien `#7CF067`
 * pra ✅/highlight, vermelho `#FF4A1C` pra ❌.
 *
 * Variantes:
 *  - cover: emoji opcional (detectado na 1ª linha do body), imagem opcional,
 *    título Fraunces italic centralizado, subtítulo Geist muted.
 *  - inner: imagem opcional + heading Geist 800 + body Geist 400, tudo
 *    centralizado vertical + horizontal.
 *  - cta: pergunta Fraunces italic + body muted + caixa CTA REC com palavra
 *    chave em **bold** + subtexto mono + avatar e handle.
 *
 * Footer comum em todos exceto CTA: heart ❤ + "0X/0N" mono no canto inferior
 * esquerdo. Sem topbar, sem cards, sem border. Zero-friction.
 */

const BG_DEFAULT = "#0A0A0A";
const INK_DEFAULT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.65)";
const ACCENT_DEFAULT = "#FF3D2E"; // REC coral — heart + CTA box
const ACCENT_POSITIVE = "#7CF067"; // verde alien — bold/highlight no renderRichText
const FRAUNCES_STACK = '"Fraunces", "Playfair Display", "Georgia", serif';
const SANS_STACK = '"Geist", "Inter", system-ui, sans-serif';

// Regex Unicode pra detectar emoji no início (flag /u obrigatória)
const EMOJI_LEADING_RE = /^\s*(\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*)/u;

function extractLeadingEmoji(text: string): { emoji?: string; rest: string } {
  if (!text) return { emoji: undefined, rest: text || "" };
  const lines = text.split("\n");
  const first = lines[0] || "";
  const match = first.match(EMOJI_LEADING_RE);
  if (!match) return { emoji: undefined, rest: text };
  const emoji = match[1];
  const firstAfter = first.slice(match[0].length).trim();
  const restLines = firstAfter ? [firstAfter, ...lines.slice(1)] : lines.slice(1);
  return { emoji, rest: restLines.join("\n").trim() };
}

const TemplateMadureiraDark = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateMadureiraDark(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      style,
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
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    // style === 'white' inverte: bg branco + ink dark
    const isWhite = style === "white";
    const bg = bgColor || (isWhite ? "#FFFFFF" : BG_DEFAULT);
    const ink = isWhite ? "#0A0A0A" : INK_DEFAULT;
    const muted = isWhite ? "rgba(10,10,10,0.65)" : MUTED;
    const accent = accentOverride || ACCENT_DEFAULT;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayStack = displayFontOverride || FRAUNCES_STACK;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && variant !== "cover");

    // Tamanhos derivados (canvas 1080×1350)
    const FS_COVER_TITLE = 108 * ts;
    const FS_COVER_BODY = 60 * ts;
    const FS_INNER_TITLE = 64 * ts;
    const FS_INNER_BODY = 68 * ts;
    const FS_CTA_TITLE = 88 * ts;
    const FS_CTA_BODY = 60 * ts;
    const FS_CTA_BOX = 32 * ts;
    const FS_CTA_SUBTEXT = 18 * ts;
    const FS_FOOTER = 24 * ts;
    const FS_EMOJI = 96 * ts;

    const PADDING_TOP = isCta ? "140px" : "120px";
    const PADDING = `${PADDING_TOP} 100px 120px`;

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
            background: showBg ? bg : "transparent",
            color: ink,
            boxSizing: "border-box",
            padding: PADDING,
            fontFamily: SANS_STACK,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
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
              accentPositive={ACCENT_POSITIVE}
              displayStack={displayStack}
              ink={ink}
              muted={muted}
              showTitle={showTitle}
              showBody={showBody}
              FS_CTA_TITLE={FS_CTA_TITLE}
              FS_CTA_BODY={FS_CTA_BODY}
              FS_CTA_BOX={FS_CTA_BOX}
              FS_CTA_SUBTEXT={FS_CTA_SUBTEXT}
              FS_FOOTER={FS_FOOTER}
            />
          ) : isCover ? (
            <CoverSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              displayStack={displayStack}
              accent={ACCENT_POSITIVE}
              ink={ink}
              muted={muted}
              FS_COVER_TITLE={FS_COVER_TITLE}
              FS_COVER_BODY={FS_COVER_BODY}
              FS_EMOJI={FS_EMOJI}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={body}
              imageUrl={bodyImgSrc}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              accent={ACCENT_POSITIVE}
              ink={ink}
              FS_INNER_TITLE={FS_INNER_TITLE}
              FS_INNER_BODY={FS_INNER_BODY}
            />
          )}

          {!isCta && (
            <Footer
              accent={accent}
              ink={ink}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              FS_FOOTER={FS_FOOTER}
            />
          )}
        </div>
      </div>
    );
  }
);

function CoverSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  showBg,
  displayStack,
  accent,
  ink,
  muted,
  FS_COVER_TITLE,
  FS_COVER_BODY,
  FS_EMOJI,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  displayStack: string;
  accent: string;
  ink: string;
  muted: string;
  FS_COVER_TITLE: number;
  FS_COVER_BODY: number;
  FS_EMOJI: number;
}) {
  const { emoji, rest: bodyWithoutEmoji } = extractLeadingEmoji(body || "");

  const clampedTitle = Math.max(60, Math.min(180, FS_COVER_TITLE));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        width: "100%",
        maxWidth: "92%",
        textAlign: "center",
      }}
    >
      {emoji && (
        <div
          style={{
            fontSize: FS_EMOJI,
            lineHeight: 1,
            margin: 0,
          }}
          aria-hidden
        >
          {emoji}
        </div>
      )}

      {showBg && imageUrl && (
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 24,
            overflow: "hidden",
            background: "#1A1A1A",
            flexShrink: 0,
          }}
        >
          <MediaTag
            src={imageUrl}
            alt={heading}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {showTitle && heading && (
        <h1
          style={{
            fontFamily: displayStack,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: clampedTitle,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: ink,
            margin: 0,
            maxWidth: "100%",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {renderRichText(heading, accent)}
        </h1>
      )}

      {showBody && bodyWithoutEmoji && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontWeight: 400,
            fontSize: FS_COVER_BODY,
            lineHeight: 1.45,
            color: muted,
            margin: 0,
            maxWidth: "90%",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(bodyWithoutEmoji, accent)}
        </p>
      )}
    </div>
  );
}

function InnerSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  showBg,
  accent,
  ink,
  FS_INNER_TITLE,
  FS_INNER_BODY,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  accent: string;
  ink: string;
  FS_INNER_TITLE: number;
  FS_INNER_BODY: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        width: "100%",
        maxWidth: "92%",
        textAlign: "center",
      }}
    >
      {showBg && imageUrl && (
        <div
          style={{
            width: 480,
            height: 480,
            maxWidth: "100%",
            maxHeight: "50%",
            borderRadius: 20,
            overflow: "hidden",
            background: "#1A1A1A",
            flexShrink: 0,
          }}
        >
          <MediaTag
            src={imageUrl}
            alt={heading}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {showTitle && heading && (
        <h2
          style={{
            fontFamily: SANS_STACK,
            fontWeight: 800,
            fontSize: FS_INNER_TITLE,
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
            color: ink,
            margin: 0,
            marginBottom: 24,
            maxWidth: "100%",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {renderRichText(heading, accent)}
        </h2>
      )}

      {showBody && body && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontWeight: 400,
            fontSize: FS_INNER_BODY,
            lineHeight: 1.45,
            color: ink,
            margin: 0,
            maxWidth: "100%",
            whiteSpace: "pre-line",
            display: "-webkit-box",
            WebkitLineClamp: 8,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {renderRichText(body, accent)}
        </p>
      )}
    </div>
  );
}

function CtaSlide({
  heading,
  body,
  profile,
  avatarSrc,
  accent,
  accentPositive,
  displayStack,
  ink,
  muted,
  showTitle,
  showBody,
  FS_CTA_TITLE,
  FS_CTA_BODY,
  FS_CTA_BOX,
  FS_CTA_SUBTEXT,
  FS_FOOTER,
}: {
  heading: string;
  body: string;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
  accent: string;
  accentPositive: string;
  displayStack: string;
  ink: string;
  muted: string;
  showTitle: boolean;
  showBody: boolean;
  FS_CTA_TITLE: number;
  FS_CTA_BODY: number;
  FS_CTA_BOX: number;
  FS_CTA_SUBTEXT: number;
  FS_FOOTER: number;
}) {
  // Extrai palavra-chave do body (primeira ocorrência de **bold**) pra usar
  // como destaque dentro da CTA box. Fallback: "salva esse pra usar".
  const boldMatch = (body || "").match(/\*\*([^*]+)\*\*/);
  const ctaWord = boldMatch ? boldMatch[1] : "salva esse pra usar";
  const ctaBoxLabel = boldMatch ? body.replace(/\n+/g, " ").trim() : `**${ctaWord}**`;

  // Body sem o bold (renderiza acima da box, como contexto)
  const bodyForContext = boldMatch
    ? (body || "").replace(/\*\*[^*]+\*\*/g, "").trim()
    : (body || "");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        width: "100%",
        maxWidth: "92%",
        textAlign: "center",
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: FS_CTA_TITLE,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: ink,
            margin: 0,
            maxWidth: "100%",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {renderRichText(heading, accentPositive)}
        </h2>
      )}

      {showBody && bodyForContext && (
        <p
          style={{
            fontFamily: SANS_STACK,
            fontWeight: 400,
            fontSize: FS_CTA_BODY,
            lineHeight: 1.45,
            color: muted,
            margin: 0,
            maxWidth: "90%",
            whiteSpace: "pre-line",
          }}
        >
          {renderRichText(bodyForContext, accentPositive)}
        </p>
      )}

      {/* CTA box highlight */}
      <div
        style={{
          background: accent,
          borderRadius: 16,
          padding: "24px 48px",
          fontFamily: SANS_STACK,
          fontWeight: 700,
          fontSize: FS_CTA_BOX,
          color: "#FFFFFF",
          letterSpacing: "-0.005em",
          maxWidth: "90%",
          display: "inline-block",
        }}
      >
        {renderRichText(ctaBoxLabel, "#FFFFFF")}
      </div>

      <div
        style={{
          fontFamily: MONO_STACK,
          fontSize: FS_CTA_SUBTEXT,
          color: muted,
          margin: 0,
        }}
      >
        (automação rola sozinha — sem cobrança, sem spam)
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={profile.name}
            crossOrigin="anonymous"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${accent}`,
            }}
          />
        ) : null}
        <span
          style={{
            fontFamily: MONO_STACK,
            fontSize: 24,
            color: ink,
            fontWeight: 600,
          }}
        >
          {profile.handle}
        </span>
        {profile.name && (
          <span
            style={{
              fontFamily: SANS_STACK,
              fontSize: 22,
              color: muted,
              fontWeight: 400,
            }}
          >
            {profile.name}
          </span>
        )}
      </div>
    </div>
  );
}

function Footer({
  accent,
  ink,
  slideNumber,
  totalSlides,
  FS_FOOTER,
}: {
  accent: string;
  ink: string;
  slideNumber: number;
  totalSlides: number;
  FS_FOOTER: number;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        left: 100,
        bottom: 80,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: MONO_STACK,
        fontSize: FS_FOOTER,
        color: ink,
        fontWeight: 500,
        zIndex: 5,
      }}
    >
      <span style={{ color: accent, fontSize: FS_FOOTER * 1.1, lineHeight: 1 }} aria-hidden>
        ❤
      </span>
      <span>{`${pad(slideNumber)}/${pad(totalSlides)}`}</span>
    </div>
  );
}

export default TemplateMadureiraDark;
