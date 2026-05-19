
import { forwardRef } from "react";
import * as React from "react";
import type { SlideProps } from "./types";
import {
  resolveImgSrc,
  renderRichText,
  CANVAS_W,
  CANVAS_H,
} from "./utils";
import { MediaTag } from "./media-tag";

/**
 * Template — Madureira Minimal (Polaroid B&W)
 *
 * Inspiração: 3 screenshots reais do feed do Madureira (2026-05-19).
 * Carrossel ultra-minimalista: preto puro + frame branco interno + serif
 * editorial. SEM header de tweet, SEM avatar, SEM contador grande. Só
 * conteúdo centralizado dentro do frame. Página numerada discreta no
 * canto inferior direito.
 *
 *   01. CAPA — emoji grande no topo + título Fraunces 56 italic-leaning +
 *       subtítulo Geist 21 abaixo. Tudo centrado horizontal+vertical.
 *   02-N. INNER — 3 modos baseados em props:
 *         a) TEXTO PURO (sem imageUrl): título Fraunces 56 no topo,
 *            decoração SVG opcional ao meio, body Geist 35 embaixo.
 *         b) UMA IMAGEM (imageUrl): título Fraunces ao topo (curto),
 *            imagem centralizada (objectFit contain), body Geist 35 abaixo.
 *         c) DUAS IMAGENS (imageUrl + imageUrlSecondary via metadata
 *            override `displayFontOverride` hack? não — usamos parser do
 *            body por convenção `[img2:URL]` no body). Lado a lado com
 *            labels opcionais.
 *   LAST. CTA — modo TEXTO PURO. Frase tipo "Comenta aí" centralizada
 *         em Fraunces 56.
 *
 * Props extras vs SlideProps padrão (hack via prop existente):
 *  - `imageUrl`            → imagem principal (modo IMAGEM)
 *  - `accentOverride`      → IGNORADO (Madureira é só preto+branco)
 *  - `bgColor`             → IGNORADO (Madureira é sempre preto)
 *  - `displayFontOverride` → override Fraunces (caso queira Playfair etc)
 *  - **Convenção body**: pode conter `[img2:URL]` na primeira linha pra
 *    ativar modo DUAS IMAGENS. URL fica como `imageUrlSecondary`,
 *    resto do body vira o texto explicativo.
 *  - **Convenção body**: pode conter `[emoji:🚨]` na primeira linha pra
 *    setar o emoji da CAPA. (Default: 🚨 se variant=cover sem emoji.)
 *  - **Convenção body**: pode conter `[deco:notes]` ou `[deco:eyes]` pra
 *    ativar decoração SVG no modo TEXTO PURO. Valores suportados:
 *      - `notes` — notinhas brancas amassadas
 *      - `eyes`  — par de olhos
 *      - `none`  — desliga (default)
 *
 * NOTA SOBRE FONTES — "Fraunces" e "Geist" precisam estar carregadas
 * via @font-face em globals.css ou Google Fonts. Stack com fallback
 * robusto: Playfair Display / EB Garamond pra Fraunces, Inter pra Geist.
 *
 * TODO: adicionar @font-face oficial em globals.css se ainda não tem:
 *   @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400;1,700&family=Geist:wght@400;500;700&display=swap');
 *
 * Paleta (HARDCODED — sem accentOverride):
 *  - Preto absoluto   #000000
 *  - Branco puro      #FFFFFF
 */

const BLACK = "#000000";
const WHITE = "#FFFFFF";

const DISPLAY_STACK =
  '"Fraunces", "Playfair Display", "EB Garamond", "Cormorant Garamond", "Times New Roman", serif';
const BODY_STACK =
  '"Geist", "Inter", "SVInter", "Helvetica Neue", system-ui, sans-serif';
const MONO_PAGER =
  '"Geist Mono", "JetBrains Mono", "Courier New", ui-monospace, monospace';

interface BodyDirectives {
  emoji?: string;
  deco?: "notes" | "eyes" | "none";
  imageUrlSecondary?: string;
  cleanBody: string;
}

/**
 * Parse das convenções inline do body. Remove tokens `[emoji:X]`,
 * `[deco:X]`, `[img2:URL]` e devolve o body limpo + os valores extraídos.
 */
function parseBodyDirectives(raw: string): BodyDirectives {
  if (!raw) return { cleanBody: "" };
  let body = raw;
  let emoji: string | undefined;
  let deco: BodyDirectives["deco"];
  let imageUrlSecondary: string | undefined;

  const emojiMatch = body.match(/\[emoji:([^\]]+)\]/);
  if (emojiMatch) {
    emoji = emojiMatch[1].trim();
    body = body.replace(emojiMatch[0], "");
  }

  const decoMatch = body.match(/\[deco:(notes|eyes|none)\]/i);
  if (decoMatch) {
    deco = decoMatch[1].toLowerCase() as BodyDirectives["deco"];
    body = body.replace(decoMatch[0], "");
  }

  const img2Match = body.match(/\[img2:([^\]]+)\]/);
  if (img2Match) {
    imageUrlSecondary = img2Match[1].trim();
    body = body.replace(img2Match[0], "");
  }

  return {
    emoji,
    deco,
    imageUrlSecondary,
    cleanBody: body.replace(/^\s+|\s+$/g, ""),
  };
}

const TemplateMadureiraMinimal = forwardRef<HTMLDivElement, SlideProps>(
  function TemplateMadureiraMinimal(
    {
      heading,
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      isLastSlide,
      scale = 0.38,
      exportMode = false,
      displayFontOverride,
      textScale = 1,
      variant,
      layers,
    },
    ref,
  ) {
    const directives = parseBodyDirectives(body || "");
    const bodyImgSrc = resolveImgSrc(imageUrl, exportMode);
    const bodyImg2Src = resolveImgSrc(directives.imageUrlSecondary, exportMode);
    const hasImage = Boolean(bodyImgSrc);
    const hasImage2 = Boolean(bodyImg2Src);
    const showTitle = layers?.title !== false;
    const showBody = layers?.body !== false;
    const showBg = layers?.bg !== false;

    const displayStack = displayFontOverride || DISPLAY_STACK;

    const ts = Math.max(0.6, Math.min(1.6, textScale));

    const isCover = variant === "cover" || slideNumber === 1;
    const isCta = variant === "cta" || (isLastSlide && !isCover);
    // Resto = inner (texto puro, com imagem, ou duas imagens)

    const FS_COVER_TITLE = 56 * ts;
    const FS_COVER_BODY = 21 * ts;
    const FS_INNER_TITLE = 56 * ts;
    const FS_INNER_BODY = 35 * ts;
    const FS_INNER_BODY_SMALL = 21 * ts;
    const FS_CTA_TITLE = 56 * ts;
    const FS_PAGER = 16 * ts;
    const FS_COVER_EMOJI = 120 * ts;

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
            background: BLACK,
            color: WHITE,
            boxSizing: "border-box",
            overflow: "hidden",
            fontFamily: BODY_STACK,
          }}
        >
          {/* Frame branco interno tipo polaroid (sempre presente exceto se layers.bg=false) */}
          {showBg && (
            <div
              style={{
                position: "absolute",
                inset: 48,
                border: `2px solid ${WHITE}`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

          {isCover ? (
            <CoverSlide
              heading={heading}
              body={directives.cleanBody}
              emoji={directives.emoji ?? "🚨"}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              FS_TITLE={FS_COVER_TITLE}
              FS_BODY={FS_COVER_BODY}
              FS_EMOJI={FS_COVER_EMOJI}
            />
          ) : isCta ? (
            <CtaSlide
              heading={heading}
              body={directives.cleanBody}
              showTitle={showTitle}
              showBody={showBody}
              displayStack={displayStack}
              FS_TITLE={FS_CTA_TITLE}
              FS_BODY={FS_INNER_BODY_SMALL}
            />
          ) : (
            <InnerSlide
              heading={heading}
              body={directives.cleanBody}
              imageUrl={bodyImgSrc}
              imageUrl2={bodyImg2Src}
              hasImage={hasImage}
              hasImage2={hasImage2}
              deco={directives.deco}
              showTitle={showTitle}
              showBody={showBody}
              showBg={showBg}
              displayStack={displayStack}
              FS_TITLE={FS_INNER_TITLE}
              FS_BODY={FS_INNER_BODY}
              FS_BODY_SMALL={FS_INNER_BODY_SMALL}
            />
          )}

          {/* Pager pequeno no canto inferior direito (dentro do frame) */}
          {showBg && (
            <div
              style={{
                position: "absolute",
                bottom: 72,
                right: 72,
                fontFamily: MONO_PAGER,
                fontSize: FS_PAGER,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.55)",
                zIndex: 3,
                fontWeight: 500,
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          )}
        </div>
      </div>
    );
  },
);

/* ============================================================
 * COVER — emoji grande + título serif + subtítulo, tudo centrado
 * ============================================================ */
function CoverSlide({
  heading,
  body,
  emoji,
  showTitle,
  showBody,
  displayStack,
  FS_TITLE,
  FS_BODY,
  FS_EMOJI,
}: {
  heading: string;
  body: string;
  emoji: string;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  FS_TITLE: number;
  FS_BODY: number;
  FS_EMOJI: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 80px",
        gap: 40,
        textAlign: "center",
        zIndex: 2,
      }}
    >
      <div
        style={{
          fontSize: FS_EMOJI,
          lineHeight: 1,
          marginBottom: 12,
        }}
      >
        {emoji}
      </div>
      {showTitle && heading && (
        <h1
          style={{
            fontFamily: displayStack,
            fontSize: FS_TITLE,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            margin: 0,
            color: WHITE,
            textAlign: "center",
            maxWidth: 820,
            fontStyle: "italic",
          }}
        >
          {renderRichText(heading)}
        </h1>
      )}
      {showBody && body && (
        <p
          style={{
            fontFamily: BODY_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.5,
            margin: 0,
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            maxWidth: 680,
            fontWeight: 400,
            whiteSpace: "pre-line",
            letterSpacing: "0.01em",
          }}
        >
          {renderRichText(body)}
        </p>
      )}
    </div>
  );
}

/* ============================================================
 * INNER — 3 modos: texto puro, uma imagem, duas imagens
 * ============================================================ */
function InnerSlide({
  heading,
  body,
  imageUrl,
  imageUrl2,
  hasImage,
  hasImage2,
  deco,
  showTitle,
  showBody,
  showBg,
  displayStack,
  FS_TITLE,
  FS_BODY,
  FS_BODY_SMALL,
}: {
  heading: string;
  body: string;
  imageUrl?: string;
  imageUrl2?: string;
  hasImage: boolean;
  hasImage2: boolean;
  deco?: "notes" | "eyes" | "none";
  showTitle: boolean;
  showBody: boolean;
  showBg: boolean;
  displayStack: string;
  FS_TITLE: number;
  FS_BODY: number;
  FS_BODY_SMALL: number;
}) {
  // Modo dupla imagem: hasImage E hasImage2.
  // Body pode trazer labels separados por "|" (ex: "como você escreve|como as pessoas leem")
  const isDuoImage = hasImage && hasImage2;
  const isSingleImage = hasImage && !hasImage2;
  // Modo texto puro = sem nenhuma imagem
  // (Decoração SVG opcional só roda nesse modo.)

  let label1 = "";
  let label2 = "";
  let trimmedBody = body;
  if (isDuoImage && body.includes("|")) {
    const firstLine = body.split("\n")[0];
    const parts = firstLine.split("|").map((p) => p.trim());
    if (parts.length === 2) {
      label1 = parts[0];
      label2 = parts[1];
      trimmedBody = body.split("\n").slice(1).join("\n").trim();
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: isDuoImage || isSingleImage ? "flex-start" : "center",
        padding: "92px 80px 100px",
        gap: 36,
        zIndex: 2,
      }}
    >
      {showTitle && heading && (
        <h2
          style={{
            fontFamily: displayStack,
            fontSize: FS_TITLE,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: "-0.015em",
            margin: 0,
            color: WHITE,
            textAlign: "center",
            maxWidth: 860,
            fontStyle: "italic",
            flexShrink: 0,
          }}
        >
          {renderRichText(heading)}
        </h2>
      )}

      {/* Modo DUAS IMAGENS */}
      {showBg && isDuoImage && (
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "stretch",
            justifyContent: "center",
            width: "100%",
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          {[
            { src: imageUrl!, label: label1 },
            { src: imageUrl2!, label: label2 },
          ].map((pair, idx) => (
            <div
              key={idx}
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  flex: "1 1 auto",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <MediaTag
                  src={pair.src}
                  alt={pair.label || "image"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    filter: "grayscale(1)",
                  }}
                />
              </div>
              {pair.label && (
                <div
                  style={{
                    fontFamily: BODY_STACK,
                    fontSize: FS_BODY_SMALL,
                    color: "rgba(255,255,255,0.75)",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                  }}
                >
                  {pair.label}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modo UMA IMAGEM */}
      {showBg && isSingleImage && (
        <div
          style={{
            flex: "1 1 auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <MediaTag
            src={imageUrl!}
            alt={heading}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              filter: "grayscale(1)",
            }}
          />
        </div>
      )}

      {/* Modo TEXTO PURO — decoração SVG opcional ao meio */}
      {!hasImage && deco && deco !== "none" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "12px 0",
          }}
        >
          {deco === "notes" && <NotesDecoration size={280} />}
          {deco === "eyes" && <EyesDecoration size={180} />}
        </div>
      )}

      {/* Body */}
      {showBody && (trimmedBody || (!isDuoImage && body)) && (
        <p
          style={{
            fontFamily: BODY_STACK,
            fontSize: isSingleImage || isDuoImage ? FS_BODY_SMALL : FS_BODY,
            lineHeight: 1.45,
            margin: 0,
            color: WHITE,
            textAlign: "center",
            maxWidth: 820,
            fontWeight: 400,
            whiteSpace: "pre-line",
            letterSpacing: "0.005em",
            flexShrink: 0,
          }}
        >
          {renderRichText(isDuoImage ? trimmedBody : body)}
        </p>
      )}
    </div>
  );
}

/* ============================================================
 * CTA — Fraunces grande centralizado tipo "Comenta aí"
 * ============================================================ */
function CtaSlide({
  heading,
  body,
  showTitle,
  showBody,
  displayStack,
  FS_TITLE,
  FS_BODY,
}: {
  heading: string;
  body: string;
  showTitle: boolean;
  showBody: boolean;
  displayStack: string;
  FS_TITLE: number;
  FS_BODY: number;
}) {
  const ctaHead = heading || "comenta aí";
  return (
    <div
      style={{
        position: "absolute",
        inset: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 80px",
        gap: 32,
        textAlign: "center",
        zIndex: 2,
      }}
    >
      {showTitle && (
        <h2
          style={{
            fontFamily: displayStack,
            fontSize: FS_TITLE * 1.1,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            margin: 0,
            color: WHITE,
            maxWidth: 820,
            fontStyle: "italic",
          }}
        >
          {renderRichText(ctaHead)}
        </h2>
      )}
      {showBody && body && (
        <p
          style={{
            fontFamily: BODY_STACK,
            fontSize: FS_BODY,
            lineHeight: 1.5,
            margin: 0,
            color: "rgba(255,255,255,0.75)",
            maxWidth: 680,
            fontWeight: 400,
            whiteSpace: "pre-line",
            letterSpacing: "0.01em",
          }}
        >
          {renderRichText(body)}
        </p>
      )}
    </div>
  );
}

/* ============================================================
 * Decorações SVG (modo TEXTO PURO)
 * ============================================================ */

/** Notinhas amassadas — alusão a "tela em branco / papéis jogados". */
function NotesDecoration({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 280 168"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {/* Folha 1 (esquerda, levemente girada) */}
      <g transform="translate(20 28) rotate(-8)">
        <path
          d="M0 0 L96 0 L100 12 L100 100 L0 100 Z"
          fill={WHITE}
          opacity="0.95"
        />
        <path
          d="M14 22 L70 22 M14 38 L82 38 M14 54 L60 54 M14 70 L74 70"
          stroke={BLACK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
      {/* Folha 2 (centro, rasgada no canto) */}
      <g transform="translate(98 50) rotate(4)">
        <path
          d="M0 8 L88 0 L100 96 L8 104 Z"
          fill={WHITE}
          opacity="0.92"
        />
        <path
          d="M16 28 L74 24 M16 44 L80 40 M16 60 L66 56"
          stroke={BLACK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
      {/* Folha 3 (direita, amassada) */}
      <g transform="translate(186 22) rotate(12)">
        <path
          d="M4 0 L82 12 L74 90 L0 84 Z"
          fill={WHITE}
          opacity="0.9"
        />
        <path
          d="M14 26 L66 32 M14 42 L70 48 M14 58 L60 64"
          stroke={BLACK}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}

/** Par de olhos — observando. */
function EyesDecoration({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 180 72"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {[40, 140].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="36" rx="32" ry="22" fill={WHITE} />
          <circle cx={cx} cy="36" r="14" fill={BLACK} />
          <circle cx={cx + 4} cy="32" r="4" fill={WHITE} />
        </g>
      ))}
    </svg>
  );
}

export default TemplateMadureiraMinimal;
