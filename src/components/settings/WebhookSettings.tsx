import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Webhook,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  RotateCcw,
  Search,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/late-webhook`;

const SUPPORTED_EVENTS = [
  { id: "post.published", label: "post.published", severity: "info", description: "Move o card para Publicado e registra a URL." },
  { id: "post.failed", label: "post.failed", severity: "alert", description: "Marca como Falha e dispara alerta no Telegram." },
  { id: "post.partial", label: "post.partial", severity: "alert", description: "Marca como Parcial e lista as redes que falharam." },
  { id: "post.scheduled", label: "post.scheduled", severity: "info", description: "Confirma que a Late agendou o post." },
  { id: "post.cancelled", label: "post.cancelled", severity: "alert", description: "Marca como Cancelado e avisa no Telegram." },
  { id: "post.recycled", label: "post.recycled", severity: "silent", description: "Salva nova URL no metadata (silencioso)." },
  { id: "account.disconnected", label: "account.disconnected", severity: "alert", description: "Remove credencial e avisa no Telegram." },
  { id: "account.expired", label: "account.expired", severity: "alert", description: "Marca credencial como inválida e avisa." },
] as const;

const TEST_EVENTS = [
  { id: "ping", label: "Ping (apenas valida Telegram)" },
  { id: "post.failed", label: "post.failed (simula erro de publicação)" },
  { id: "post.partial", label: "post.partial (simula falha em algumas redes)" },
  { id: "post.cancelled", label: "post.cancelled (simula cancelamento)" },
  { id: "account.disconnected", label: "account.disconnected (conta caiu)" },
  { id: "account.expired", label: "account.expired (token expirou)" },
] as const;

const severityStyles: Record<string, string> = {
  alert: "bg-red-500/10 text-red-400 border-red-500/30",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  silent: "bg-muted text-muted-foreground border-border",
};

interface EventLog {
  id: string;
  event_type: string;
  processed_ok: boolean;
  error_message: string | null;
  created_at: string;
  client_id: string | null;
  retry_count: number;
  is_test: boolean;
  payload: any;
}

interface AlertPref {
  id: string;
  client_id: string;
  alerts_enabled: boolean;
}

export function WebhookSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { clients } = useClients();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Test dialog state
  const [testOpen, setTestOpen] = useState(false);
  const [testEvent, setTestEvent] = useState<string>("ping");
  const [testClient, setTestClient] = useState<string>("none");
  const [testing, setTesting] = useState(false);

  // History filters
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: events } = useQuery({
    queryKey: ["webhook-events-log-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EventLog[];
    },
    refetchInterval: 30_000,
  });

  const { data: prefs } = useQuery({
    queryKey: ["webhook-alert-preferences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_alert_preferences" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as AlertPref[];
    },
  });

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    (clients || []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  const lastEvent = events?.[0];
  const failureCount = (events || []).filter((e) => !e.processed_ok).length;

  const filteredEvents = useMemo(() => {
    return (events || []).filter((e) => {
      if (filterClient !== "all" && e.client_id !== filterClient) return false;
      if (filterType !== "all" && e.event_type !== filterType) return false;
      if (filterStatus === "success" && !e.processed_ok) return false;
      if (filterStatus === "failed" && e.processed_ok) return false;
      if (filterStatus === "test" && !e.is_test) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${e.event_type} ${e.error_message || ""} ${JSON.stringify(e.payload || {})}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, filterClient, filterType, filterStatus, search]);

  const distinctEventTypes = useMemo(() => {
    const set = new Set<string>();
    (events || []).forEach((e) => set.add(e.event_type));
    return Array.from(set).sort();
  }, [events]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast({ title: "URL copiada", description: "Cole no painel da Late/Zernio." });
    setTimeout(() => setCopied(false), 2000);
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("late-webhook-test", {
        body: {
          eventType: testEvent,
          clientId: testClient !== "none" ? testClient : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao disparar teste");
      toast({
        title: "Evento de teste enviado",
        description: "Confira o Telegram. O log foi gravado em Histórico.",
      });
      setTestOpen(false);
      qc.invalidateQueries({ queryKey: ["webhook-events-log-full"] });
    } catch (e) {
      toast({
        title: "Erro ao enviar teste",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const reprocess = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("late-webhook-reprocess", {
        body: { eventLogId: id },
      });
      if (error) throw error;
      toast({
        title: "Reprocessado",
        description: `Tentativa #${data?.retryCount || "?"} ${data?.telegram ? "— Telegram OK" : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["webhook-events-log-full"] });
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const togglePref = async (clientId: string, enabled: boolean) => {
    const existing = (prefs || []).find((p) => p.client_id === clientId);
    if (existing) {
      await supabase
        .from("webhook_alert_preferences" as any)
        .update({ alerts_enabled: enabled })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("webhook_alert_preferences" as any)
        .insert({ client_id: clientId, alerts_enabled: enabled });
    }
    qc.invalidateQueries({ queryKey: ["webhook-alert-preferences"] });
  };

  const isAlertEnabled = (clientId: string) => {
    const p = (prefs || []).find((x) => x.client_id === clientId);
    return p ? p.alerts_enabled : true; // default ON
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="history">
            Histórico
            {failureCount > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px] bg-red-500/10 text-red-400 border-red-500/30">
                {failureCount} erros
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preferences">Alertas por cliente</TabsTrigger>
        </TabsList>

        {/* ───────── OVERVIEW ───────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Webhooks Late / Zernio</CardTitle>
                </div>
                <Dialog open={testOpen} onOpenChange={setTestOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="default" className="gap-2">
                      <Send className="h-4 w-4" />
                      Testar webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disparar evento simulado</DialogTitle>
                      <DialogDescription>
                        Envia um payload fake direto pro Telegram para validar a configuração.
                        Fica registrado no histórico marcado como <code>test</code>.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase">
                          Tipo de evento
                        </label>
                        <Select value={testEvent} onValueChange={setTestEvent}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEST_EVENTS.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase">
                          Cliente (opcional)
                        </label>
                        <Select value={testClient} onValueChange={setTestClient}>
                          <SelectTrigger>
                            <SelectValue placeholder="Genérico" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Genérico (sem cliente) —</SelectItem>
                            {(clients || []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setTestOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={runTest} disabled={testing}>
                        {testing ? "Enviando..." : "Disparar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>
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
                  Está armazenado como <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">LATE_WEBHOOK_SECRET</code>.
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

              {lastEvent && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Último evento <code className="font-mono">{lastEvent.event_type}</code> recebido há{" "}
                  {formatDistanceToNow(new Date(lastEvent.created_at), { locale: ptBR })}.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── HISTORY ───────── */}
        <TabsContent value="history" className="space-y-3 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-4">
              <div className="md:col-span-1 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar texto / erro / payload"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {distinctEventTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">✓ Sucesso</SelectItem>
                  <SelectItem value="failed">✗ Erro</SelectItem>
                  <SelectItem value="test">🧪 Apenas testes</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {filteredEvents.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Nenhum evento corresponde aos filtros.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[24px]"></TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              ev.processed_ok ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            {ev.event_type}
                            {ev.is_test && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-yellow-500/30 text-yellow-400">
                                test
                              </Badge>
                            )}
                          </div>
                          {ev.error_message && (
                            <div className="text-[10px] text-red-400 mt-0.5 max-w-md truncate">
                              {ev.error_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ev.client_id ? clientNameById.get(ev.client_id) || "—" : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={ev.created_at}>
                          {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs">{ev.retry_count}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reprocess(ev.id)}
                            className="h-7 gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reprocessar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── PREFERENCES ───────── */}
        <TabsContent value="preferences" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas por cliente</CardTitle>
              <CardDescription>
                Liga/desliga as notificações no Telegram disparadas pelos eventos do webhook.
                Quando desligado, o evento ainda é registrado no histórico mas não vai para o bot.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Alertas no Telegram</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(clients || []).map((c) => {
                    const enabled = isAlertEnabled(c.id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`text-xs ${enabled ? "text-green-400" : "text-muted-foreground"}`}>
                              {enabled ? "Ativos" : "Silenciado"}
                            </span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(v) => togglePref(c.id, v)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {failureCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {failureCount} eventos com erro recentes. Veja em Histórico para reprocessar.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
