/**
 * SVLauncher — landing da aba "Sequência Viral" no KAI 2.0.
 *
 * Substitui o `viral-sv-original/` (cópia literal via shims Next→Vite que
 * acumulou bugs de routing, CSS, scroll, params Promise/sync, RLS, etc).
 *
 * Estratégia: o KAI hospeda o resumo + lista de carrosseis recentes,
 * mas o flow ATIVO (criar, editar, gerar, exportar) abre na ferramenta
 * standalone (https://viral.kaleidos.com.br) em nova aba. Isso garante:
 *
 *   ✓ Experiência 100% funcional (SV standalone tá em produção há tempo)
 *   ✓ Sem fricção de shim Next 16 → Vite + RLS cross-domain
 *   ✓ Manutenção em 1 lugar (sequencia-viral repo)
 *   ✗ Carrosseis criados lá não syncam com Neon do KAI por enquanto
 *     (próximo sprint: SSO + DB unificado via API endpoint)
 *
 * Carrosseis legados que já estão no Neon do KAI continuam visíveis aqui
 * em modo read-only — usuário pode ver título/preview mas pra editar
 * precisa abrir a ferramenta.
 */

import { useEffect, useState } from "react";
import { ExternalLink, Plus, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SV_BASE_URL = "https://viral.kaleidos.com.br";

interface LegacyCarousel {
  id: string;
  title: string | null;
  template: string | null;
  status: string | null;
  updated_at: string;
}

interface SVLauncherProps {
  clientId?: string | null;
  client?: { id?: string; name?: string } | null;
}

export function SVLauncher({ clientId, client }: SVLauncherProps) {
  const [carousels, setCarousels] = useState<LegacyCarousel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let query = supabase
          .from("viral_carousels")
          .select("id,title,template,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(8);
        if (clientId) query = query.or(`client_id.eq.${clientId},client_id.is.null`);
        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          console.warn("[SVLauncher] failed to load carousels:", error.message);
          setCarousels([]);
        } else {
          setCarousels((data as LegacyCarousel[]) ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const openSV = (path: string) => {
    window.open(`${SV_BASE_URL}${path}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 lg:py-12">
        {/* Hero CTA */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-4">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
            Sequência Viral
            {client?.name && <span className="text-muted-foreground">· {client.name}</span>}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Carrosseis virais com IA
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-8">
            A ferramenta completa de criação roda em <code className="px-1.5 py-0.5 rounded bg-muted text-xs">viral.kaleidos.com.br</code>.
            Cliquei e abre numa nova aba com gerador, editor, preview e export prontos.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => openSV("/app/create/new")}
            >
              <Plus className="h-4 w-4" />
              Criar carrossel
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={() => openSV("/app/carousels")}
            >
              <Sparkles className="h-4 w-4" />
              Abrir meus carrosseis
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </div>
        </div>

        {/* Lista de carrosseis legacy salvos no Neon do KAI */}
        {carousels.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Salvos neste workspace ({carousels.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Carrosseis legados — abrir no Sequência Viral pra editar
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {carousels.map((c) => (
                <Card
                  key={c.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
                    "border-2 hover:border-foreground/40"
                  )}
                  onClick={() => openSV(`/app/create/${c.id}/edit`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm leading-snug line-clamp-2">
                      {c.title || "Sem título"}
                    </h3>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{c.template ?? "manifesto"}</span>
                    <span>·</span>
                    <span>{new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
                    {c.status === "published" && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-600">publicado</span>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && carousels.length === 0 && (
          <div className="mt-12 rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum carrossel salvo ainda. Clica em "Criar carrossel" pra começar.
            </p>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-12 pt-6 border-t border-border/40 text-xs text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">Por que abre em outra aba?</strong>{" "}
            A ferramenta standalone tem todos os recursos atualizados (templates, fontes,
            export PDF, agendamento). Em breve teremos integração nativa com SSO.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SVLauncher;
