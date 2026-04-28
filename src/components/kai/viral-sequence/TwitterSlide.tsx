/**
 * TwitterSlide — renderiza 1 slide do carrossel estilo tweet.
 *
 * Padrão 1:1 com gmadureiraa/sequencia-viral (commit 4ef43003 — "audit
 * editor=preview 100% sincronizado"): UM ÚNICO LAYOUT por slide. Sem
 * variantes de capa/overlay/editorial.
 *
 *   - Card branco (ou dark, detectado por luminância) 1080×1350 (Instagram 4:5).
 *   - Header: avatar 100px + nome bold + verified azul (#1D9BF0) + @handle
 *     + contador `n/total` no canto superior direito.
 *   - Body: parágrafo único, Inter ~39px, hierarquia via `**bold**` inline.
 *   - Imagem opcional ABAIXO do texto (border 1px, radius 20).
 *   - Sem CTA hardcoded, sem action bar, sem tweet-screenshot de capa.
 *
 * Auto-shrink mantido: se o body ficar muito longo, reduz fonte
 * gradualmente. `rewriteImageUrl` mantido para o proxy de export PNG.
 */

import { forwardRef, type CSSProperties } from "react";
import type { ReactNode } from "react";
import { CANVAS_H, CANVAS_W, type ViralProfile } from "./types";

const TWITTER_BLUE = "#1D9BF0";
const BG_LIGHT = "#FFFFFF";
const BG_DARK = "#0A0A0A";
const FG_LIGHT = "#0F1419";
const FG_DARK = "#F5F5F5";
const MUTED_LIGHT = "#536471";
const MUTED_DARK = "#9CA3AF";
const BORDER_LIGHT = "#E5E7EB";
const BORDER_DARK = "#262626";

const FS_NAME = 41;
const FS_HANDLE = 31;
const FS_BODY_BASE = 39;

interface TwitterSlideProps {
  body: string;
  imageUrl?: string;
  slideNumber: number;
  totalSlides: number;
  profile: ViralProfile;
  scale?: number;
  textScale?: number;
  /** Força tema dark. Se omitido, usa light por padrão. */
  dark?: boolean;
  /** Atribuição da imagem (mostrada como crédito discreto quando presente). */
  imageAttribution?: string;
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
 * Auto-shrink: dado o tamanho do body, retorna multiplicador do font-size.
 *   ≤180 chars → 1.00, 181-260 → 0.92, 261-340 → 0.85, 341-420 → 0.78, >420 → 0.72
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
      dark = false,
      imageAttribution,
      rewriteImageUrl,
      className,
      style,
    },
    ref,
  ) {
    const bg = dark ? BG_DARK : BG_LIGHT;
    const fg = dark ? FG_DARK : FG_LIGHT;
    const muted = dark ? MUTED_DARK : MUTED_LIGHT;
    const border = dark ? BORDER_DARK : BORDER_LIGHT;

    const shrink = autoShrinkMultiplier(body?.length ?? 0, !!imageUrl);
    const fsBody = FS_BODY_BASE * textScale * shrink;

    const resolvedImageUrl = imageUrl
      ? rewriteImageUrl
        ? rewriteImageUrl(imageUrl)
        : imageUrl
      : undefined;
    const resolvedAvatarUrl = profile.avatarUrl
      ? rewriteImageUrl
        ? rewriteImageUrl(profile.avatarUrl)
        : profile.avatarUrl
      : undefined;

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
            background: bg,
            color: fg,
            borderRadius: 44,
            display: "flex",
            flexDirection: "column",
            padding: "64px 70px 56px",
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            overflow: "hidden",
            border: `2px solid ${border}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        >
          {/* Header: avatar + nome + verified + handle + contador */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 40,
              flexShrink: 0,
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
                  color: fg,
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
                {/* Verified badge azul X */}
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
                  color: muted,
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
                color: muted,
                fontWeight: 600,
                alignSelf: "flex-start",
              }}
            >
              {slideNumber}/{totalSlides}
            </div>
          </div>

          {/* Body — texto único estilo tweet, imagem opcional abaixo */}
          <div
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {body && (
              <p
                style={{
                  fontSize: fsBody,
                  lineHeight: 1.4,
                  color: fg,
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
                  border: `1px solid ${border}`,
                  background: dark ? "#1A1A1A" : "#F4F4F5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
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
                {imageAttribution && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 16,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.85)",
                      fontWeight: 500,
                      letterSpacing: "0.02em",
                      textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                      background: "rgba(0,0,0,0.35)",
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Foto: {imageAttribution}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
