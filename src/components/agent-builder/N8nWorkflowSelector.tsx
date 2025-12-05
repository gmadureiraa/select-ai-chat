import { useState } from "react";
import { Workflow, RefreshCw, ExternalLink, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useN8nWorkflows, N8nWorkflow } from "@/hooks/useN8nWorkflows";
import { cn } from "@/lib/utils";

interface N8nWorkflowSelectorProps {
  selectedWorkflows: Array<{ id: string; name: string; webhookUrl: string }>;
  onSelect: (workflows: Array<{ id: string; name: string; webhookUrl: string }>) => void;
}

export function N8nWorkflowSelector({ selectedWorkflows, onSelect }: N8nWorkflowSelectorProps) {
  const { workflows, isLoading, refreshWorkflows } = useN8nWorkflows();
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const [customName, setCustomName] = useState("");

  const toggleWorkflow = (workflow: N8nWorkflow) => {
    const isSelected = selectedWorkflows.some(w => w.id === workflow.id);
    
    if (isSelected) {
      onSelect(selectedWorkflows.filter(w => w.id !== workflow.id));
    } else {
      onSelect([
        ...selectedWorkflows,
        {
          id: workflow.id,
          name: workflow.name,
          webhookUrl: workflow.webhookUrl || "",
        },
      ]);
    }
  };

  const addCustomWebhook = () => {
    if (!customWebhookUrl || !customName) return;
    
    const customId = `custom_${Date.now()}`;
    onSelect([
      ...selectedWorkflows,
      {
        id: customId,
        name: customName,
        webhookUrl: customWebhookUrl,
      },
    ]);
    
    setCustomWebhookUrl("");
    setCustomName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h4 className="font-medium">Workflows n8n</h4>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refreshWorkflows}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-2">
          {workflows.map((workflow) => {
            const isSelected = selectedWorkflows.some(w => w.id === workflow.id);
            
            return (
              <Card
                key={workflow.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  isSelected && "border-primary bg-primary/5"
                )}
                onClick={() => toggleWorkflow(workflow)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{workflow.name}</span>
                        {workflow.active && (
                          <Badge variant="secondary" className="text-xs">
                            Ativo
                          </Badge>
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                      {workflow.webhookUrl && (
                        <div className="flex items-center gap-1 mt-2">
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {workflow.webhookUrl}
                          </span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {workflows.length === 0 && !isLoading && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum workflow encontrado
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Custom Webhook Section */}
      <div className="border-t pt-4 space-y-3">
        <Label className="text-sm font-medium">Adicionar Webhook Customizado</Label>
        <Input
          placeholder="Nome do workflow"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="text-sm"
        />
        <Input
          placeholder="https://n8n.example.com/webhook/..."
          value={customWebhookUrl}
          onChange={(e) => setCustomWebhookUrl(e.target.value)}
          className="text-sm font-mono"
        />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={addCustomWebhook}
          disabled={!customWebhookUrl || !customName}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Webhook
        </Button>
      </div>

      {/* Selected Workflows */}
      {selectedWorkflows.length > 0 && (
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-2 block">
            Selecionados ({selectedWorkflows.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {selectedWorkflows.map((w) => (
              <Badge
                key={w.id}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onSelect(selectedWorkflows.filter(sw => sw.id !== w.id))}
              >
                {w.name} ×
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
