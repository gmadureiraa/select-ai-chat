import { useState } from "react";
import { Zap, Plus, Play, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAutomations } from "@/hooks/useAutomations";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { Client } from "@/hooks/useClients";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KaiAutomationsTabProps {
  clientId: string;
  client: Client;
}

export const KaiAutomationsTab = ({ clientId, client }: KaiAutomationsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);

  const { 
    automations, 
    updateAutomation, 
    runAutomation 
  } = useAutomations();

  // Filter automations for this client
  const clientAutomations = automations?.filter(a => a.client_id === clientId) || [];
  const activeCount = clientAutomations.filter(a => a.is_active).length;

  const handleToggleActive = (automation: any) => {
    updateAutomation.mutate({
      id: automation.id,
      is_active: !automation.is_active,
    });
  };

  const handleRun = (automation: any) => {
    runAutomation.mutate(automation.id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Automações</h2>
          </div>
          <Badge variant="secondary">
            {activeCount} ativas
          </Badge>
        </div>
        
        <Button onClick={() => {
          setSelectedAutomation(null);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Automação
        </Button>
      </div>

      {/* Automations List */}
      {clientAutomations.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Nenhuma automação configurada</p>
            <p className="text-sm mb-4">
              Crie automações para gerar conteúdo automaticamente
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAutomation(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Automação
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {clientAutomations.map((automation) => (
            <Card key={automation.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={() => handleToggleActive(automation)}
                  />
                  <div>
                    <h3 className="font-medium">{automation.name}</h3>
                    {automation.description && (
                      <p className="text-sm text-muted-foreground">
                        {automation.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Schedule Info */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {automation.schedule_type === "daily" && "Diário"}
                      {automation.schedule_type === "weekly" && "Semanal"}
                      {automation.schedule_type === "monthly" && "Mensal"}
                      {automation.schedule_time && ` às ${automation.schedule_time}`}
                    </span>
                  </div>

                  {/* Last Run */}
                  {automation.last_run_at && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>
                        {format(new Date(automation.last_run_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRun(automation)}
                      disabled={runAutomation.isPending}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Executar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAutomation(automation);
                        setDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
      />
    </div>
  );
};
