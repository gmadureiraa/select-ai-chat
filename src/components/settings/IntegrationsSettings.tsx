/**
 * IntegrationsSettings — visão centralizada das integrações externas usadas
 * pelo workspace (Metricool, Apify, Gemini, OpenAI, Anthropic, Late.so).
 *
 * IMPORTANTE: chaves de API ficam em env vars Vercel (não no DB), então
 * essa tela é read-only — mostra status (configurada/faltando), origem e
 * link pra documentação. Permite testar a conexão quando há endpoint
 * interno seguro pra isso.
 *
 * Adicionado em 2026-05-09 como melhoria P1 da auditoria de Settings.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle2, XCircle, ExternalLink, Sparkles, BarChart3, Bot, Camera, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface IntegrationStatus {
  configured: boolean;
  detail?: string;
}

interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  envVar: string;
  docsUrl?: string;
  testEdgeFn?: string;
  storage: "vercel" | "user-credentials" | "workspace";
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Geração de carrosséis, briefs e análise de imagens (Imagen 4 + Flash).",
    icon: Sparkles,
    envVar: "GEMINI_API_KEY",
    docsUrl: "https://ai.google.dev/",
    storage: "vercel",
  },
  {
    id: "apify",
    name: "Apify",
    description: "Scraping de Instagram, TikTok e Threads usado pelo Radar e Reels.",
    icon: Camera,
    envVar: "APIFY_API_KEY",
    docsUrl: "https://docs.apify.com/api/v2",
    storage: "vercel",
  },
  {
    id: "metricool",
    name: "Metricool",
    description: "Métricas, hashtags, concorrentes e relatórios de redes sociais.",
    icon: BarChart3,
    envVar: "METRICOOL_API_KEY",
    docsUrl: "https://metricool.com/api/",
    storage: "vercel",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Geração de copywriting longo e análise contextual avançada.",
    icon: Bot,
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://docs.anthropic.com/",
    storage: "vercel",
  },
  {
    id: "late",
    name: "Late.so",
    description: "Publicação automática multi-plataforma (alternativa ao Metricool publish).",
    icon: Send,
    envVar: "LATE_API_KEY",
    docsUrl: "https://docs.getlate.dev/",
    storage: "vercel",
  },
];

export function IntegrationsSettings() {
  const { toast } = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);

  // Pega status server-side via uma edge function que verifica env vars sem
  // expor valores. Caso a fn não exista, fallback graceful: mostra "ver Vercel".
  const { data: serverStatus, isLoading } = useQuery({
    queryKey: ["integrations-server-status"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-integrations-status", {
          body: {},
        });
        if (error) throw error;
        return (data || {}) as Record<string, IntegrationStatus>;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const handleTest = async (integration: IntegrationDef) => {
    if (!integration.testEdgeFn) {
      toast({
        title: "Teste indisponível",
        description: `${integration.name} ainda não tem endpoint de teste no app.`,
      });
      return;
    }
    setTestingId(integration.id);
    try {
      const { data, error } = await supabase.functions.invoke(integration.testEdgeFn);
      if (error) throw error;
      toast({
        title: "Conexão OK",
        description: data?.message || `${integration.name} respondeu com sucesso.`,
      });
    } catch (e: any) {
      toast({
        title: "Falha no teste",
        description: e?.message || "Erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Integrações</CardTitle>
          </div>
          <CardDescription>
            Chaves de API e serviços externos. Configurações ficam em env vars do Vercel — esta tela só mostra status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            const status = serverStatus?.[integration.id];
            // Quando edge fn ausente: assume "indeterminate" (não OK, não erro).
            const indeterminate = serverStatus === null;
            const configured = status?.configured ?? false;
            const isTesting = testingId === integration.id;

            return (
              <div
                key={integration.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{integration.name}</span>
                    {isLoading ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        verificando
                      </Badge>
                    ) : indeterminate ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        ver Vercel
                      </Badge>
                    ) : configured ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        configurada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        faltando
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
                      {integration.envVar}
                    </code>
                    {status?.detail && (
                      <span className="text-[10px] text-muted-foreground">{status.detail}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {integration.docsUrl && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                    >
                      <a
                        href={integration.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Docs
                      </a>
                    </Button>
                  )}
                  {integration.testEdgeFn && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleTest(integration)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Testar"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Como configurar</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            As chaves ficam em variáveis de ambiente do Vercel (<code className="bg-muted/60 px-1 py-0.5 rounded">vercel env</code>) por segurança.
            Para adicionar ou rotacionar uma chave:
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Acesse o painel do Vercel do projeto.</li>
            <li>Vá em Settings → Environment Variables.</li>
            <li>Adicione/edite a variável (ex: <code className="bg-muted/60 px-1 py-0.5 rounded">GEMINI_API_KEY</code>) em todos os ambientes.</li>
            <li>Faça redeploy ou aguarde o próximo build pra propagar.</li>
          </ol>
          <p className="pt-2">
            Conexões OAuth de redes sociais (Instagram, LinkedIn, TikTok etc) ficam por cliente em <strong>Cliente → Integrações</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
