
import { forwardRef } from "react";
import * as React from "react";
import type { SlideProps } from "./types";
import { resolveImgSrc, renderRichText, CANVAS_W, CANVAS_H, MONO_STACK } from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template — Defiverso Cripto Dark
 *
 * Inspirado no feed atual do Defiverso. Capa dark com foto big tipo "4 coins
 * glowing laranja" + título multicor (palavras em laranja BTC, branco e verde
 * alien). Conteúdo: foto B&W full-bleed (Peter Todd, Hal Finney etc) + heading
 * gigante em verde + body branco com **bold** em amarelo/verde. CTA dark com
 * pergunta de engajamento + alien 👽 + "COMENTA AÍ" handwritten rotacionado.
 *
 * Convenção de heading multicor (cover):
 *   Use quebras de linha `\n` no heading. Cada linha recebe uma cor de accent
 *   diferente, em ordem: laranja (warm BTC), branco, verde alien, amarelo.
 *   Exemplo: "4 CRIPTOS\nQUE PODEM EXPLODIR\nNO PRÓXIMO\nCICLO DE ALTA!"
 *
 * Convenção body interno: usar **bold** em palavras-chave (highlight em verde
 * alien automaticamente). renderRichText cuida disso via accent.
 *
 * Paleta dominante: preto profundo `#0A0A0A` + verde alien `#7CF067`.
 */

const DARK_BG = "#0A0A0A";
const CREAM = "#FFFFFF";
const PAPER_CREAM = "#F5F1E8";
const GREEN_ALIEN = "#7CF067";
const ORANGE_BTC = "#FF7A28";
const YELLOW_HOT = "#F5D547";
const RED_DANGER = "#FF4A1C";

const ACCENT_DEFAULT = GREEN_ALIEN;

const DISPLAY_STACK =
  '"SVInter", "Inter Display", "Inter", "Helvetica Neue", sans-serif';
const HAND_STACK =
  '"Caveat", "Permanent Marker", "Bradley Hand", cursive';

// Ciclo de cores para a capa (palavras alternam por linha)
const COVER_COLOR_CYCLE = [ORANGE_BTC, CREAM, GREEN_ALIEN, YELLOW_HOT];

const TemplateDefiversoCriptoDark = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateDefiversoCriptoDark(
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
    const avatarSrc = resolveImgSrc(profile.photoUrl, exportMode);
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const bg = bgColor || DARK_BG;
    const accent = accentOverride || ACCENT_DEFAULT;
    const ts = Math.max(0.6, Math.min(1.6, textScale));
    const displayStack = displayFontOverride || DISPLAY_STACK;

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && !isCover);
    const isQuote = variant === "quote";

    // Tamanhos derivados do canvas 1080x1350
    const FS_HERO = 118 * ts;
    const FS_TITLE_GREEN = 96 * ts;
    const FS_BODY = 38 * ts;
    const FS_QUOTE = 72 * ts;
    const FS_CTA_HEAD = 92 * ts;
    const FS_CTA_SUB = 36 * ts;
    const FS_HANDLE = 22 * ts;
    const FS_PAGE = 20 * ts;
    const FS_COVER_SUB = 34 * ts;
    const FS_ALIEN = 220 * ts;
    const FS_HAND = 72 * ts;

    const PADDING = "70px 70px 60px";

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
            color: CREAM,
            boxSizing: "border-box",
            fontFamily: displayStack,
            display: "flex",
            flexDirection: "column",
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
              padding={PADDING}
              FS_CTA_HEAD={FS_CTA_HEAD}
              FS_CTA_SUB={FS_CTA_SUB}
              FS_HANDLE={FS_HANDLE}
              FS_ALIEN={FS_ALIEN}
              FS_HAND={FS_HAND}
            />
          ) : isCover ? (
            <CoverSlide
              heading={heading}
              body={body}
              imageUrl={showBg ? bodyImgSrc : undefined}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              accent={accent}
              padding={PADDING}
              slideNumber={slideNumber}
              totalSlides={totalSlides}
              FS_HERO={FS_HERO}
              FS_COVER_SUB={FS_COVER_SUB}
            />
          ) : isQuote ? (
            <QuoteSlide
              body={body || heading}
              displayStack={displayStack}
              accent={accent}
              padding={PADDING}
              FS_QUOTE={FS_QUOTE}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={body}
              imageUrl={showBg ? bodyImgSrc : undefined}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              accent={accent}
              padding={PADDING}
              FS_TITLE_GREEN={FS_TITLE_GREEN}
              FS_BODY={FS_BODY}
            />
          )}

          {/* Footer comum (exceto CTA) */}
          {!isCta && (
            <Footer
              avatarSrc={avatarSrc}
              handle={profile.handle}
              FS_HANDLE={FS_HANDLE}
              FS_PAGE={FS_PAGE}
              current={slideNumber}
              total={totalSlides}
              isLast={isLastSlide || slideNumber === totalSlides}
              padding={PADDING}
            />
          )}
        </div>
      </div>
    );
  }
);

// ============================================================================
// Cover slide — foto top + título multicor + dots
// ============================================================================
function CoverSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  displayStack,
  accent,
  padding,
  slideNumber,
  totalSlides,
  FS_HERO,
  FS_COVER_SUB,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  accent: string;
  padding: string;
  slideNumber: number;
  totalSlides: number;
  FS_HERO: number;
  FS_COVER_SUB: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Imagem full-bleed top ~60% */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "62%",
            overflow: "hidden",
            background: "#1A1A1A",
          }}
        >
          <MediaTag
            src={imageUrl}
            alt={heading}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Gradient overlay dark embaixo (fade into bg) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.0) 0%, rgba(10,10,10,0.0) 55%, rgba(10,10,10,0.85) 88%, rgba(10,10,10,1) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Bottom: título multicor + subtítulo + dots */}
      <div
        style={{
          marginTop: "auto",
          padding: padding,
          paddingTop: 0,
          paddingBottom: 110,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {showTitle && heading && (
          <h1
            style={{
              fontFamily: displayStack,
              fontWeight: 900,
              fontSize: FS_HERO,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: CREAM,
              margin: 0,
              textTransform: "uppercase",
              maxWidth: "100%",
            }}
          >
            {renderHeadingMultiColor(heading, accent)}
          </h1>
        )}

        {showBody && body && (
          <p
            style={{
              fontFamily: displayStack,
              fontWeight: 600,
              fontSize: FS_COVER_SUB,
              lineHeight: 1.3,
              color: CREAM,
              margin: 0,
              maxWidth: "90%",
              opacity: 0.9,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(body, accent)}
          </p>
        )}

        {/* Dots indicator */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
          }}
        >
          {Array.from({ length: Math.min(totalSlides, 12) }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: i + 1 <= slideNumber ? CREAM : "rgba(255,255,255,0.3)",
                display: "inline-block",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inner slide — foto top + heading verde + body branco com bold
// ============================================================================
function InnerSlide({
  heading,
  body,
  imageUrl,
  showTitle,
  showBody,
  displayStack,
  accent,
  padding,
  FS_TITLE_GREEN,
  FS_BODY,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  accent: string;
  padding: string;
  FS_TITLE_GREEN: number;
  FS_BODY: number;
}) {
  const hasImage = !!imageUrl;
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Imagem full-bleed top (~55-65%) */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "58%",
            overflow: "hidden",
            background: "#1A1A1A",
          }}
        >
          <MediaTag
            src={imageUrl!}
            alt={heading}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(100%) contrast(1.05)",
            }}
          />
          {/* Gradient fade down */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.0) 40%, rgba(10,10,10,0.85) 85%, rgba(10,10,10,1) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Bottom content area */}
      <div
        style={{
          marginTop: hasImage ? "auto" : 0,
          padding: padding,
          paddingTop: hasImage ? 0 : 90,
          paddingBottom: 120,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          flex: hasImage ? "0 0 auto" : 1,
          justifyContent: hasImage ? "flex-end" : "center",
        }}
      >
        {showTitle && heading && (
          <h2
            style={{
              fontFamily: displayStack,
              fontWeight: 900,
              fontSize: FS_TITLE_GREEN,
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
              color: GREEN_ALIEN,
              margin: 0,
              textTransform: "uppercase",
              maxWidth: "100%",
            }}
          >
            {heading}
          </h2>
        )}

        {showBody && body && (
          <p
            style={{
              fontFamily: displayStack,
              fontWeight: 500,
              fontSize: FS_BODY,
              lineHeight: 1.4,
              color: CREAM,
              margin: 0,
              maxWidth: "95%",
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(body, accent === ACCENT_DEFAULT ? YELLOW_HOT : accent)}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quote slide
// ============================================================================
function QuoteSlide({
  body,
  displayStack,
  accent,
  padding,
  FS_QUOTE,
}: {
  body: string;
  displayStack: string;
  accent: string;
  padding: string;
  FS_QUOTE: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: padding,
      }}
    >
      <p
        style={{
          fontFamily: displayStack,
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: FS_QUOTE,
          lineHeight: 1.15,
          color: CREAM,
          margin: 0,
          textAlign: "center",
          maxWidth: "92%",
        }}
      >
        &ldquo;{renderRichText(body, accent)}&rdquo;
      </p>
    </div>
  );
}

// ============================================================================
// CTA slide — pergunta + alien + handwritten "COMENTA AÍ"
// ============================================================================
function CtaSlide({
  heading,
  body,
  profile,
  avatarSrc,
  accent,
  displayStack,
  padding,
  FS_CTA_HEAD,
  FS_CTA_SUB,
  FS_HANDLE,
  FS_ALIEN,
  FS_HAND,
}: {
  heading: string;
  body: string;
  profile: { name: string; handle: string; photoUrl: string };
  avatarSrc?: string;
  accent: string;
  displayStack: string;
  padding: string;
  FS_CTA_HEAD: number;
  FS_CTA_SUB: number;
  FS_HANDLE: number;
  FS_ALIEN: number;
  FS_HAND: number;
}) {
  const punchline = heading || "Quem você acha que é **Satoshi**?";
  const sub = body || "Comenta aqui em baixo.";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: padding,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Alien gigante de fundo, canto direito superior */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 20,
          fontSize: FS_ALIEN,
          lineHeight: 1,
          opacity: 0.18,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(-8deg)",
        }}
      >
        👽
      </div>

      {/* "COMENTA AÍ" handwritten rotacionado */}
      <div
        style={{
          position: "absolute",
          top: "32%",
          right: 80,
          transform: "rotate(-12deg)",
          fontFamily: HAND_STACK,
          fontWeight: 700,
          fontSize: FS_HAND,
          color: GREEN_ALIEN,
          textTransform: "uppercase",
          lineHeight: 1,
          zIndex: 3,
          textShadow: "3px 3px 0 rgba(0,0,0,0.4)",
        }}
      >
        COMENTA AÍ
      </div>

      {/* Bloco central: pergunta + sub */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 38,
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: displayStack,
            fontWeight: 900,
            fontSize: FS_CTA_HEAD,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
            color: CREAM,
            margin: 0,
            maxWidth: "92%",
          }}
        >
          {renderRichText(punchline, GREEN_ALIEN)}
        </h2>

        {sub && (
          <p
            style={{
              fontFamily: displayStack,
              fontWeight: 500,
              fontSize: FS_CTA_SUB,
              lineHeight: 1.4,
              color: CREAM,
              margin: 0,
              maxWidth: "85%",
              opacity: 0.92,
              whiteSpace: "pre-line",
            }}
          >
            {renderRichText(sub, accent)}
          </p>
        )}
      </div>

      {/* Handle rodapé */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: MONO_STACK,
          fontSize: FS_HANDLE,
          color: CREAM,
          fontWeight: 600,
          opacity: 0.9,
          paddingTop: 24,
          zIndex: 2,
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={profile.name}
            crossOrigin="anonymous"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${GREEN_ALIEN}`,
            }}
          />
        ) : null}
        <span>{profile.handle}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Footer (handle + page indicator + chevron decorativo)
// ============================================================================
function Footer({
  avatarSrc,
  handle,
  FS_HANDLE,
  FS_PAGE,
  current,
  total,
  isLast,
  padding,
}: {
  avatarSrc?: string;
  handle: string;
  FS_HANDLE: number;
  FS_PAGE: number;
  current: number;
  total: number;
  isLast: boolean;
  padding: string;
}) {
  // Extract horizontal padding from padding string ("70px 70px 60px")
  const horizPad = parseInt(padding.split(" ")[1] || "70", 10);
  return (
    <div
      style={{
        position: "absolute",
        left: horizPad,
        right: horizPad,
        bottom: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: MONO_STACK,
          fontSize: FS_HANDLE,
          color: CREAM,
          fontWeight: 600,
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={handle}
            crossOrigin="anonymous"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              objectFit: "cover",
              border: `1.5px solid ${GREEN_ALIEN}`,
            }}
          />
        ) : null}
        <span>{handle}</span>
        <span
          style={{
            marginLeft: 6,
            color: GREEN_ALIEN,
            opacity: 0.8,
            fontSize: FS_HANDLE * 0.95,
          }}
        >
          ↻
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: MONO_STACK,
          fontSize: FS_PAGE,
          color: CREAM,
          fontWeight: 600,
          opacity: 0.7,
          letterSpacing: "0.05em",
        }}
      >
        <span>
          {String(current).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </span>
        {!isLast && (
          <span
            style={{
              fontSize: FS_PAGE * 2.4,
              lineHeight: 1,
              color: GREEN_ALIEN,
              fontWeight: 400,
              opacity: 0.9,
            }}
          >
            ›
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// renderHeadingMultiColor — quebra heading por linha e alterna cores
// COVER_COLOR_CYCLE. Suporta **bold** dentro de cada linha (mantém cor da
// linha, sem trocar). Útil pro título da capa estilo Defiverso.
// ============================================================================
function renderHeadingMultiColor(
  text: string,
  accent: string
): React.ReactNode[] {
  const lines = text.split(/\n/g);
  // Substitui primeira cor pelo accent override quando user passa accentOverride
  const cycle =
    accent && accent !== ACCENT_DEFAULT
      ? [accent, ...COVER_COLOR_CYCLE.slice(1)]
      : COVER_COLOR_CYCLE;
  return lines.map((line, lineIdx) => {
    const color = cycle[lineIdx % cycle.length];
    return (
      <span
        key={lineIdx}
        style={{ color, display: "block" }}
      >
        {renderRichText(line, color)}
      </span>
    );
  });
}

export default TemplateDefiversoCriptoDark;
