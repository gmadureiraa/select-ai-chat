import { AutomationAction } from "@/types/automation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

interface ActionsConfigProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  webhookUrl?: string;
  emailRecipients?: string[];
  onWebhookChange: (url: string) => void;
  onEmailRecipientsChange: (emails: string[]) => void;
}

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
            <div className="flex-1">
              <Select
                value={action.type}
                onValueChange={(value: AutomationAction["type"]) =>
                  updateAction(action.id, { type: value })
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
                </SelectContent>
              </Select>

              {action.type === "send_email" && (
                <div className="mt-3">
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
                <div className="mt-3">
                  <Label className="text-sm mb-2 block">URL do Webhook</Label>
                  <Input
                    placeholder="https://..."
                    value={webhookUrl || ""}
                    onChange={(e) => onWebhookChange(e.target.value)}
                  />
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
