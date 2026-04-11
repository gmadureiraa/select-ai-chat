import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, DollarSign, Zap, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const USD_TO_BRL = 5.70;

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

const FUNCTION_LABELS: Record<string, string> = {
  "kai-simple-chat": "Chat kAI",
  "chat_response": "Chat (resposta)",
  "multi_agent_researcher": "Pesquisador",
  "multi_agent_writer": "Escritor",
  "multi_agent_editor": "Editor",
  "multi_agent_reviewer": "Revisor",
  "generate-content": "Geração de conteúdo",
  "generate-image": "Geração de imagem",
  "csv_validation": "Validação CSV",
  "web_search": "Pesquisa web",
  "image_generation": "Imagem IA",
  "content_repurpose": "Reaproveitamento",
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
  const [byFunction, setByFunction] = useState<UsageByFunction[]>([]);
  const [byModel, setByModel] = useState<UsageByModel[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [totals, setTotals] = useState({ calls: 0, tokens: 0, cost_usd: 0 });
  const [monthTotals, setMonthTotals] = useState({ calls: 0, tokens: 0, cost_usd: 0 });

  useEffect(() => {
    if (!user?.id) return;
    fetchUsageData();
  }, [user?.id]);

  async function fetchUsageData() {
    setLoading(true);
    try {
      // Fetch all logs
      const { data: logs, error } = await supabase
        .from("ai_usage_logs")
        .select("edge_function, model_name, total_tokens, estimated_cost_usd, created_at")
        .order("created_at", { ascending: false });

      if (error || !logs) {
        console.error("Error fetching AI usage:", error);
        setLoading(false);
        return;
      }

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // By function
      const fnMap = new Map<string, UsageByFunction>();
      const modelMap = new Map<string, UsageByModel>();
      const monthMap = new Map<string, MonthlyUsage>();
      let totalCalls = 0, totalTokens = 0, totalCost = 0;
      let mCalls = 0, mTokens = 0, mCost = 0;

      for (const log of logs) {
        const cost = log.estimated_cost_usd || 0;
        const tokens = log.total_tokens || 0;
        totalCalls++;
        totalTokens += tokens;
        totalCost += cost;

        const logDate = new Date(log.created_at);
        if (logDate >= thisMonthStart) {
          mCalls++;
          mTokens += tokens;
          mCost += cost;
        }

        // By function
        const fn = log.edge_function;
        const existing = fnMap.get(fn) || { edge_function: fn, calls: 0, total_tokens: 0, cost_usd: 0 };
        existing.calls++;
        existing.total_tokens += tokens;
        existing.cost_usd += cost;
        fnMap.set(fn, existing);

        // By model
        const model = log.model_name;
        const mExisting = modelMap.get(model) || { model_name: model, calls: 0, total_tokens: 0, cost_usd: 0 };
        mExisting.calls++;
        mExisting.total_tokens += tokens;
        mExisting.cost_usd += cost;
        modelMap.set(model, mExisting);

        // Monthly
        const monthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}`;
        const mMonth = monthMap.get(monthKey) || { month: monthKey, calls: 0, cost_usd: 0 };
        mMonth.calls++;
        mMonth.cost_usd += cost;
        monthMap.set(monthKey, mMonth);
      }

      setByFunction(Array.from(fnMap.values()).sort((a, b) => b.cost_usd - a.cost_usd));
      setByModel(Array.from(modelMap.values()).sort((a, b) => b.cost_usd - a.cost_usd));
      setMonthly(Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)));
      setTotals({ calls: totalCalls, tokens: totalTokens, cost_usd: totalCost });
      setMonthTotals({ calls: mCalls, tokens: mTokens, cost_usd: mCost });
    } finally {
      setLoading(false);
    }
  }

  // Projection: based on current month usage and days elapsed
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const projectedCost = daysPassed > 0 ? (monthTotals.cost_usd / daysPassed) * daysInMonth : 0;

  // Max cost for bar chart
  const maxMonthlyCost = Math.max(...monthly.map(m => m.cost_usd), 0.001);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
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
            <div className="text-xs text-muted-foreground">~{formatUSD(projectedCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Custo total
            </div>
            <div className="text-xl font-bold">{formatBRL(totals.cost_usd)}</div>
            <div className="text-xs text-muted-foreground">{totals.calls} chamadas total</div>
          </CardContent>
        </Card>
      </div>

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

      {/* By Function */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Por Função</CardTitle>
          <CardDescription>Breakdown de custos por tipo de operação — {monthLabel}</CardDescription>
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

      {/* By Model */}
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

      <p className="text-xs text-muted-foreground text-center">
        Câmbio referência: 1 USD = R$ {USD_TO_BRL.toFixed(2)} • Custos estimados baseados na tabela de preços dos provedores
      </p>
    </div>
  );
}
