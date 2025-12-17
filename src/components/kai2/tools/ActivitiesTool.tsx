import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivities, ActivityType } from "@/hooks/useActivities";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ActivitiesTool = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ActivityType | "all">("all");
  const [limit, setLimit] = useState(50);

  const { activities, isLoading } = useActivities({
    activityType: selectedType === "all" ? undefined : selectedType,
    searchQuery: searchQuery || undefined,
    limit,
  });

  const hasFilters = searchQuery || selectedType !== "all";

  const activityLabels: Record<ActivityType, string> = {
    client_created: "Cliente Criado",
    client_updated: "Cliente Atualizado",
    client_deleted: "Cliente Deletado",
    template_created: "Template Criado",
    template_updated: "Template Atualizado",
    template_deleted: "Template Deletado",
    conversation_created: "Conversa Iniciada",
    message_sent: "Mensagem Enviada",
    image_generated: "Imagem Gerada",
    image_deleted: "Imagem Deletada",
    automation_created: "Automação Criada",
    automation_updated: "Automação Atualizada",
    automation_deleted: "Automação Deletada",
    automation_executed: "Automação Executada",
    reverse_engineering_analysis: "Análise",
    reverse_engineering_generation: "Geração",
    document_uploaded: "Documento Carregado",
    website_scraped: "Website Raspado",
    metrics_fetched: "Métricas Coletadas",
  };

  const activityColors: Record<ActivityType, string> = {
    client_created: "bg-green-500/10 text-green-500",
    client_updated: "bg-blue-500/10 text-blue-500",
    client_deleted: "bg-red-500/10 text-red-500",
    template_created: "bg-green-500/10 text-green-500",
    template_updated: "bg-blue-500/10 text-blue-500",
    template_deleted: "bg-red-500/10 text-red-500",
    conversation_created: "bg-purple-500/10 text-purple-500",
    message_sent: "bg-blue-500/10 text-blue-500",
    image_generated: "bg-cyan-500/10 text-cyan-500",
    image_deleted: "bg-red-500/10 text-red-500",
    automation_created: "bg-green-500/10 text-green-500",
    automation_updated: "bg-blue-500/10 text-blue-500",
    automation_deleted: "bg-red-500/10 text-red-500",
    automation_executed: "bg-yellow-500/10 text-yellow-500",
    reverse_engineering_analysis: "bg-purple-500/10 text-purple-500",
    reverse_engineering_generation: "bg-cyan-500/10 text-cyan-500",
    document_uploaded: "bg-green-500/10 text-green-500",
    website_scraped: "bg-blue-500/10 text-blue-500",
    metrics_fetched: "bg-yellow-500/10 text-yellow-500",
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Atividades</h1>
          <p className="text-muted-foreground text-sm">Histórico de ações no sistema</p>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ActivityType | "all")}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="client_created">Cliente Criado</SelectItem>
                  <SelectItem value="message_sent">Mensagem Enviada</SelectItem>
                  <SelectItem value="automation_executed">Automação Executada</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedType("all");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{activities?.length || 0} atividades</span>
              {activities && activities.length >= limit && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setLimit(limit + 50)}
                  className="text-xs h-auto p-0"
                >
                  Carregar mais
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {!activities || activities.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-12 text-center">
              <Activity className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card key={activity.id} className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={activityColors[activity.activity_type]}
                        >
                          {activityLabels[activity.activity_type]}
                        </Badge>
                        {activity.entity_name && (
                          <span className="text-sm font-medium">{activity.entity_name}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};