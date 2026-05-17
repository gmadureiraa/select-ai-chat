import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, DollarSign, Zap, TrendingUp, BarChart3, Users, Database, Calendar as CalendarIcon, Gauge, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const USD_TO_BRL = 5.70;

type Period = '7d' | '30d' | '90d' | 'all';

const PERIOD_LABELS: Record<Period, { label: string; days: number | null }> = {
  '7d': { label: '7 dias', days: 7 },
  '30d': { label: '30 dias', days: 30 },
  '90d': { label: '90 dias', days: 90 },
  'all': { label: 'Tudo', days: null },
};

interface UsageByFunction {
  edge_function: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
}

interface UsageByModel {
  model_name: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
}

interface MonthlyUsage {
  month: string;
  calls: number;
  cost_usd: number;
}

interface UsageByClient {
  client_id: string | null;
  client_name: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
}

interface DailyUsage {
  date: string;
  calls: number;
  cost_usd: number;
  tokens: number;
}

interface CacheStats {
  total_calls_with_cache: number;
  hits: number;
  creates: number;
  bypassed: number;
}

interface ToolPerfRow {
  name: string;
  calls: number;
  avgMs: number;
  totalMs: number;
  errors: number;
  errorRate: number;
}

interface RateLimitStats {
  source: 'upstash' | 'in-memory' | 'none';
  windowDays: number;
  totalRequests: number;
  totalBlocked: number;
  topIdentities: Array<{ identifier: string; success: number; blocked: number; total: number }>;
  activeBuckets: number;
  generatedAt: string;
}

interface UsageLog {
  edge_function: string;
  model_name: string;
  total_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
  client_id: string | null;
  metadata: Record<string, unknown> | null;
}

const FUNCTION_LABELS: Record<string, string> = {
  "kai-simple-chat": "Chat kAI",
  "chat_response": "Chat (legado)",
  "chat-response": "Chat (legado)",
  "chat-selection": "Seleção de formato",
  "multi_agent_researcher": "Pesquisador",
  "multi_agent_writer": "Escritor",
  "multi_agent_editor": "Editor",
  "multi_agent_reviewer": "Revisor",
  "chat-multi-agent/researcher": "Pesquisador",
  "chat-multi-agent/writer": "Escritor",
  "chat-multi-agent/editor": "Editor",
  "chat-multi-agent/reviewer": "Revisor",
  "generate-content": "Geração de conteúdo",
  "generate-image": "Geração de imagem",
  "validate-csv-import": "Validação CSV",
  "csv_validation": "Validação CSV",
  "web_search": "Pesquisa web",
  "image_generation": "Imagem IA",
  "content_repurpose": "Reaproveitamento",
  "extract-pdf": "Extração PDF",
  "transcribe-images": "Transcrição de imagens",
  "analyze-style": "Análise de estilo",
  "analyze-image-complete": "Análise de imagem",
  "execute-agent": "Agente automação",
  "unified-content-api": "API de conteúdo",
  "generate-performance-insights": "Insights de performance",
  "reverse-engineer": "Engenharia reversa",
};

function getFunctionLabel(fn: string): string {
  return FUNCTION_LABELS[fn] || fn.replace(/_/g, " ").replace(/-/g, " ");
}

function formatBRL(usd: number): string {
  return (usd * USD_TO_BRL).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatUSD(usd: number): string {
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 });
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function AIUsageSettings() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [allLogs, setAllLogs] = useState<UsageLog[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [rlStats, setRlStats] = useState<RateLimitStats | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchUsageData();
    fetchRateLimitStats(period === '7d' ? 7 : period === '30d' ? 30 : 7);
  }, [user?.id, period]);

  async function fetchRateLimitStats(days: number) {
    try {
      const res = await fetch(`/api/rate-limit-stats?days=${days}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setRlStats(data);
    } catch (err) {
      console.warn('[AIUsageSettings] rate-limit stats failed:', err);
    }
  }

  async function fetchUsageData() {
    setLoading(true);
    try {
      const [logsResult, clientsResult] = await Promise.all([
        supabase
          .from("ai_usage_logs")
          .select("edge_function, model_name, total_tokens, estimated_cost_usd, created_at, client_id, metadata")
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("clients")
          .select("id, name"),
      ]);

      if (logsResult.error || !logsResult.data) {
        console.error("Error fetching AI usage:", logsResult.error);
        setLoading(false);
        return;
      }

      const nameMap: Record<string, string> = {};
      if (clientsResult.data) {
        for (const c of clientsResult.data) nameMap[c.id] = c.name;
      }
      setClientNames(nameMap);
      setAllLogs(logsResult.data as UsageLog[]);
    } finally {
      setLoading(false);
    }
  }

  const periodStart = useMemo(() => {
    const days = PERIOD_LABELS[period].days;
    if (days === null) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [period]);

  const filteredLogs = useMemo(() => {
    if (!periodStart) return allLogs;
    return allLogs.filter(l => new Date(l.created_at) >= periodStart);
  }, [allLogs, periodStart]);

  // Agregações derivadas — recalcula quando period muda
  const aggregated = useMemo(() => {
    const fnMap = new Map<string, UsageByFunction>();
    const modelMap = new Map<string, UsageByModel>();
    const monthMap = new Map<string, MonthlyUsage>();
    const dailyMap = new Map<string, DailyUsage>();
    const clientMap = new Map<string | null, UsageByClient>();
    const toolPerfMap = new Map<string, ToolPerfRow>();
    const cache: CacheStats = { total_calls_with_cache: 0, hits: 0, creates: 0, bypassed: 0 };
    let totalCalls = 0, totalTokens = 0, totalCost = 0;

    for (const log of filteredLogs) {
      const cost = log.estimated_cost_usd || 0;
      const tokens = log.total_tokens || 0;
      totalCalls++;
      totalTokens += tokens;
      totalCost += cost;

      const fn = log.edge_function;
      const existing = fnMap.get(fn) || { edge_function: fn, calls: 0, total_tokens: 0, cost_usd: 0 };
      existing.calls++;
      existing.total_tokens += tokens;
      existing.cost_usd += cost;
      fnMap.set(fn, existing);

      const model = log.model_name;
      const mExisting = modelMap.get(model) || { model_name: model, calls: 0, total_tokens: 0, cost_usd: 0 };
      mExisting.calls++;
      mExisting.total_tokens += tokens;
      mExisting.cost_usd += cost;
      modelMap.set(model, mExisting);

      const logDate = new Date(log.created_at);
      const monthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}`;
      const mMonth = monthMap.get(monthKey) || { month: monthKey, calls: 0, cost_usd: 0 };
      mMonth.calls++;
      mMonth.cost_usd += cost;
      monthMap.set(monthKey, mMonth);

      const dayKey = logDate.toISOString().slice(0, 10);
      const day = dailyMap.get(dayKey) || { date: dayKey, calls: 0, cost_usd: 0, tokens: 0 };
      day.calls++;
      day.cost_usd += cost;
      day.tokens += tokens;
      dailyMap.set(dayKey, day);

      const cid = log.client_id;
      const cExisting = clientMap.get(cid) || {
        client_id: cid,
        client_name: cid ? (clientNames[cid] || "Cliente desconhecido") : "Sem cliente",
        calls: 0, total_tokens: 0, cost_usd: 0
      };
      cExisting.calls++;
      cExisting.total_tokens += tokens;
      cExisting.cost_usd += cost;
      clientMap.set(cid, cExisting);

      // Cache hit metrics (apenas tool-loop logs novos têm essas chaves)
      const meta = log.metadata || {};
      const hits = Number((meta as any).cache_hits ?? 0);
      const creates = Number((meta as any).cache_creates ?? 0);
      const bypassed = Number((meta as any).cache_bypassed ?? 0);
      if (hits + creates + bypassed > 0) {
        cache.total_calls_with_cache++;
        cache.hits += hits;
        cache.creates += creates;
        cache.bypassed += bypassed;
      }

      // Tool traces — agregação de latência por tool
      const traces = (meta as any).tool_traces as Array<{ n: string; ms: number; s: string }> | undefined;
      if (Array.isArray(traces)) {
        for (const t of traces) {
          const row = toolPerfMap.get(t.n) || {
            name: t.n,
            calls: 0,
            avgMs: 0,
            totalMs: 0,
            errors: 0,
            errorRate: 0,
          };
          row.calls++;
          row.totalMs += t.ms || 0;
          if (t.s === 'error') row.errors++;
          toolPerfMap.set(t.n, row);
        }
      }
    }

    // Calcula médias e taxa de erro
    for (const row of toolPerfMap.values()) {
      row.avgMs = row.calls > 0 ? row.totalMs / row.calls : 0;
      row.errorRate = row.calls > 0 ? row.errors / row.calls : 0;
    }

    return {
      byFunction: Array.from(fnMap.values()).sort((a, b) => b.cost_usd - a.cost_usd),
      byModel: Array.from(modelMap.values()).sort((a, b) => b.cost_usd - a.cost_usd),
      monthly: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byClient: Array.from(clientMap.values()).sort((a, b) => b.cost_usd - a.cost_usd),
      toolPerf: Array.from(toolPerfMap.values()).sort((a, b) => b.totalMs - a.totalMs),
      totals: { calls: totalCalls, tokens: totalTokens, cost_usd: totalCost },
      cache,
    };
  }, [filteredLogs, clientNames]);

  const { byFunction, byModel, monthly, daily, byClient, toolPerf, totals, cache } = aggregated;

  // Custos do mês atual sempre (independente do filter) pra projeção real
  const monthTotals = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let calls = 0, tokens = 0, cost_usd = 0;
    for (const log of allLogs) {
      const d = new Date(log.created_at);
      if (d < thisMonthStart) continue;
      calls++;
      tokens += log.total_tokens || 0;
      cost_usd += log.estimated_cost_usd || 0;
    }
    return { calls, tokens, cost_usd };
  }, [allLogs]);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const projectedCost = daysPassed > 0 ? (monthTotals.cost_usd / daysPassed) * daysInMonth : 0;
  const projectedAnnual = projectedCost * 12;

  const maxMonthlyCost = Math.max(...monthly.map(m => m.cost_usd), 0.001);
  const maxDailyCost = Math.max(...daily.map(d => d.cost_usd), 0.001);

  // Cache hit rate (apenas considerando logs com data de cache, pra evitar dilution
  // pelos logs antigos pré-feature)
  const cacheTotal = cache.hits + cache.creates + cache.bypassed;
  const cacheHitRate = cacheTotal > 0 ? (cache.hits / cacheTotal) * 100 : 0;
  // Economia estimada — cached tokens custam 25% do input price na Gemini
  const cacheSavingsRate = cacheTotal > 0 ? (cache.hits / cacheTotal) * 0.75 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasClientData = byClient.some(c => c.client_id !== null);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Período:</span>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p].label}
            </Button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {filteredLogs.length.toLocaleString("pt-BR")} logs no período
        </span>
      </div>

      {/* KPI Cards */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Custo do mês
            </div>
            <div className="text-xl font-bold">{formatBRL(monthTotals.cost_usd)}</div>
            <div className="text-xs text-muted-foreground">{formatUSD(monthTotals.cost_usd)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="h-3.5 w-3.5" />
              Chamadas (mês)
            </div>
            <div className="text-xl font-bold">{monthTotals.calls.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">{formatTokens(monthTotals.tokens)} tokens</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Projeção mensal
            </div>
            <div className="text-xl font-bold">{formatBRL(projectedCost)}</div>
            <div className="text-xs text-muted-foreground">~{formatBRL(projectedAnnual)}/ano</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Custo no período
            </div>
            <div className="text-xl font-bold">{formatBRL(totals.cost_usd)}</div>
            <div className="text-xs text-muted-foreground">{totals.calls} chamadas • {formatTokens(totals.tokens)} tokens</div>
          </CardContent>
        </Card>
      </div>

      {/* Cache stats — só aparece se houver dados */}
      {cacheTotal > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Cache do Gemini (KAI Chat)
                </CardTitle>
                <CardDescription>
                  Hit rate dos últimos {cacheTotal.toLocaleString("pt-BR")} ciclos de tool-loop
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  cacheHitRate >= 50
                    ? "border-green-500/40 text-green-700 dark:text-green-400"
                    : cacheHitRate >= 25
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                      : "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {cacheHitRate.toFixed(1)}% hit
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hits</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400">
                  {cache.hits.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Criados</div>
                <div className="text-lg font-bold">{cache.creates.toLocaleString("pt-BR")}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bypass</div>
                <div className="text-lg font-bold text-muted-foreground">
                  {cache.bypassed.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500/70" style={{ width: `${(cache.hits / cacheTotal) * 100}%` }} />
              <div className="h-full bg-primary/40" style={{ width: `${(cache.creates / cacheTotal) * 100}%` }} />
              <div className="h-full bg-muted-foreground/30" style={{ width: `${(cache.bypassed / cacheTotal) * 100}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Economia estimada no input do system + tools: ~{(cacheSavingsRate * 100).toFixed(1)}%
              (cached tokens custam 25% do preço normal na Gemini).
              {cache.bypassed > 0 && " Bypass ocorre quando o conteúdo é menor que o mínimo (1024 tokens Flash / 4096 Pro)."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tool performance — só aparece se há traces no metadata */}
      {toolPerf.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  Performance de Tools (KAI Chat)
                </CardTitle>
                <CardDescription>
                  Latência média e taxa de erro por tool — top 10 por uso
                </CardDescription>
              </div>
              {toolPerf.some(t => t.errorRate > 0.1) && (
                <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-400 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  alta taxa de erro
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Latência média</TableHead>
                  {!isMobile && <TableHead className="text-right">Latência total</TableHead>}
                  <TableHead className="text-right">Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toolPerf.slice(0, 10).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium text-sm font-mono">{row.name}</TableCell>
                    <TableCell className="text-right text-sm">{row.calls}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm font-medium tabular-nums",
                        row.avgMs > 3000 && "text-amber-600 dark:text-amber-400",
                        row.avgMs > 10000 && "text-red-600 dark:text-red-400",
                      )}
                    >
                      {row.avgMs >= 1000 ? `${(row.avgMs / 1000).toFixed(1)}s` : `${Math.round(row.avgMs)}ms`}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {(row.totalMs / 1000).toFixed(1)}s
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm">
                      {row.errors > 0 ? (
                        <span
                          className={cn(
                            "font-medium",
                            row.errorRate > 0.1
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {row.errors} ({(row.errorRate * 100).toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[10px] text-muted-foreground mt-3">
              Tools com média {'>'} 3s aparecem em âmbar, {'>'} 10s em vermelho. Taxa de erro {'>'} 10% destacada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rate-limit stats — só se Upstash configurado */}
      {rlStats && rlStats.source !== 'none' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Rate Limit (últimos {rlStats.windowDays}d)
                </CardTitle>
                <CardDescription>
                  Requests permitidos vs bloqueados — fonte: <span className="font-mono">{rlStats.source}</span>
                </CardDescription>
              </div>
              {rlStats.totalBlocked > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    rlStats.totalBlocked / Math.max(1, rlStats.totalRequests + rlStats.totalBlocked) > 0.1
                      ? "border-red-500/40 text-red-700 dark:text-red-400"
                      : "border-amber-500/40 text-amber-700 dark:text-amber-400",
                  )}
                >
                  {rlStats.totalBlocked} bloqueios
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Permitidos</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                  {rlStats.totalRequests.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bloqueados</div>
                <div
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    rlStats.totalBlocked > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {rlStats.totalBlocked.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Buckets ativos</div>
                <div className="text-lg font-bold tabular-nums">
                  {rlStats.activeBuckets.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            {rlStats.topIdentities.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Top consumidores
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identidade</TableHead>
                      <TableHead className="text-right">Permitidos</TableHead>
                      <TableHead className="text-right">Bloqueados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rlStats.topIdentities.slice(0, 5).map((t) => (
                      <TableRow key={t.identifier}>
                        <TableCell className="font-mono text-xs truncate max-w-[200px]" title={t.identifier}>
                          {t.identifier}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{t.success}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-sm tabular-nums",
                            t.blocked > 0 && "text-red-600 dark:text-red-400 font-medium",
                          )}
                        >
                          {t.blocked || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily breakdown — bar chart leve */}
      {daily.length > 0 && period !== 'all' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custo Diário</CardTitle>
            <CardDescription>Últimos {PERIOD_LABELS[period].label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {daily.map(d => {
                const pct = (d.cost_usd / maxDailyCost) * 100;
                const day = d.date.slice(8, 10);
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1 min-w-[8px]"
                    title={`${d.date} — ${formatBRL(d.cost_usd)} (${d.calls} chamadas)`}
                  >
                    <div
                      className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground">{day}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Evolution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução Mensal</CardTitle>
          <CardDescription>Custo por mês</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {monthly.map((m) => {
              const pct = (m.cost_usd / maxMonthlyCost) * 100;
              const [year, month] = m.month.split("-");
              const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-20 text-right shrink-0">{formatBRL(m.cost_usd)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: By Client / By Function / By Model */}
      <Tabs defaultValue="client" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="client">Por Cliente</TabsTrigger>
          <TabsTrigger value="function">Por Função</TabsTrigger>
          <TabsTrigger value="model">Por Modelo</TabsTrigger>
        </TabsList>

        {/* By Client */}
        <TabsContent value="client">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Custo por Cliente</CardTitle>
                  <CardDescription>
                    {hasClientData 
                      ? "Distribuição de custos de IA por cliente" 
                      : "Rastreamento por cliente ativado — dados serão coletados a partir de agora"}
                  </CardDescription>
                </div>
                {!hasClientData && (
                  <Badge variant="outline" className="text-xs">Em breve</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Client cost bars */}
              <div className="space-y-3">
                {byClient.map((item, idx) => {
                  const maxClientCost = Math.max(...byClient.map(c => c.cost_usd), 0.001);
                  const pct = (item.cost_usd / maxClientCost) * 100;
                  return (
                    <div key={item.client_id || `none-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.client_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold">{formatBRL(item.cost_usd)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{item.calls} chamadas</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTokens(item.total_tokens)} tokens</span>
                        <span>{formatUSD(item.cost_usd)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {!hasClientData && (
                <p className="text-xs text-muted-foreground mt-4 text-center py-4 bg-muted/30 rounded-lg">
                  Os logs históricos não possuem client_id associado. A partir de agora, todas as chamadas do Chat kAI 
                  serão rastreadas por cliente, permitindo visualizar a distribuição de custos aqui.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Function */}
        <TabsContent value="function">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Por Função</CardTitle>
              <CardDescription>Breakdown de custos por tipo de operação</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo (BRL)</TableHead>
                    {!isMobile && <TableHead className="text-right">Custo (USD)</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFunction.map((item) => (
                    <TableRow key={item.edge_function}>
                      <TableCell className="font-medium text-sm">{getFunctionLabel(item.edge_function)}</TableCell>
                      <TableCell className="text-right text-sm">{item.calls}</TableCell>
                      <TableCell className="text-right text-sm">{formatTokens(item.total_tokens)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatBRL(item.cost_usd)}</TableCell>
                      {!isMobile && <TableCell className="text-right text-sm text-muted-foreground">{formatUSD(item.cost_usd)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Model */}
        <TabsContent value="model">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Por Modelo</CardTitle>
              <CardDescription>Custo por modelo de IA utilizado</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo (BRL)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byModel.map((item) => (
                    <TableRow key={item.model_name}>
                      <TableCell className="font-medium text-sm font-mono">{item.model_name}</TableCell>
                      <TableCell className="text-right text-sm">{item.calls}</TableCell>
                      <TableCell className="text-right text-sm">{formatTokens(item.total_tokens)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatBRL(item.cost_usd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        Câmbio referência: 1 USD = R$ {USD_TO_BRL.toFixed(2)} • Custos estimados baseados na tabela de preços dos provedores
      </p>
    </div>
  );
}
