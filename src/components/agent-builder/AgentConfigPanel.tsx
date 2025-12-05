import { useState } from "react";
import { X, Bot, Wrench, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AIAgent, AIWorkflowNode, NodeConfig, TriggerType } from "@/types/agentBuilder";

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
          <h3 className="font-semibold">
            {isAgentNode ? "Configurar Agente" : isTriggerNode ? "Configurar Trigger" : "Configurar Nó"}
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
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Adicione ferramentas para o agente usar</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Adicionar Ferramenta
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
                  value={localAgent.escalation_agent_id || ""}
                  onValueChange={(value) => setLocalAgent({ ...localAgent, escalation_agent_id: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
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
