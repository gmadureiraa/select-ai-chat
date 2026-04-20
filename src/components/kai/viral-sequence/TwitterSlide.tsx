/**
 * TwitterSlide — renderiza 1 slide do carrossel estilo tweet.
 * Canvas 1080×1350 (Instagram 4:5). Scale controlável pra caber na UI.
 *
 * Simplificado do componente de template-twitter.tsx do sequencia-viral:
 * mantém header (avatar + nome + verified badge + handle), body com
 * heading + texto, imagem opcional abaixo, contador slideNumber/total
 * no canto superior direito.
 *
 * Suporta **bold** inline no heading/body via renderRichText.
 */

import { forwardRef, type CSSProperties } from "react";
import type { ReactNode } from "react";
import { CANVAS_H, CANVAS_W, type ViralProfile } from "./types";

const TWITTER_BLUE = "#1D9BF0";
const BG = "#FFFFFF";
const FG = "#0F1419";
const MUTED = "#536471";
const BORDER = "rgba(15, 20, 25, 0.08)";

const FS_NAME = 40;
const FS_HANDLE = 30;
const FS_BODY = 52; // tweet-size: um bloco único, maior que o body antigo

interface TwitterSlideProps {
  body: string;
  imageUrl?: string;
  slideNumber: number;
  totalSlides: number;
  profile: ViralProfile;
  scale?: number;
  textScale?: number;
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
      className,
      style,
    },
    ref,
  ) {
    const fsBody = FS_BODY * textScale;

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
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
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

          {/* Body — texto único estilo tweet com imagem grudada */}
          <div
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {body && (
              <p
                style={{
                  fontSize: fsBody,
                  lineHeight: 1.35,
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
            {imageUrl && (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  borderRadius: 20,
                  overflow: "hidden",
                  border: `1px solid ${BORDER}`,
                  background: "#F0F0F0",
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
        </div>
      </div>
    );
  },
);
