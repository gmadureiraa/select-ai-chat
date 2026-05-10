/**
 * Seção do dashboard: Notícias em alta hoje.
 *
 * Lê /api/data/news com janela curta (48h) e mostra top N artigos. Cada
 * card expõe link direto pra fonte + <CrossAppActions /> (Carrossel +
 * Ideia em planejamento + Biblioteca de refs). Empty state CTA pro
 * settings. 2026-05-09: bookmark local removido — substituido pela
 * Biblioteca (client_reference_library).
 */

import { useEffect, useState } from "react";
import { Link } from "../lib/next-shims";
import {
  ExternalLink,
  Loader2,
  Newspaper,
  ArrowRight,
} from "lucide-react";
import { getJwtToken } from "../lib/auth-client";
import type { NewsArticleRow } from "../types";

// KAI cross-app actions: "→ Carrossel" / "→ Reel" / "Salvar ideia"
import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";

interface Props {
  nicheId: string;
  isPaid: boolean;
  /** ID do cliente Kaleidos atual — propagado pro CrossAppActions de cada
   * card pra que "Salvar na Biblioteca" persista em client_reference_library. */
  clientId?: string | null;
}

export function TopNewsSection({ nicheId, isPaid, clientId = null }: Props) {
  const [items, setItems] = useState<NewsArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toggle: por padrão mostra só atualizações concretas (kind=news).
  // User pode trocar pra "tudo" pra incluir análises/opinião.
  const [showAll, setShowAll] = useState(false);

  // 2026-05-09 — bookmark local + /api/data/saved removidos.
  // <CrossAppActions /> cobre Salvar→Biblioteca + Criar ideia→Planejamento.
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const kindParam = showAll ? "" : "&kind=news";
        const newsRes = await fetch(
          `/api/radar-data-news?niche=${encodeURIComponent(nicheId)}&hours=48&limit=10${kindParam}`,
          { headers },
        );
        if (!newsRes.ok) {
          if (!cancel) setError(`HTTP ${newsRes.status}`);
          return;
        }
        const data = (await newsRes.json()) as { articles: NewsArticleRow[] };
        if (!cancel) setItems(data.articles ?? []);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [nicheId, showAll]);

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <SectionHeader
          eyebrow="NOTÍCIAS EM ALTA"
          title={showAll ? "Notícias + análises" : "Atualizações de hoje"}
          subtitle={
            showAll
              ? "Tudo que saiu nas suas fontes (incluindo opinião)"
              : "Anúncios, lançamentos, números — sem opinião"
          }
          icon={<Newspaper size={16} />}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={!showAll ? "rdv-btn rdv-btn-rec" : "rdv-btn rdv-btn-ghost"}
            style={{ padding: "6px 12px", fontSize: 9.5, letterSpacing: "0.12em" }}
            aria-pressed={!showAll}
          >
            SÓ NEWS
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={showAll ? "rdv-btn rdv-btn-rec" : "rdv-btn rdv-btn-ghost"}
            style={{ padding: "6px 12px", fontSize: 9.5, letterSpacing: "0.12em" }}
            aria-pressed={showAll}
          >
            TUDO
          </button>
        </div>
      </div>
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      ) : error ? (
        <EmptyCard
          msg={`Erro ao carregar notícias (${error}).`}
        />
      ) : !items.length ? (
        <EmptyCard
          msg={
            isPaid
              ? "Sem notícias nas últimas 48h. Adicione mais fontes RSS."
              : "Sem notícias nas últimas 48h. Adicione fontes RSS pra ter feed próprio."
          }
          ctaHref="/app/settings"
          ctaLabel="Adicionar fontes →"
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((a) => (
            <NewsCard
              key={a.link}
              article={a}
              clientId={clientId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsCard({
  article,
  clientId,
}: {
  article: NewsArticleRow;
  clientId?: string | null;
}) {
  const ago = relativeTime(article.pub_date);
  return (
    <div
      className="rdv-card"
      style={{
        padding: "12px 16px",
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      {article.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.thumbnail}
          alt=""
          loading="lazy"
          style={{
            width: 64,
            height: 64,
            objectFit: "cover",
            flexShrink: 0,
            background: "var(--color-rdv-paper)",
            border: "1px solid var(--color-rdv-line)",
          }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            background: article.source_color ?? "var(--color-rdv-paper)",
            border: "1px solid var(--color-rdv-line)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {(article.source_name ?? "?").slice(0, 2).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          {article.kind === "analysis" && (
            <span
              className="rdv-mono"
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: "0.16em",
                padding: "2px 6px",
                background: "var(--color-rdv-paper)",
                border: "1px solid var(--color-rdv-line)",
                color: "var(--color-rdv-muted)",
                marginTop: 2,
              }}
              title="Classificado como análise/opinião"
            >
              ANÁLISE
            </span>
          )}
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.25,
              flex: 1,
              minWidth: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </h3>
        </div>
        <div
          className="rdv-mono"
          style={{
            fontSize: 10,
            color: "var(--color-rdv-muted)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>
            {article.source_name ?? "Fonte"}
          </span>
          {ago && <span>· {ago}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9 }}
          aria-label="Abrir notícia"
        >
          <ExternalLink size={11} />
        </a>
        {/* KAI bridge — notícia vira briefing pra Carrossel + Ideia +
            Biblioteca. Reels desligado pq matéria de texto não vira reel
            direto. Bookmark local foi removido (deprecated 2026-05-09). */}
        <CrossAppActions
          source="radar"
          topic={article.title}
          briefing={article.title}
          url={article.link}
          clientId={clientId}
          metadata={{
            sourceName: article.source_name,
            type: "news",
            kind: article.kind,
            format: "article",
            platform: "web",
          }}
          showReel={false}
          size="sm"
        />
      </div>
    </div>
  );
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

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return "agora";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  return `${d}d atrás`;
}
