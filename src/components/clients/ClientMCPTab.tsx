/**
 * ClientMCPTab — exemplos contextualizados de uso do MCP kAI
 * focados no cliente atualmente aberto.
 *
 * O MCP em si é workspace-wide (token único, configurado em
 * Settings → Sistema → MCP kAI). Esta tab simplesmente:
 *   - mostra o `client_id` em mono pra copiar fácil
 *   - dá exemplos de prompt prontos pro Claude Code que já incluem
 *     o id deste cliente (gerar carrossel, puxar métricas, etc)
 *   - aponta pra Settings → Sistema → MCP kAI pra detalhes técnicos
 *
 * Reorg 2026-05-09 — antes a documentação MCP era item solto no
 * footer da sidebar, descontextualizada do cliente.
 */
import { useState } from "react";
import { Copy, Check, Terminal, ExternalLink, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

interface ClientMCPTabProps {
  clientId: string;
  clientName: string;
}

export function ClientMCPTab({ clientId, clientName }: ClientMCPTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const slug = (workspace as { slug?: string })?.slug || "";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Exemplos de prompts prontos com o client_id já injetado.
  const carouselPrompt = `use kaleidos-kai pra criar um carrossel pro ${clientName} sobre {tema}. Use create_viral_carousel com client_id="${clientId}" e num_slides=7.`;

  const metricsPrompt = `use kaleidos-kai pra puxar as métricas dos últimos 30 dias do ${clientName}. Use get_metrics com client_id="${clientId}" pra Instagram + LinkedIn.`;

  const planningPrompt = `use kaleidos-kai pra criar 3 cards de planning pro ${clientName} essa semana. Use create_planning_item passando client_id="${clientId}" pra cada um.`;

  const handleOpenMCPSettings = () => {
    if (slug) {
      navigate(`/${slug}?tab=settings&section=mcp`);
    } else {
      navigate(`/kaleidos?tab=settings&section=mcp`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">MCP kAI · contexto deste cliente</CardTitle>
          </div>
          <CardDescription>
            Exemplos prontos pra usar no Claude Code referenciando este cliente.
            O servidor MCP em si é workspace-wide e configurado em Configurações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* client_id pronto pra copiar */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              client_id
            </label>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2.5">
              <code className="text-xs font-mono flex-1 break-all">{clientId}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => copy(clientId, "client-id")}
              >
                {copiedKey === "client-id" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este é o identificador único deste cliente no banco. Use ele em qualquer
              chamada MCP que filtra/cria conteúdo para {clientName}.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleOpenMCPSettings} className="gap-2">
              <Terminal className="h-3.5 w-3.5" />
              Abrir docs MCP completas
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Workspace-wide
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Prompts prontos</CardTitle>
          </div>
          <CardDescription>
            Cole no Claude Code com o MCP kAI conectado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PromptBlock
            label="Gerar carrossel viral"
            prompt={carouselPrompt}
            copied={copiedKey === "p-carousel"}
            onCopy={() => copy(carouselPrompt, "p-carousel")}
          />
          <PromptBlock
            label="Puxar métricas (30d)"
            prompt={metricsPrompt}
            copied={copiedKey === "p-metrics"}
            onCopy={() => copy(metricsPrompt, "p-metrics")}
          />
          <PromptBlock
            label="Criar 3 cards no planning"
            prompt={planningPrompt}
            copied={copiedKey === "p-planning"}
            onCopy={() => copy(planningPrompt, "p-planning")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function PromptBlock({
  label,
  prompt,
  copied,
  onCopy,
}: {
  label: string;
  prompt: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="h-3 w-3 text-primary" /> Copiado
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copiar
            </>
          )}
        </Button>
      </div>
      <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
        {prompt}
      </pre>
    </div>
  );
}
