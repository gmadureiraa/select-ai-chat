/**
 * Seção do dashboard: Top posts virais do LinkedIn.
 *
 * Lê /api/radar-data-linkedin?niche=&hours=168&limit=12&sort=top.
 * Cron-scrape-linkedin popula viral_linkedin_posts com reactions/comments/
 * shares + author_headline (B2B context vai forte aqui).
 *
 * Cards expõem <CrossAppActions /> (Carrossel + Ideia + Biblioteca).
 * showReel=false (post de texto longo do LI não vira reel).
 */

import { useEffect, useState } from "react";
import { Link } from "../lib/next-shims";
import {
  ExternalLink,
  Loader2,
  MessageSquare,
  Linkedin,
  ThumbsUp,
  Share2,
  Plus,
} from "lucide-react";
import { getJwtToken } from "../lib/auth-client";
import type { LinkedInPostRow } from "../types";

import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";

interface Props {
  nicheId: string;
  isPaid: boolean;
  limit?: number;
  hours?: number;
  title?: string;
  eyebrow?: string;
  clientId?: string | null;
}

export function TopLinkedinSection({
  nicheId,
  isPaid,
  limit = 12,
  hours = 168,
  title,
  eyebrow,
  clientId = null,
}: Props) {
  const [items, setItems] = useState<LinkedInPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const url = `/api/radar-data-linkedin?niche=${encodeURIComponent(
          nicheId,
        )}&sort=top&hours=${hours}&limit=${limit}`;
        const r = await fetch(url, { headers });
        if (!r.ok) {
          if (!cancel) setError(`HTTP ${r.status}`);
          return;
        }
        const data = (await r.json()) as { posts: LinkedInPostRow[] };
        if (!cancel) setItems(data.posts ?? []);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [nicheId, limit, hours]);

  const computedTitle = title ?? `Top LinkedIn`;
  const computedEyebrow = eyebrow ?? "LINKEDIN EM ALTA";
  const daysLabel = Math.round(hours / 24);
  const computedSubtitle = isPaid
    ? `Top ${limit} dos perfis que você acompanha · últimos ${daysLabel}d`
    : `Curadoria global · top ${limit} últimos ${daysLabel}d`;

  return (
    <section style={{ marginBottom: 36 }}>
      <SectionHeader
        eyebrow={computedEyebrow}
        title={computedTitle}
        subtitle={computedSubtitle}
        icon={<Linkedin size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" aria-label="Carregando" />
        </div>
      ) : error ? (
        <EmptyCard msg={`Erro ao carregar LinkedIn (${error}).`} />
      ) : !items.length ? (
        <RichEmpty platform="LinkedIn" daysLabel={daysLabel} isPaid={isPaid} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((p) => (
            <LinkedInCard key={p.post_id} post={p} clientId={clientId} />
          ))}
        </div>
      )}
    </section>
  );
}

function LinkedInCard({
  post,
  clientId,
}: {
  post: LinkedInPostRow;
  clientId?: string | null;
}) {
  const text = (post.text_content ?? "").trim();
  // LinkedIn aceita posts mais longos — corte um pouco mais generoso (240 chars).
  const truncated =
    text.length > 240 ? text.slice(0, 240).trimEnd() + "…" : text;
  const ago = relativeTime(post.posted_at);
  const reactionsTotal = post.reactions ?? post.likes ?? 0;

  return (
    <article
      className="rdv-card"
      style={{
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PlatformAvatar
          handle={post.author_handle ?? post.author_name}
          platform="linkedin"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--color-rdv-ink)",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {post.author_name ?? post.author_handle ?? "Autor"}
          </div>
          {post.author_headline && (
            <div
              style={{
                fontSize: 10.5,
                color: "var(--color-rdv-muted)",
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.author_headline}
            </div>
          )}
          {ago && (
            <div
              className="rdv-mono"
              style={{
                fontSize: 9.5,
                color: "var(--color-rdv-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {ago}
            </div>
          )}
        </div>
        <span
          className="rdv-mono"
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            letterSpacing: "0.14em",
            padding: "3px 7px",
            // LinkedIn — azul corporativo (blue-700)
            background: "rgba(29, 78, 216, 0.1)",
            color: "rgb(29, 78, 216)",
            border: "1px solid rgba(29, 78, 216, 0.25)",
          }}
        >
          IN
        </span>
      </header>

      {truncated && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: "var(--color-rdv-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {truncated}
        </p>
      )}

      <div
        className="rdv-mono"
        style={{
          display: "flex",
          gap: 14,
          fontSize: 10.5,
          color: "var(--color-rdv-muted)",
          flexWrap: "wrap",
        }}
      >
        <span style={iconStat} title="Reações totais">
          <ThumbsUp size={11} aria-hidden /> {formatCount(reactionsTotal)}
        </span>
        <span style={iconStat}>
          <MessageSquare size={11} aria-hidden /> {formatCount(post.comments)}
        </span>
        <span style={iconStat}>
          <Share2 size={11} aria-hidden /> {formatCount(post.shares)}
        </span>
        {post.post_type && post.post_type !== "text" && (
          <span
            style={{
              ...iconStat,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: 9,
              color: "var(--color-rdv-rec)",
            }}
          >
            {post.post_type}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          marginTop: 2,
        }}
      >
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "5px 10px", fontSize: 9 }}
          aria-label="Abrir no LinkedIn"
        >
          <ExternalLink size={10} aria-hidden /> Abrir
        </a>
        <CrossAppActions
          source="radar"
          topic={
            text.slice(0, 200) ||
            `Post de ${post.author_name ?? post.author_handle}`
          }
          briefing={text || undefined}
          url={post.url}
          clientId={clientId}
          metadata={{
            platform: "linkedin",
            type: "linkedin_post",
            format: "carousel",
            authorHandle: post.author_handle,
            authorName: post.author_name,
            postType: post.post_type,
          }}
          showReel={false}
          size="sm"
        />
      </div>
    </article>
  );
}

const iconStat: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

function PlatformAvatar({
  handle,
  platform,
}: {
  handle: string | null;
  platform: "threads" | "twitter" | "linkedin";
}) {
  const initial = (handle ?? "?").trim().charAt(0).toUpperCase() || "?";
  const bg =
    platform === "threads"
      ? "var(--color-rdv-ink)"
      : platform === "twitter"
        ? "rgb(14, 165, 233)"
        : "rgb(29, 78, 216)";
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: bg,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-geist-mono)",
        fontWeight: 800,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

function RichEmpty({
  platform,
  daysLabel,
  isPaid,
}: {
  platform: string;
  daysLabel: number;
  isPaid: boolean;
}) {
  return (
    <div
      className="rdv-card"
      style={{
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
          Nenhum post viral nas últimas {daysLabel}d
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.5 }}>
          {isPaid
            ? `Os perfis ${platform} que você acompanha não tiveram engajamento forte. Adicione mais fontes.`
            : `O cron global ainda não pegou posts ${platform} desse nicho. Volte mais tarde ou ative o Pro.`}
        </p>
      </div>
      <Link
        href="/app/settings"
        className="rdv-btn rdv-btn-ghost"
        style={{ padding: "8px 12px", fontSize: 10.5, alignSelf: "flex-start" }}
      >
        <Plus size={11} aria-hidden /> Adicionar perfis
      </Link>
    </div>
  );
}

function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return "agora";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  return `há ${d}d`;
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          className="rdv-display"
          style={{
            fontSize: 26,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--color-rdv-rec)" }}>{icon}</span>
          {title}
        </div>
        {subtitle && (
          <span
            className="rdv-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ msg }: { msg: string }) {
  return (
    <div
      className="rdv-card"
      style={{
        padding: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>{msg}</p>
    </div>
  );
}
