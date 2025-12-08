import { useState } from "react";
import { X, Bot, Wrench, Brain, Globe, Webhook, Code, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { N8nWorkflowSelector } from "./N8nWorkflowSelector";
import type { AIAgent, AIWorkflowNode, NodeConfig, TriggerType, AgentTool } from "@/types/agentBuilder";

interface AgentConfigPanelProps {
  node: AIWorkflowNode | null;
  agent: AIAgent | null;
  agents: AIAgent[];
  onClose: () => void;
  onUpdateNode: (updates: Partial<AIWorkflowNode>) => void;
  onUpdateAgent: (updates: Partial<AIAgent>) => void;
  onCreateAgent: (agent: Partial<AIAgent>) => void;
}

const models = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
];

const triggerTypes: { value: TriggerType; label: string }[] = [
  { value: "user_message", label: "Mensagem do Usuário" },
  { value: "webhook", label: "Webhook" },
  { value: "schedule", label: "Agendamento" },
  { value: "manual", label: "Manual" },
  { value: "event", label: "Evento" },
];

export const AgentConfigPanel = ({
  node,
  agent,
  agents,
  onClose,
  onUpdateNode,
  onUpdateAgent,
  onCreateAgent,
}: AgentConfigPanelProps) => {
  const [localAgent, setLocalAgent] = useState<Partial<AIAgent>>(agent || {
    name: "",
    description: "",
    system_prompt: "",
    model: "google/gemini-2.5-flash",
    temperature: 0.7,
    memory_enabled: true,
    tools: [],
    knowledge: [],
    variables: {},
  });

  if (!node) return null;

  const isAgentNode = node.type === "agent";
  const isTriggerNode = node.type === "trigger";
  const isConditionNode = node.type === "condition";
  const isToolNode = node.type === "tool";

  const handleSaveAgent = () => {
    if (agent?.id) {
      onUpdateAgent({ ...localAgent, id: agent.id });
    } else {
      onCreateAgent(localAgent);
    }
  };

  const currentTriggerType = ((node.config as NodeConfig)?.trigger_type || "manual") as TriggerType;

  return (
    <div className="w-96 border-l border-border bg-card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {isAgentNode && <Bot className="h-5 w-5 text-primary" />}
          {isToolNode && <Workflow className="h-5 w-5 text-emerald-500" />}
          <h3 className="font-semibold">
            {isAgentNode ? "Configurar Agente" : 
             isTriggerNode ? "Configurar Trigger" : 
             isToolNode ? "Configurar Ferramenta" :
             isConditionNode ? "Configurar Condição" : "Configurar Nó"}
          </h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {isAgentNode ? (
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="w-full justify-start px-4 pt-2">
              <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
              <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
              <TabsTrigger value="knowledge" className="text-xs">Knowledge</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs">Avançado</TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Nome do Agente</Label>
                <Input
                  value={localAgent.name || ""}
                  onChange={(e) => setLocalAgent({ ...localAgent, name: e.target.value })}
                  placeholder="Ex: Analista de SEO"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={localAgent.description || ""}
                  onChange={(e) => setLocalAgent({ ...localAgent, description: e.target.value })}
                  placeholder="Breve descrição do agente"
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={localAgent.system_prompt || ""}
                  onChange={(e) => setLocalAgent({ ...localAgent, system_prompt: e.target.value })}
                  placeholder="Instruções detalhadas para o agente..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Selecionar Agente Existente</Label>
                <Select
                  value={node.agent_id || ""}
                  onValueChange={(value) => {
                    const selectedAgent = agents.find(a => a.id === value);
                    if (selectedAgent) {
                      setLocalAgent(selectedAgent);
                      onUpdateNode({ agent_id: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Criar novo ou selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveAgent} className="w-full">
                {agent?.id ? "Atualizar Agente" : "Criar Agente"}
              </Button>
            </TabsContent>

            <TabsContent value="tools" className="p-4 space-y-4">
              {/* n8n Workflows Integration */}
              <N8nWorkflowSelector
                selectedWorkflows={
                  (localAgent.tools || [])
                    .filter((t: AgentTool) => t.type === "n8n")
                    .map((t: AgentTool) => ({
                      id: t.id,
                      name: t.name,
                      webhookUrl: t.config?.webhookUrl || "",
                    }))
                }
                onSelect={(workflows) => {
                  const otherTools = (localAgent.tools || []).filter((t: AgentTool) => t.type !== "n8n");
                  const n8nTools: AgentTool[] = workflows.map((w) => ({
                    id: w.id,
                    name: w.name,
                    type: "n8n",
                    config: { webhookUrl: w.webhookUrl },
                    description: `n8n workflow: ${w.name}`,
                  }));
                  setLocalAgent({ ...localAgent, tools: [...otherTools, ...n8nTools] });
                }}
              />

              {/* API Tools */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">APIs & Webhooks</Label>
                </div>
                <div className="space-y-2">
                  {(localAgent.tools || [])
                    .filter((t: AgentTool) => t.type === "api" || t.type === "webhook")
                    .map((tool: AgentTool, idx: number) => (
                      <div key={tool.id || idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        {tool.type === "webhook" ? (
                          <Webhook className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Globe className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm flex-1">{tool.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setLocalAgent({
                              ...localAgent,
                              tools: (localAgent.tools || []).filter((t: AgentTool) => t.id !== tool.id),
                            });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const newTool: AgentTool = {
                      id: `api_${Date.now()}`,
                      name: "Nova API",
                      type: "api",
                      config: { url: "", method: "GET" },
                    };
                    setLocalAgent({
                      ...localAgent,
                      tools: [...(localAgent.tools || []), newTool],
                    });
                  }}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Adicionar API
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="p-4 space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Conecte bases de conhecimento</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Adicionar Knowledge
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select
                  value={localAgent.model || "google/gemini-2.5-flash"}
                  onValueChange={(value) => setLocalAgent({ ...localAgent, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Temperature: {localAgent.temperature}</Label>
                <Slider
                  value={[localAgent.temperature || 0.7]}
                  onValueChange={([value]) => setLocalAgent({ ...localAgent, temperature: value })}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Memória Habilitada</Label>
                <Switch
                  checked={localAgent.memory_enabled}
                  onCheckedChange={(checked) => setLocalAgent({ ...localAgent, memory_enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Agente de Escalação</Label>
                <Select
                  value={localAgent.escalation_agent_id || "none"}
                  onValueChange={(value) => setLocalAgent({ ...localAgent, escalation_agent_id: value === "none" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {agents.filter(a => a.id !== agent?.id).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
        ) : isTriggerNode ? (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Trigger</Label>
              <Select
                value={currentTriggerType}
                onValueChange={(value: TriggerType) => onUpdateNode({ 
                  config: { ...node.config, trigger_type: value } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={(node.config as NodeConfig)?.description || ""}
                onChange={(e) => onUpdateNode({ 
                  config: { ...node.config, description: e.target.value } 
                })}
                placeholder="Descrição do trigger"
              />
            </div>
          </div>
        ) : isConditionNode ? (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Nome da Condição</Label>
              <Input
                value={(node.config as NodeConfig)?.label || ""}
                onChange={(e) => onUpdateNode({ 
                  config: { ...node.config, label: e.target.value } 
                })}
                placeholder="Ex: É cliente VIP?"
              />
            </div>

            <div className="space-y-2">
              <Label>Expressão</Label>
              <Textarea
                value={(node.config as NodeConfig)?.condition || ""}
                onChange={(e) => onUpdateNode({ 
                  config: { ...node.config, condition: e.target.value } 
                })}
                placeholder="Ex: output.sentiment === 'positive'"
                className="font-mono text-sm"
              />
            </div>
          </div>
        ) : isToolNode ? (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Ferramenta</Label>
              <Select
                value={(node.config as NodeConfig)?.toolType || "webhook"}
                onValueChange={(value) => onUpdateNode({ 
                  config: { ...node.config, toolType: value } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="n8n">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4" />
                      <span>n8n Workflow</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="webhook">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4" />
                      <span>Webhook</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="api">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>API HTTP</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(node.config as NodeConfig)?.toolType === "n8n" ? (
              <div className="space-y-4">
                <N8nWorkflowSelector
                  selectedWorkflows={
                    (node.config as NodeConfig)?.n8nWorkflowId
                      ? [{
                          id: (node.config as NodeConfig)?.n8nWorkflowId || "",
                          name: (node.config as NodeConfig)?.n8nWorkflowName || "",
                          webhookUrl: (node.config as NodeConfig)?.webhookUrl || "",
                        }]
                      : []
                  }
                  onSelect={(workflows) => {
                    const selected = workflows[0];
                    if (selected) {
                      onUpdateNode({
                        config: {
                          ...node.config,
                          n8nWorkflowId: selected.id,
                          n8nWorkflowName: selected.name,
                          webhookUrl: selected.webhookUrl,
                        }
                      });
                    } else {
                      onUpdateNode({
                        config: {
                          ...node.config,
                          n8nWorkflowId: undefined,
                          n8nWorkflowName: undefined,
                          webhookUrl: undefined,
                        }
                      });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={(node.config as NodeConfig)?.label || ""}
                    onChange={(e) => onUpdateNode({ 
                      config: { ...node.config, label: e.target.value } 
                    })}
                    placeholder="Nome da ferramenta"
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={(node.config as NodeConfig)?.url || ""}
                    onChange={(e) => onUpdateNode({ 
                      config: { ...node.config, url: e.target.value } 
                    })}
                    placeholder="https://api.example.com/endpoint"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Método HTTP</Label>
                  <Select
                    value={(node.config as NodeConfig)?.method || "POST"}
                    onValueChange={(value) => onUpdateNode({ 
                      config: { ...node.config, method: value } 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Headers (JSON)</Label>
                  <Textarea
                    value={JSON.stringify((node.config as NodeConfig)?.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        onUpdateNode({ 
                          config: { ...node.config, headers: JSON.parse(e.target.value) } 
                        });
                      } catch {}
                    }}
                    placeholder='{}'
                    className="font-mono text-sm min-h-[80px]"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Configuração do Nó</Label>
              <Textarea
                value={JSON.stringify(node.config, null, 2)}
                onChange={(e) => {
                  try {
                    onUpdateNode({ config: JSON.parse(e.target.value) });
                  } catch {}
                }}
                className="font-mono text-sm min-h-[200px]"
              />
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
