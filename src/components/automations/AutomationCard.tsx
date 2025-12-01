import { useState } from "react";
import { AutomationWithClient, DayOfWeek } from "@/types/automation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Edit, Trash2, Clock, Calendar, Database, Zap } from "lucide-react";
import { useAutomations } from "@/hooks/useAutomations";
import { AutomationDialog } from "./AutomationDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AutomationCardProps {
  automation: AutomationWithClient;
}

export const AutomationCard = ({ automation }: AutomationCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { toggleAutomation, deleteAutomation, runAutomation } = useAutomations();

  const scheduleLabels = {
    daily: "Diariamente",
    weekly: "Semanalmente",
    monthly: "Mensalmente",
    custom: "Personalizado",
  };

  const dayLabels: Record<DayOfWeek, string> = {
    monday: "Seg",
    tuesday: "Ter",
    wednesday: "Qua",
    thursday: "Qui",
    friday: "Sex",
    saturday: "Sáb",
    sunday: "Dom",
  };

  const getScheduleDetails = () => {
    const parts = [scheduleLabels[automation.schedule_type]];
    
    if (automation.schedule_days && automation.schedule_days.length > 0) {
      const days = automation.schedule_days.map((d) => dayLabels[d]).join(", ");
      parts.push(days);
    }
    
    if (automation.schedule_time) {
      parts.push(`às ${automation.schedule_time}`);
    }
    
    return parts.join(" ");
  };

  return (
    <>
      <Card className="border-border/50 bg-card/50 hover:border-border transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base mb-2">{automation.name}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {automation.clients.name}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  toggleAutomation.mutate({
                    id: automation.id,
                    isActive: !automation.is_active,
                  })
                }
              >
                {automation.is_active ? (
                  <Pause className="h-4 w-4 text-orange-500" />
                ) : (
                  <Play className="h-4 w-4 text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditOpen(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {automation.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {automation.description}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{getScheduleDetails()}</span>
            </div>

            {automation.data_sources && automation.data_sources.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{automation.data_sources.length} fonte(s) de dados</span>
              </div>
            )}

            {automation.actions && automation.actions.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span>{automation.actions.length} ação(ões) configurada(s)</span>
              </div>
            )}

            {automation.last_run_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Última execução:{" "}
                  {formatDistanceToNow(new Date(automation.last_run_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={automation.is_active ? "default" : "secondary"}>
              {automation.is_active ? "Ativa" : "Pausada"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {automation.model}
            </Badge>
          </div>

          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={() => runAutomation.mutate(automation.id)}
            disabled={runAutomation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Executar Agora
          </Button>
        </CardContent>
      </Card>

      <AutomationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        automation={automation}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{automation.name}"? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteAutomation.mutate(automation.id);
                setIsDeleteOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
