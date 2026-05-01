import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Webhook, Copy, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/late-webhook`;

const SUPPORTED_EVENTS: Array<{
  id: string;
  label: string;
  severity: "alert" | "info" | "silent";
  description: string;
}> = [
  { id: "post.published", label: "post.published", severity: "info", description: "Move o card para Publicado e registra a URL." },
  { id: "post.failed", label: "post.failed", severity: "alert", description: "Marca como Falha e dispara alerta no Telegram." },
  { id: "post.partial", label: "post.partial", severity: "alert", description: "Marca como Parcial e lista as redes que falharam no Telegram." },
  { id: "post.scheduled", label: "post.scheduled", severity: "info", description: "Confirma que a Late agendou o post." },
  { id: "post.cancelled", label: "post.cancelled", severity: "alert", description: "Marca como Cancelado e avisa no Telegram." },
  { id: "post.recycled", label: "post.recycled", severity: "silent", description: "Salva nova URL no metadata (silencioso)." },
  { id: "account.disconnected", label: "account.disconnected", severity: "alert", description: "Remove credencial e avisa no Telegram para reconectar." },
  { id: "account.expired", label: "account.expired", severity: "alert", description: "Marca credencial como inválida e avisa no Telegram." },
];

const severityStyles: Record<string, string> = {
  alert: "bg-red-500/10 text-red-400 border-red-500/30",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  silent: "bg-muted text-muted-foreground border-border",
};

export function WebhookSettings() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["webhook-events-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events_log" as any)
        .select("id, event_type, processed_ok, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        event_type: string;
        processed_ok: boolean;
        error_message: string | null;
        created_at: string;
      }>;
    },
    refetchInterval: 30_000,
  });

  const lastEvent = events?.[0];
  const failureCount = (events || []).filter((e) => !e.processed_ok).length;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast({ title: "URL copiada", description: "Cole no painel da Late/Zernio." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Webhooks Late / Zernio</CardTitle>
          </div>
          <CardDescription>
            Receba eventos da Late em tempo real: falhas de publicação, contas desconectadas, posts agendados.
            Configure no painel da Late em <strong>Settings → Webhooks → Create Webhook</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase">URL do webhook</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md font-mono break-all">
                {WEBHOOK_URL}
              </code>
              <Button size="sm" variant="outline" onClick={copyUrl}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase">Secret Key (HMAC)</div>
            <p className="text-sm text-muted-foreground">
              Está armazenado como <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">LATE_WEBHOOK_SECRET</code> no kAI.
              Cole o mesmo valor no campo <em>Secret Key</em> da Late para validarmos a assinatura
              <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded ml-1">X-Late-Signature</code>.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase">Eventos suportados</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUPPORTED_EVENTS.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-2.5"
                >
                  <Badge variant="outline" className={`${severityStyles[ev.severity]} font-mono text-[10px] shrink-0 mt-0.5`}>
                    {ev.severity === "alert" ? "alerta" : ev.severity === "info" ? "info" : "silencioso"}
                  </Badge>
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-medium">{ev.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{ev.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Últimos eventos recebidos</CardTitle>
            </div>
            {lastEvent ? (
              <Badge variant="outline" className="text-[10px]">
                último há {formatDistanceToNow(new Date(lastEvent.created_at), { locale: ptBR })}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                nenhum evento ainda
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {failureCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {failureCount} eventos com erro nas últimas execuções.
            </div>
          )}

          {!events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento ainda. Configure o webhook na Late para começar a receber.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 py-2 text-xs">
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                      ev.processed_ok ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[11px]">{ev.event_type}</code>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                    {ev.error_message && (
                      <div className="text-[11px] text-red-400 mt-0.5 truncate">{ev.error_message}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
