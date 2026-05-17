/**
 * AuditLogSettings — log de auditoria das ações executadas pelos membros
 * do workspace. Lê de `user_activities` (a mesma tabela que alimenta o
 * dashboard de "Atividade recente" do home), mas com filtros + busca +
 * paginação pra investigação retroativa.
 *
 * Adicionado em 2026-05-09 como melhoria P1 da auditoria de Settings.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Activity,
  UserPlus,
  UserCog,
  UserMinus,
  FileText,
  Image as ImageIcon,
  ImageOff,
  MessageSquare,
  MessageCircle,
  Sparkles,
  Bot,
  Wrench,
  PlayCircle,
  Globe,
  BarChart3,
  BookOpen,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  entity_name: string | null;
  entity_type: string | null;
  created_at: string | null;
  metadata: Record<string, any> | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  client_created: UserPlus,
  client_updated: UserCog,
  client_deleted: UserMinus,
  template_created: FileText,
  template_updated: FileText,
  template_deleted: FileText,
  conversation_created: MessageSquare,
  message_sent: MessageCircle,
  image_generated: ImageIcon,
  image_deleted: ImageOff,
  automation_created: Wrench,
  automation_updated: Wrench,
  automation_deleted: Wrench,
  automation_executed: PlayCircle,
  reverse_engineering_analysis: Sparkles,
  reverse_engineering_generation: Bot,
  document_uploaded: FileText,
  website_scraped: Globe,
  metrics_fetched: BarChart3,
  content_library_added: BookOpen,
  content_library_updated: BookOpen,
  content_library_deleted: BookOpen,
};

const PAGE_SIZE = 30;

export function AuditLogSettings() {
  const { workspace, canManageTeam } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Members do workspace (pra resolver user_id → nome).
  const { data: members } = useQuery({
    queryKey: ["audit-log-members", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace!.id);
      const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) return [] as ProfileRow[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      return (profiles || []) as ProfileRow[];
    },
    staleTime: 5 * 60_000,
  });

  const memberMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    (members || []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const memberIds = useMemo(() => (members || []).map((m) => m.id), [members]);

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-log", workspace?.id, memberIds, filterType, page],
    enabled: !!workspace?.id && memberIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("user_activities")
        .select("id, user_id, activity_type, description, entity_name, entity_type, created_at, metadata")
        .in("user_id", memberIds)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (filterType !== "all") {
        // Cast pra contornar tipagem rígida do Supabase enum — filterType
        // vem do select da UI que já restringe os valores válidos.
        q = q.eq("activity_type", filterType as never);
      }
      const { data } = await q;
      return (data || []) as AuditRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const member = memberMap.get(r.user_id);
      const hay = `${r.description} ${r.entity_name || ""} ${r.activity_type} ${
        member?.full_name || ""
      }`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search, memberMap]);

  // Lista única de activity_types pra filtro.
  const { data: typeOptions } = useQuery({
    queryKey: ["audit-log-types", workspace?.id, memberIds],
    enabled: !!workspace?.id && memberIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activities")
        .select("activity_type")
        .in("user_id", memberIds)
        .limit(1000);
      const set = new Set<string>();
      (data || []).forEach((r: any) => r.activity_type && set.add(r.activity_type));
      return Array.from(set).sort();
    },
    staleTime: 10 * 60_000,
  });

  if (!canManageTeam) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Logs de auditoria</CardTitle>
          </div>
          <CardDescription>
            Apenas administradores e owners podem ver o histórico completo do workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Logs de auditoria</CardTitle>
          </div>
          <CardDescription>
            Histórico de ações executadas pelos membros do workspace. Útil pra investigar mudanças e atividade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação, entidade ou usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-56 h-9">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {(typeOptions || []).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma atividade encontrada.
            </div>
          ) : (
            <div className="border rounded-lg divide-y divide-border/50 overflow-hidden">
              {filtered.map((row) => {
                const Icon = iconMap[row.activity_type] || Activity;
                const member = memberMap.get(row.user_id);
                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm leading-tight">
                        <span className="font-medium">{member?.full_name || "Usuário desconhecido"}</span>
                        <span className="text-muted-foreground"> · {row.description}</span>
                        {row.entity_name && (
                          <span className="text-muted-foreground/80"> · {row.entity_name}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {row.activity_type}
                        </Badge>
                        {row.entity_type && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                            {row.entity_type}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {row.created_at
                            ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação simples */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} · mostrando até {PAGE_SIZE} eventos
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(rows?.length ?? 0) < PAGE_SIZE || isFetching}
              >
                {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Próxima"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
