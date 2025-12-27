import { AutomationAction, PublishConfig } from "@/types/automation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, Plus, Twitter, Linkedin, Instagram, Send, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionsConfigProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  webhookUrl?: string;
  emailRecipients?: string[];
  onWebhookChange: (url: string) => void;
  onEmailRecipientsChange: (emails: string[]) => void;
}

const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
};

export const ActionsConfig = ({
  actions,
  onChange,
  webhookUrl,
  emailRecipients,
  onWebhookChange,
  onEmailRecipientsChange,
}: ActionsConfigProps) => {
  const addAction = () => {
    const newAction: AutomationAction = {
      id: crypto.randomUUID(),
      type: "save_to_db",
      config: {},
    };
    onChange([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, updates: Partial<AutomationAction>) => {
    onChange(actions.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const updatePublishConfig = (id: string, updates: Partial<PublishConfig>) => {
    const action = actions.find((a) => a.id === id);
    if (action) {
      const currentConfig: PublishConfig = action.publishConfig || {
        platform: "twitter",
        mode: "draft",
      };
      updateAction(id, {
        publishConfig: { ...currentConfig, ...updates },
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Ações após execução</Label>
        <Button type="button" variant="outline" size="sm" onClick={addAction}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Ação
        </Button>
      </div>

      {actions.map((action) => (
        <div key={action.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <Select
                value={action.type}
                onValueChange={(value: AutomationAction["type"]) =>
                  updateAction(action.id, { 
                    type: value,
                    publishConfig: value === "publish" ? { platform: "twitter", mode: "draft" } : undefined
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="save_to_db">Salvar no banco</SelectItem>
                  <SelectItem value="send_email">Enviar email</SelectItem>
                  <SelectItem value="webhook">Chamar webhook</SelectItem>
                  <SelectItem value="save_to_file">Salvar em arquivo</SelectItem>
                  <SelectItem value="publish">📢 Publicar em rede social</SelectItem>
                </SelectContent>
              </Select>

              {action.type === "send_email" && (
                <div>
                  <Label className="text-sm mb-2 block">Destinatários (separados por vírgula)</Label>
                  <Input
                    placeholder="email1@example.com, email2@example.com"
                    value={emailRecipients?.join(", ") || ""}
                    onChange={(e) =>
                      onEmailRecipientsChange(
                        e.target.value.split(",").map((email) => email.trim())
                      )
                    }
                  />
                </div>
              )}

              {action.type === "webhook" && (
                <div>
                  <Label className="text-sm mb-2 block">URL do Webhook</Label>
                  <Input
                    placeholder="https://..."
                    value={webhookUrl || ""}
                    onChange={(e) => onWebhookChange(e.target.value)}
                  />
                </div>
              )}

              {action.type === "publish" && (
                <div className="space-y-4 pt-2">
                  {/* Platform Selection */}
                  <div>
                    <Label className="text-sm mb-3 block">Plataforma</Label>
                    <div className="flex gap-2">
                      {(["twitter", "linkedin", "instagram"] as const).map((platform) => {
                        const Icon = platformIcons[platform];
                        const isSelected = action.publishConfig?.platform === platform;
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => updatePublishConfig(action.id, { platform })}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-md border transition-all",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="capitalize text-sm">{platform}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div>
                    <Label className="text-sm mb-3 block">Modo de publicação</Label>
                    <RadioGroup
                      value={action.publishConfig?.mode || "draft"}
                      onValueChange={(value) => updatePublishConfig(action.id, { mode: value as "direct" | "draft" })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="draft" id={`draft-${action.id}`} />
                        <Label htmlFor={`draft-${action.id}`} className="flex items-center gap-2 cursor-pointer">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>Criar rascunho</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="direct" id={`direct-${action.id}`} />
                        <Label htmlFor={`direct-${action.id}`} className="flex items-center gap-2 cursor-pointer">
                          <Send className="h-4 w-4 text-muted-foreground" />
                          <span>Publicar direto</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* n8n Webhook for direct publish */}
                  {action.publishConfig?.mode === "direct" && (
                    <div>
                      <Label className="text-sm mb-2 block">Webhook n8n (para publicação)</Label>
                      <Input
                        placeholder="https://n8n.example.com/webhook/..."
                        value={action.publishConfig?.n8nWebhookUrl || ""}
                        onChange={(e) => updatePublishConfig(action.id, { n8nWebhookUrl: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Configure um workflow n8n para publicar automaticamente
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAction(action.id)}
              className="ml-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma ação configurada. Adicione ações para processar o resultado.
        </p>
      )}
    </div>
  );
};
