/**
 * TwitterSlide — renderiza 1 slide do carrossel estilo tweet.
 * Canvas 1080×1350 (Instagram 4:5). Scale controlável pra caber na UI.
 *
 * Mudanças (refactor inspirado no postflow/gmadureiraa):
 *   - FS_BODY base reduzido: 52 → 39 (mais leve, igual ao tweet real).
 *   - Auto-shrink do body: passa de 220 chars → reduz fonte gradualmente.
 *   - Suporte `imageAsCover` — imagem cobre o slide inteiro com overlay
 *     (útil pra slide de capa com foto/imagem da notícia).
 *   - Suporte `proxyImageUrl` — função que reescreve src da imagem (CORS).
 *
 * Suporta **bold** inline no body via renderRichText.
 */

import { forwardRef, type CSSProperties } from "react";
import type { ReactNode } from "react";
import { CANVAS_H, CANVAS_W, type ViralProfile, type CoverTextStyle, type ViralSlide } from "./types";

const TWITTER_BLUE = "#1D9BF0";
const BG = "#FFFFFF";
const FG = "#0F1419";
const MUTED = "#536471";
const BORDER = "rgba(15, 20, 25, 0.08)";

const FS_NAME = 41;
const FS_HANDLE = 31;
// Fonte base do corpo — alinhada ao postflow. Auto-shrink abaixo cuida do overflow.
const FS_BODY_BASE = 39;

interface TwitterSlideProps {
  body: string;
  imageUrl?: string;
  slideNumber: number;
  totalSlides: number;
  profile: ViralProfile;
  scale?: number;
  textScale?: number;
  /** Se true, imagem ocupa todo o slide com gradient overlay (estilo capa de jornal). */
  imageAsCover?: boolean;
  /** Estilo do texto sobreposto (apenas quando imageAsCover=true). */
  coverTextStyle?: CoverTextStyle;
  /** Atribuição da imagem (mostrada como pequeno crédito quando há fonte). */
  imageAttribution?: string;
  /**
   * Layout editorial (capa de jornal) — quando preenchido + imageAsCover,
   * renderiza kicker + headline grande + subtitle + crédito sobreposto.
   * Substitui o `body` no slide.
   */
  editorial?: ViralSlide["editorial"];
  /** Reescreve URL da imagem (ex: pra passar por proxy CORS). */
  rewriteImageUrl?: (url: string) => string;
  className?: string;
  style?: CSSProperties;
}

function renderRichText(text: string): ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 800 }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

/**
 * Auto-shrink: dado o tamanho do body, retorna um multiplicador do font-size.
 * Curva conservadora pra evitar texto microscópico.
 *   ≤180 chars   → 1.00 (39px)
 *   181-260      → 0.92 (~36px)
 *   261-340      → 0.85 (~33px)
 *   341-420      → 0.78 (~30px)
 *   >420         → 0.72 (~28px)
 */
function autoShrinkMultiplier(bodyLength: number, hasImage: boolean): number {
  // Quando tem imagem o espaço útil cai ~40% — shrink mais agressivo.
  const lengthFactor = hasImage ? 0.7 : 1;
  const adjusted = bodyLength / lengthFactor;
  if (adjusted <= 180) return 1.0;
  if (adjusted <= 260) return 0.92;
  if (adjusted <= 340) return 0.85;
  if (adjusted <= 420) return 0.78;
  return 0.72;
}

export const TwitterSlide = forwardRef<HTMLDivElement, TwitterSlideProps>(
  function TwitterSlide(
    {
      body,
      imageUrl,
      slideNumber,
      totalSlides,
      profile,
      scale = 0.32,
      textScale = 1,
      imageAsCover = false,
      coverTextStyle,
      imageAttribution,
      editorial,
      rewriteImageUrl,
      className,
      style,
    },
    ref,
  ) {
    const isEditorial = !!editorial?.headline?.trim() && imageAsCover && !!imageUrl;
    const shrink = autoShrinkMultiplier(body?.length ?? 0, !!imageUrl && !imageAsCover);
    const fsBody = FS_BODY_BASE * textScale * shrink;
    const resolvedImageUrl = imageUrl
      ? (rewriteImageUrl ? rewriteImageUrl(imageUrl) : imageUrl)
      : undefined;
    const resolvedAvatarUrl = profile.avatarUrl
      ? (rewriteImageUrl ? rewriteImageUrl(profile.avatarUrl) : profile.avatarUrl)
      : undefined;

    // Resolução do estilo da capa (com defaults).
    const coverSize = coverTextStyle?.size ?? "md";
    const coverPosition = coverTextStyle?.position ?? "bottom";
    const coverSpacing = Math.max(1.0, Math.min(1.6, coverTextStyle?.spacing ?? 1.2));
    const coverOverlay = coverTextStyle?.overlay ?? "medium";
    const coverColorMode = coverTextStyle?.textColor ?? "auto";

    const COVER_SIZE_MULT: Record<string, number> = { sm: 0.95, md: 1.15, lg: 1.35, xl: 1.55 };
    const fsBodyCover = fsBody * (COVER_SIZE_MULT[coverSize] ?? 1.15);

    // Auto-contrast: white text + dark overlay (default), or black text + light overlay.
    const useDarkOverlay = coverColorMode !== "black";
    const overlayStops = useDarkOverlay
      ? {
          soft:    "rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%",
          medium:  "rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.78) 100%",
          strong:  "rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.92) 100%",
        }
      : {
          soft:    "rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.78) 100%",
          medium:  "rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.90) 100%",
          strong:  "rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.97) 100%",
        };
    const stop = overlayStops[coverOverlay];
    const overlayCss =
      coverPosition === "top"    ? `linear-gradient(180deg, ${stop})` :
      coverPosition === "center" ? `radial-gradient(ellipse at center, ${stop})` :
                                   `linear-gradient(0deg, ${stop})`;

    const coverTextColor = useDarkOverlay ? "#FFFFFF" : "#0F1419";
    const coverTextShadow = useDarkOverlay
      ? "0 2px 16px rgba(0,0,0,0.55)"
      : "0 1px 4px rgba(255,255,255,0.85)";

    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          overflow: "hidden",
          ...style,
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
            background: BG,
            color: FG,
            borderRadius: 44,
            display: "flex",
            flexDirection: "column",
            padding: "64px 70px 56px",
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            overflow: "hidden",
            border: `2px solid ${BORDER}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 40,
              flexShrink: 0,
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${TWITTER_BLUE}, #0A0A0A)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFF",
                fontSize: 40,
                fontWeight: 900,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={profile.name}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (profile.name || "?").charAt(0).toUpperCase()
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: FS_NAME,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: FG,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {profile.name || "Seu nome"}
                </span>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 22 22"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                    fill={TWITTER_BLUE}
                  />
                </svg>
              </div>
              <div
                style={{
                  fontSize: FS_HANDLE,
                  color: MUTED,
                  lineHeight: 1.2,
                  marginTop: 4,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {profile.handle || "@handle"}
              </div>
            </div>

            <div
              style={{
                fontSize: 26,
                color: MUTED,
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          </div>

          {/* Body — texto único estilo tweet */}
          {imageAsCover && resolvedImageUrl ? (
            // Layout COVER: imagem cobre todo o slide com gradient overlay e texto sobreposto
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
              }}
            >
              <img
                src={resolvedImageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: overlayCss,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 70,
                  right: 70,
                  ...(coverPosition === "top"
                    ? { top: 220 }
                    : coverPosition === "center"
                      ? { top: "50%", transform: "translateY(-30%)" }
                      : { bottom: 100 }),
                  zIndex: 2,
                }}
              >
                {isEditorial ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {editorial?.kicker && (
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: coverTextColor,
                          opacity: 0.92,
                          textShadow: coverTextShadow,
                          borderLeft: `5px solid ${coverTextColor}`,
                          paddingLeft: 16,
                          alignSelf: "flex-start",
                        }}
                      >
                        {editorial.kicker}
                      </div>
                    )}
                    <h1
                      style={{
                        fontSize: 78,
                        lineHeight: 1.05,
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                        color: coverTextColor,
                        margin: 0,
                        fontFamily:
                          '"Playfair Display", "Georgia", "Times New Roman", serif',
                        textShadow: coverTextShadow,
                      }}
                    >
                      {editorial!.headline}
                    </h1>
                    {editorial?.subtitle && (
                      <p
                        style={{
                          fontSize: 32,
                          lineHeight: 1.35,
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                          color: coverTextColor,
                          opacity: 0.92,
                          margin: 0,
                          textShadow: coverTextShadow,
                        }}
                      >
                        {renderRichText(editorial.subtitle)}
                      </p>
                    )}
                    {editorial?.credit && (
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: coverTextColor,
                          opacity: 0.78,
                          textShadow: coverTextShadow,
                          marginTop: 8,
                        }}
                      >
                        {editorial.credit}
                      </div>
                    )}
                  </div>
                ) : (
                  body && (
                    <p
                      style={{
                        fontSize: fsBodyCover,
                        lineHeight: coverSpacing,
                        color: coverTextColor,
                        margin: 0,
                        whiteSpace: "pre-line",
                        fontWeight: 700,
                        letterSpacing: "-0.015em",
                        textShadow: coverTextShadow,
                      }}
                    >
                      {renderRichText(body)}
                    </p>
                  )
                )}
              </div>
              {imageAttribution && (
                <div
                  style={{
                    position: "absolute",
                    left: 70,
                    bottom: 32,
                    fontSize: 18,
                    color: "rgba(255,255,255,0.75)",
                    zIndex: 3,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                  }}
                >
                  Foto: {imageAttribution}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                flex: "1 1 0",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                overflow: "hidden",
                minHeight: 0,
                position: "relative",
                zIndex: 2,
              }}
            >
              {body && (
                <p
                  style={{
                    fontSize: fsBody,
                    lineHeight: 1.4,
                    color: FG,
                    margin: 0,
                    whiteSpace: "pre-line",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {renderRichText(body)}
                </p>
              )}
              {resolvedImageUrl && (
                <div
                  style={{
                    width: "100%",
                    flex: "1 1 auto",
                    minHeight: 0,
                    borderRadius: 20,
                    overflow: "hidden",
                    border: `1px solid ${BORDER}`,
                    background: "#F4F4F5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={resolvedImageUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);
