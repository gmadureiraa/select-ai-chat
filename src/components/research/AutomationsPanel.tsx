import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Plus, Trash2, Play, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

const triggerOptions = [
  { value: "item_added", label: "Quando um item é adicionado" },
  { value: "connection_created", label: "Quando uma conexão é criada" },
  { value: "ai_analysis_complete", label: "Quando análise IA termina" },
  { value: "manual", label: "Execução manual" },
];

const actionOptions = [
  { value: "auto_transcribe", label: "Transcrever automaticamente" },
  { value: "generate_summary", label: "Gerar resumo executivo" },
  { value: "notify", label: "Enviar notificação" },
  { value: "export_markdown", label: "Exportar para Markdown" },
  { value: "create_version", label: "Criar versão automática" },
];

interface AutomationsPanelProps {
  projectId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AutomationsPanel = ({ projectId, open, onOpenChange }: AutomationsPanelProps) => {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([
    {
      id: "1",
      name: "Auto-transcrição",
      trigger: "item_added",
      action: "auto_transcribe",
      enabled: true,
    },
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    trigger: "",
    action: "",
  });

  const handleAddAutomation = () => {
    if (!newAutomation.name || !newAutomation.trigger || !newAutomation.action) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para criar a automação.",
        variant: "destructive",
      });
      return;
    }

    const automation: Automation = {
      id: Date.now().toString(),
      name: newAutomation.name,
      trigger: newAutomation.trigger,
      action: newAutomation.action,
      enabled: true,
    };

    setAutomations([...automations, automation]);
    setNewAutomation({ name: "", trigger: "", action: "" });
    setShowAddForm(false);
    
    toast({
      title: "Automação criada",
      description: `"${automation.name}" foi adicionada com sucesso.`,
    });
  };

  const toggleAutomation = (id: string) => {
    setAutomations(automations.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const deleteAutomation = (id: string) => {
    setAutomations(automations.filter(a => a.id !== id));
    toast({
      title: "Automação removida",
      description: "A automação foi excluída.",
    });
  };

  const runAutomation = (automation: Automation) => {
    toast({
      title: "Automação executada",
      description: `"${automation.name}" foi executada manualmente.`,
    });
  };

  const getTriggerLabel = (value: string) => 
    triggerOptions.find(o => o.value === value)?.label || value;
  
  const getActionLabel = (value: string) => 
    actionOptions.find(o => o.value === value)?.label || value;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automações do Projeto
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button 
            className="w-full gap-2" 
            variant={showAddForm ? "secondary" : "default"}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? "Cancelar" : "Nova Automação"}
          </Button>

          {showAddForm && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Nome da automação"
                    value={newAutomation.name}
                    onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gatilho</Label>
                  <Select
                    value={newAutomation.trigger}
                    onValueChange={(v) => setNewAutomation({ ...newAutomation, trigger: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ação</Label>
                  <Select
                    value={newAutomation.action}
                    onValueChange={(v) => setNewAutomation({ ...newAutomation, action: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a ação" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAddAutomation}>
                  Criar Automação
                </Button>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-3 pr-4">
              {automations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhuma automação configurada</p>
                  <p className="text-xs mt-1">
                    Crie automações para executar ações automaticamente
                  </p>
                </div>
              ) : (
                automations.map((automation) => (
                  <Card key={automation.id} className={!automation.enabled ? "opacity-50" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{automation.name}</CardTitle>
                        <Switch
                          checked={automation.enabled}
                          onCheckedChange={() => toggleAutomation(automation.id)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getTriggerLabel(automation.trigger)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getActionLabel(automation.action)}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {automation.trigger === "manual" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => runAutomation(automation)}
                          >
                            <Play className="h-3 w-3" />
                            Executar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteAutomation(automation.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
