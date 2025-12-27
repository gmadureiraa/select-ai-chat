import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AutomationNodeType, AutomationNodeConfig } from "@/types/automationBuilder";

interface AutomationNodeConfigPanelProps {
  nodeType: AutomationNodeType;
  config: AutomationNodeConfig;
  onClose: () => void;
  onUpdate: (config: AutomationNodeConfig) => void;
}

const MODELS = [
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini" },
  { id: "gpt-5-2025-08-07", name: "GPT-5" },
  { id: "gpt-4.1-2025-04-14", name: "GPT-4.1" },
];

export const AutomationNodeConfigPanel = ({
  nodeType,
  config,
  onClose,
  onUpdate,
}: AutomationNodeConfigPanelProps) => {
  const [localConfig, setLocalConfig] = useState<AutomationNodeConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  const updateField = (field: string, value: any) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  const renderFields = () => {
    switch (nodeType) {
      case "trigger_rss":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome do Gatilho</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="RSS Feed"
              />
            </div>
            <div className="space-y-2">
              <Label>URL do RSS Feed</Label>
              <Input
                value={localConfig.rss_url || ""}
                onChange={(e) => updateField("rss_url", e.target.value)}
                placeholder="https://exemplo.com/feed.xml"
              />
            </div>
          </>
        );

      case "trigger_webhook":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome do Gatilho</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Webhook Trigger"
              />
            </div>
            <div className="space-y-2">
              <Label>URL do Webhook (gerado automaticamente)</Label>
              <Input
                value={localConfig.webhook_url || ""}
                disabled
                placeholder="Será gerado ao salvar"
              />
            </div>
          </>
        );

      case "trigger_schedule":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome do Agendamento</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Agendamento"
              />
            </div>
            <div className="space-y-2">
              <Label>Expressão Cron</Label>
              <Input
                value={localConfig.schedule_cron || ""}
                onChange={(e) => updateField("schedule_cron", e.target.value)}
                placeholder="0 9 * * *"
              />
              <p className="text-xs text-muted-foreground">
                Ex: "0 9 * * *" = todos os dias às 9h
              </p>
            </div>
          </>
        );

      case "trigger_api":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="API Request"
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select
                value={localConfig.api_method || "GET"}
                onValueChange={(value) => updateField("api_method", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={localConfig.api_url || ""}
                onChange={(e) => updateField("api_url", e.target.value)}
                placeholder="https://api.exemplo.com/dados"
              />
            </div>
          </>
        );

      case "ai_process":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Processar com IA"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select
                value={localConfig.ai_model || "gpt-5-mini-2025-08-07"}
                onValueChange={(value) => updateField("ai_model", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prompt / Instruções para IA</Label>
              <Textarea
                value={localConfig.ai_prompt || ""}
                onChange={(e) => updateField("ai_prompt", e.target.value)}
                placeholder="Descreva o que a IA deve fazer com os dados recebidos..."
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{input}}"} para referenciar os dados de entrada
              </p>
            </div>
          </>
        );

      case "condition":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome da Condição</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Condição"
              />
            </div>
            <div className="space-y-2">
              <Label>Expressão</Label>
              <Input
                value={localConfig.condition_expression || ""}
                onChange={(e) => updateField("condition_expression", e.target.value)}
                placeholder="input.length > 100"
              />
              <p className="text-xs text-muted-foreground">
                Use JavaScript. Retorne true ou false.
              </p>
            </div>
          </>
        );

      case "action_publish":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Publicar"
              />
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={localConfig.publish_platform || ""}
                onValueChange={(value) => updateField("publish_platform", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select
                value={localConfig.publish_mode || "draft"}
                onValueChange={(value) => updateField("publish_mode", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Criar Rascunho</SelectItem>
                  <SelectItem value="direct">Publicar Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case "action_n8n":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="n8n Workflow"
              />
            </div>
            <div className="space-y-2">
              <Label>ID do Workflow n8n</Label>
              <Input
                value={localConfig.n8n_workflow_id || ""}
                onChange={(e) => updateField("n8n_workflow_id", e.target.value)}
                placeholder="workflow-id"
              />
            </div>
            <div className="space-y-2">
              <Label>URL do Webhook n8n</Label>
              <Input
                value={localConfig.n8n_webhook_url || ""}
                onChange={(e) => updateField("n8n_webhook_url", e.target.value)}
                placeholder="https://n8n.exemplo.com/webhook/..."
              />
            </div>
          </>
        );

      case "action_webhook":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Chamar Webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <Input
                value={localConfig.webhook_url || ""}
                onChange={(e) => updateField("webhook_url", e.target.value)}
                placeholder="https://exemplo.com/webhook"
              />
            </div>
          </>
        );

      case "action_email":
        return (
          <>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Enviar Email"
              />
            </div>
            <div className="space-y-2">
              <Label>Destinatários (separados por vírgula)</Label>
              <Input
                value={(localConfig.email_recipients || []).join(", ")}
                onChange={(e) =>
                  updateField(
                    "email_recipients",
                    e.target.value.split(",").map((s) => s.trim())
                  )
                }
                placeholder="email@exemplo.com, outro@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={localConfig.email_subject || ""}
                onChange={(e) => updateField("email_subject", e.target.value)}
                placeholder="Assunto do email"
              />
            </div>
          </>
        );

      case "note":
        return (
          <>
            <div className="space-y-2">
              <Label>Título da Nota</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Nota"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                value={localConfig.note_content || ""}
                onChange={(e) => updateField("note_content", e.target.value)}
                placeholder="Anotações sobre este fluxo..."
                className="min-h-[100px]"
              />
            </div>
          </>
        );

      default:
        return <p className="text-muted-foreground">Selecione um node para configurar</p>;
    }
  };

  const getNodeTitle = () => {
    const titles: Record<AutomationNodeType, string> = {
      trigger_rss: "Configurar RSS Feed",
      trigger_webhook: "Configurar Webhook Trigger",
      trigger_schedule: "Configurar Agendamento",
      trigger_api: "Configurar API Request",
      ai_process: "Configurar Processamento IA",
      condition: "Configurar Condição",
      action_publish: "Configurar Publicação",
      action_webhook: "Configurar Webhook",
      action_email: "Configurar Email",
      action_n8n: "Configurar n8n",
      note: "Editar Nota",
    };
    return titles[nodeType] || "Configurar Node";
  };

  return (
    <div className="w-[320px] h-full bg-card border-l border-border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">{getNodeTitle()}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">{renderFields()}</div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
};
