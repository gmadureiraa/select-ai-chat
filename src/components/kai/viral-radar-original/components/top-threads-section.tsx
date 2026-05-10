/**
 * Seção do dashboard: Top posts virais do Threads.
 *
 * Lê /api/radar-data-threads?niche=&hours=168&limit=12&sort=top.
 * Threads scraping rodando via cron-scrape-threads → viral_threads_posts.
 *
 * Cards expõem <CrossAppActions /> (Carrossel + Ideia + Biblioteca).
 * showReel=false porque post de texto não converte direto pra reel.
 */

import { useEffect, useState } from "react";
import { Link } from "../lib/next-shims";
import {
  AtSign,
  ExternalLink,
  Heart,
  Loader2,
  MessageSquare,
  Repeat2,
  Plus,
} from "lucide-react";
import { getJwtToken } from "../lib/auth-client";
import type { ThreadsPostRow } from "../types";

import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";

interface Props {
  nicheId: string;
  isPaid: boolean;
  /** Quantos posts mostrar (default 12) */
  limit?: number;
  /** Janela em horas — default 168h (7 dias) */
  hours?: number;
  /** Override de title/eyebrow */
  title?: string;
  eyebrow?: string;
  /** ID do cliente Kaleidos atual */
  clientId?: string | null;
}

export function TopThreadsSection({
  nicheId,
  isPaid,
  limit = 12,
  hours = 168,
  title,
  eyebrow,
  clientId = null,
}: Props) {
  const [items, setItems] = useState<ThreadsPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const url = `/api/radar-data-threads?niche=${encodeURIComponent(
          nicheId,
        )}&sort=top&hours=${hours}&limit=${limit}`;
        const r = await fetch(url, { headers });
        if (!r.ok) {
          if (!cancel) setError(`HTTP ${r.status}`);
          return;
        }
        const data = (await r.json()) as { posts: ThreadsPostRow[] };
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

  const computedTitle = title ?? `Top Threads`;
  const computedEyebrow = eyebrow ?? "THREADS EM ALTA";
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
        icon={<AtSign size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" aria-label="Carregando" />
        </div>
      ) : error ? (
        <EmptyCard msg={`Erro ao carregar Threads (${error}).`} />
      ) : !items.length ? (
        <RichEmpty platform="Threads" daysLabel={daysLabel} isPaid={isPaid} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((p) => (
            <ThreadsCard key={p.url} post={p} clientId={clientId} />
          ))}
        </div>
      )}
    </section>
  );
}

function ThreadsCard({
  post,
  clientId,
}: {
  post: ThreadsPostRow;
  clientId?: string | null;
}) {
  const text = (post.text_content ?? "").trim();
  const truncated =
    text.length > 200 ? text.slice(0, 200).trimEnd() + "…" : text;
  const ago = relativeTime(post.posted_at);
  const totalEng =
    (post.likes ?? 0) + (post.reposts ?? 0) + (post.replies ?? 0);

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
      {/* Header: avatar fake + handle + plataforma badge */}
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PlatformAvatar handle={post.author_handle} platform="threads" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="rdv-mono"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "var(--color-rdv-ink)",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            @{post.author_handle}
          </div>
          {ago && (
            <div
              className="rdv-mono"
              style={{
                fontSize: 9.5,
                color: "var(--color-rdv-muted)",
                letterSpacing: "0.08em",
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
            // Threads = preto (foreground) — sem color institucional próprio
            background: "rgba(10, 9, 8, 0.08)",
            color: "var(--color-rdv-ink)",
            border: "1px solid rgba(10, 9, 8, 0.15)",
          }}
        >
          THREADS
        </span>
      </header>

      {/* Texto do post */}
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

      {/* Stats */}
      <div
        className="rdv-mono"
        style={{
          display: "flex",
          gap: 14,
          fontSize: 10.5,
          color: "var(--color-rdv-muted)",
          flexWrap: "wrap",
        }}
        aria-label={`${totalEng} engajamentos totais`}
      >
        <span style={iconStat}>
          <Heart size={11} aria-hidden /> {formatCount(post.likes)}
        </span>
        <span style={iconStat}>
          <Repeat2 size={11} aria-hidden /> {formatCount(post.reposts)}
        </span>
        <span style={iconStat}>
          <MessageSquare size={11} aria-hidden /> {formatCount(post.replies)}
        </span>
        {post.views != null && (
          <span style={iconStat} title="Visualizações">
            👁 {formatCount(post.views)}
          </span>
        )}
      </div>

      {/* Ações */}
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
          aria-label="Abrir post no Threads"
        >
          <ExternalLink size={10} aria-hidden /> Abrir
        </a>
        <CrossAppActions
          source="radar"
          topic={text.slice(0, 200) || `Post de @${post.author_handle}`}
          briefing={text || undefined}
          url={post.url}
          clientId={clientId}
          metadata={{
            platform: "threads",
            type: "threads_post",
            format: "carousel",
            authorHandle: post.author_handle,
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

// ─── Helpers compartilháveis (locais por hora — TODO: extrair pra _shared) ────

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
        ? "rgb(14, 165, 233)" // sky-500
        : "rgb(29, 78, 216)"; // blue-700
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
            ? `Os perfis ${platform} que você acompanha não tiveram engajamento forte no período. Adicione mais fontes no painel.`
            : `O cron global ainda não pegou posts ${platform} desse nicho. Volte daqui a algumas horas ou ative o Pro pra ter cron próprio.`}
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
