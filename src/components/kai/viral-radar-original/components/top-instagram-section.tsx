/**
 * Seção do dashboard: Top 3 Instagram do dia.
 *
 * Lê /api/data/instagram/posts?sort=top&hours=48&limit=3.
 * Cada card expõe ações via <CrossAppActions />: Carrossel/Reel (bridge
 * inter-tab) + Ideia (cria planning_item) + Biblioteca (persiste em
 * client_reference_library). 2026-05-09: bookmark local removido —
 * Biblioteca substitui.
 */

import { useEffect, useState } from "react";
import { Link } from "../lib/next-shims";
import {
  ExternalLink,
  Heart,
  Instagram,
  Loader2,
  MessageSquare,
  ArrowRight,
  Video,
  Plus,
} from "lucide-react";
import { getJwtToken } from "../lib/auth-client";
import { imgProxy } from "../lib/img-proxy";
import { getCuratedSources } from "../lib/sources-curated";
import type { InstagramPostRow } from "../types";

// KAI cross-app actions — substituem os bridges legacy (Carrossel SV / Reel RV)
// que apontavam pra URLs externas standalone. Dentro do KAI, navegamos
// inter-tab via Zustand + setSearchParams.
import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";

interface Props {
  nicheId: string;
  isPaid: boolean;
  /** "video" filtra reels, "carousel" filtra carrosseis, undefined = tudo */
  mediaType?: "video" | "carousel";
  /** Quantos itens mostrar (default 3) */
  limit?: number;
  /** Override de title/eyebrow pra customizar a seção */
  title?: string;
  eyebrow?: string;
  /** ID do cliente Kaleidos atual — propagado pro CrossAppActions de cada
   * card pra que "Salvar na Biblioteca" persista em client_reference_library. */
  clientId?: string | null;
}

function isReel(p: InstagramPostRow): boolean {
  return p.type === "Video" || Boolean(p.video_url);
}
function isCarousel(p: InstagramPostRow): boolean {
  return (p.child_urls?.length ?? 0) > 1;
}

export function TopInstagramSection({
  nicheId,
  isPaid,
  mediaType,
  limit = 3,
  title,
  eyebrow,
  clientId = null,
}: Props) {
  const [items, setItems] = useState<InstagramPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2026-05-09 — bookmark local + /api/data/saved removidos. <CrossAppActions />
  // agora cobre Salvar→Biblioteca + Criar ideia→Planejamento.
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        // Quando filtramos por tipo, pegamos um pool maior pra ter chance
        // de encontrar `limit` itens do tipo desejado depois do filtro.
        const fetchLimit = mediaType ? Math.max(40, limit * 5) : limit;
        const postsRes = await fetch(
          `/api/radar-data-instagram?niche=${encodeURIComponent(
            nicheId,
          )}&sort=top&hours=48&limit=${fetchLimit}`,
          { headers },
        );
        if (!postsRes.ok) {
          if (!cancel) setError(`HTTP ${postsRes.status}`);
          return;
        }
        const data = (await postsRes.json()) as { posts: InstagramPostRow[] };
        let posts = data.posts ?? [];
        if (mediaType === "video") {
          posts = posts.filter(isReel);
        } else if (mediaType === "carousel") {
          posts = posts.filter(isCarousel);
        }
        posts = posts.slice(0, limit);
        if (!cancel) setItems(posts);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [nicheId, mediaType, limit]);

  // Título/eyebrow dinâmico baseado em mediaType (com override via props).
  const computedTitle =
    title ??
    (mediaType === "video"
      ? `Top ${limit} Reels do dia`
      : mediaType === "carousel"
        ? `Top ${limit} Carrosseis do dia`
        : `Top ${limit} Instagram do dia`);
  const computedEyebrow =
    eyebrow ??
    (mediaType === "video"
      ? "REELS EM ALTA"
      : mediaType === "carousel"
        ? "CARROSSEIS EM ALTA"
        : "INSTAGRAM EM ALTA");
  const computedSubtitle = isPaid
    ? `Top ${limit} dos perfis que você acompanha`
    : `Curadoria global · top ${limit} últimas 48h`;
  const emptyMsg = isPaid
    ? `Sem ${mediaType === "video" ? "reels" : mediaType === "carousel" ? "carrosseis" : "posts IG"} nas últimas 48h.`
    : "Sem fontes IG na curadoria desse nicho ainda.";

  return (
    <section style={{ marginBottom: 36 }}>
      <SectionHeader
        eyebrow={computedEyebrow}
        title={computedTitle}
        subtitle={computedSubtitle}
        icon={<Instagram size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      ) : error ? (
        <EmptyCard msg={`Erro ao carregar IG (${error}).`} />
      ) : !items.length ? (
        <RichEmptyIG
          nicheId={nicheId}
          mediaType={mediaType}
          isPaid={isPaid}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((p) => (
            <InstagramCard
              key={p.shortcode}
              post={p}
              clientId={clientId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InstagramCard({
  post,
  clientId,
}: {
  post: InstagramPostRow;
  clientId?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const caption = (post.caption ?? "").trim();
  const truncated =
    caption.length > 80 ? caption.slice(0, 80).trimEnd() + "…" : caption;
  const igUrl = `https://www.instagram.com/p/${post.shortcode}/`;
  // Fallback chain: display_url → 1º child_url. Filtra null.
  const previewUrl =
    post.display_url ||
    post.child_urls?.find((u): u is string => typeof u === "string" && Boolean(u)) ||
    null;
  const isVideo = post.type === "Video" || Boolean(post.video_url);
  return (
    <div
      className="rdv-card"
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <a
        href={igUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          aspectRatio: "1",
          background: "var(--color-rdv-paper)",
          position: "relative",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
          overflow: "hidden",
        }}
      >
        {previewUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgProxy(previewUrl)}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <CompactPlaceholder
            handle={post.account_handle}
            caption={post.caption}
            isVideo={isVideo}
          />
        )}
      </a>
      <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
        <div
          className="rdv-mono"
          style={{
            fontSize: 10,
            color: "var(--color-rdv-muted)",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          @{post.account_handle}
        </div>
        {truncated && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              color: "var(--color-rdv-ink)",
            }}
          >
            {truncated}
          </p>
        )}
        <div
          className="rdv-mono"
          style={{
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: "var(--color-rdv-muted)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Heart size={11} /> {formatCount(post.likes)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MessageSquare size={11} /> {formatCount(post.comments)}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
          <a
            href={igUrl}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <ExternalLink size={10} /> Abrir
          </a>
          {/* KAI bridge — Carrossel/Reel + Ideia (planning_items) +
              Biblioteca (client_reference_library). Substitui o bookmark
              local + svBridgeFromIg/rvBridgeFromIg legados. */}
          <CrossAppActions
            source="radar"
            topic={post.caption?.slice(0, 200) ?? `Post de @${post.account_handle}`}
            briefing={post.caption ?? undefined}
            url={igUrl}
            clientId={clientId}
            metadata={{
              shortcode: post.shortcode,
              accountHandle: post.account_handle,
              type: isVideo ? "instagram_reel" : "instagram_post",
              format: isVideo ? "reel" : "carousel",
              platform: "instagram",
              thumbnail_url: post.display_url ?? null,
            }}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

// svBridgeFromIg / rvBridgeFromIg removidos 2026-05-08 — substituídos pelo
// <CrossAppActions /> inline (linha ~352) que opera via Zustand pendingBriefing
// + tab swap dentro do shell do KAI.

/**
 * Placeholder compacto pra grid do dashboard quando preview do IG falha.
 * Mesma vibe da PostPlaceholder do /app/instagram mas otimizado pra
 * tile menor (aspect-ratio 1:1).
 */
/**
 * Empty state rico pra IG: explica o motivo + lista 3 handles curados
 * do nicho que vão entrar quando o cron rodar / quando user adicionar.
 *
 * Substitui o card "vazio" simples — empty state com utilidade vira
 * onboarding implícito.
 */
function RichEmptyIG({
  nicheId,
  mediaType,
  isPaid,
}: {
  nicheId: string;
  mediaType?: "video" | "carousel";
  isPaid: boolean;
}) {
  const curated = getCuratedSources(nicheId);
  const suggestions = (curated?.igHandles ?? []).slice(0, 4);
  const typeLabel =
    mediaType === "video"
      ? "reels"
      : mediaType === "carousel"
        ? "carrosseis"
        : "posts";
  return (
    <div
      className="rdv-card"
      style={{
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 4,
          }}
        >
          Sem {typeLabel} nas últimas 48h
        </h3>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--color-rdv-muted)",
            lineHeight: 1.5,
          }}
        >
          {isPaid
            ? `Os perfis que você acompanha não publicaram ${typeLabel} no período. Adicione mais fontes pra ter mais material.`
            : `O cron global ainda não pegou ${typeLabel} desse nicho. Cheque os perfis do catálogo direto:`}
        </p>
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {suggestions.map((s) => (
            <a
              key={s.handle}
              href={`https://www.instagram.com/${s.handle}/`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "var(--color-rdv-paper)",
                border: "1px solid var(--color-rdv-line)",
                color: "var(--color-rdv-ink)",
                textDecoration: "none",
                fontSize: 12.5,
                transition: "border-color 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-rdv-rec)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-rdv-line)")
              }
            >
              <Instagram size={13} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
                @{s.handle}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-rdv-muted)",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  maxWidth: 180,
                }}
              >
                {s.label}
              </span>
              <ExternalLink size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}

      <Link
        href="/app/settings"
        className="rdv-btn rdv-btn-ghost"
        style={{ padding: "8px 12px", fontSize: 10.5, alignSelf: "flex-start" }}
      >
        <Plus size={11} /> Adicionar handles
      </Link>
    </div>
  );
}

function CompactPlaceholder({
  handle,
  caption,
  isVideo,
}: {
  handle: string;
  caption: string | null;
  isVideo: boolean;
}) {
  const snippet = (caption ?? "").trim().slice(0, 60);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "repeating-linear-gradient(135deg, var(--color-rdv-paper) 0 8px, var(--color-rdv-cream) 8px 14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        textAlign: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--color-rdv-ink)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isVideo ? <Video size={18} /> : <Instagram size={18} />}
      </div>
      <div
        className="rdv-mono"
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "var(--color-rdv-ink)",
          letterSpacing: "0.04em",
          wordBreak: "break-word",
        }}
      >
        @{handle}
      </div>
      {snippet && (
        <p
          style={{
            fontSize: 9.5,
            color: "var(--color-rdv-muted)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {snippet}
        </p>
      )}
    </div>
  );
}

function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
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

function EmptyCard({
  msg,
  ctaHref,
  ctaLabel,
}: {
  msg: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      className="rdv-card"
      style={{
        padding: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>{msg}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 12px", fontSize: 10 }}
        >
          {ctaLabel}
          <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}
