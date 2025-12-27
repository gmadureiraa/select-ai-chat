import { useState, useEffect } from "react";
import { X, Save, Play, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NodeExecutionPanel } from "./NodeExecutionPanel";
import type { AutomationNodeType, AutomationNodeConfig } from "@/types/automationBuilder";
import { cn } from "@/lib/utils";

interface ImprovedNodeConfigPanelProps {
  nodeType: AutomationNodeType;
  nodeId: string;
  config: AutomationNodeConfig;
  onClose: () => void;
  onUpdate: (config: AutomationNodeConfig) => void;
  onExecuteNode?: (nodeId: string) => Promise<any>;
  inputData?: any;
  outputData?: any;
  previousNodeLabel?: string;
  error?: string;
}

const MODELS = [
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini" },
  { id: "gpt-5-2025-08-07", name: "GPT-5" },
  { id: "gpt-4.1-2025-04-14", name: "GPT-4.1" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

const POLL_MODES = [
  { id: "fixed", name: "Fixed" },
  { id: "expression", name: "Expression" },
];

const POLL_INTERVALS = [
  { id: "every_minute", name: "Every Minute" },
  { id: "every_5_minutes", name: "Every 5 Minutes" },
  { id: "every_15_minutes", name: "Every 15 Minutes" },
  { id: "every_hour", name: "Every Hour" },
  { id: "every_day", name: "Every Day" },
];

export const ImprovedNodeConfigPanel = ({
  nodeType,
  nodeId,
  config,
  onClose,
  onUpdate,
  onExecuteNode,
  inputData,
  outputData,
  previousNodeLabel,
  error,
}: ImprovedNodeConfigPanelProps) => {
  const [localConfig, setLocalConfig] = useState<AutomationNodeConfig>(config);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState("parameters");

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    onUpdate(localConfig);
  };

  const handleExecute = async () => {
    if (!onExecuteNode) return;
    setIsExecuting(true);
    try {
      await onExecuteNode(nodeId);
    } finally {
      setIsExecuting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  const getNodeIcon = () => {
    switch (nodeType) {
      case "trigger_rss": return "📡";
      case "trigger_webhook": return "🔗";
      case "trigger_schedule": return "⏰";
      case "trigger_api": return "🌐";
      case "ai_process": return "🤖";
      case "condition": return "❓";
      case "action_publish": return "📤";
      case "action_webhook": return "↗️";
      case "action_email": return "📧";
      case "action_n8n": return "⚡";
      default: return "📝";
    }
  };

  const getNodeTitle = () => {
    const titles: Record<AutomationNodeType, string> = {
      trigger_rss: "RSS Feed Trigger",
      trigger_webhook: "Webhook Trigger",
      trigger_schedule: "Schedule Trigger",
      trigger_api: "API Trigger",
      ai_process: "AI Process",
      condition: "Condition",
      action_publish: "Publish",
      action_webhook: "Webhook Action",
      action_email: "Send Email",
      action_n8n: "n8n Workflow",
      note: "Note",
    };
    return localConfig.label || titles[nodeType] || "Node";
  };

  const renderParametersContent = () => {
    switch (nodeType) {
      case "trigger_rss":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Poll Times</Label>
              <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-sm">Mode</Label>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    {POLL_MODES.map((mode) => (
                      <Button
                        key={mode.id}
                        variant={localConfig.poll_mode === mode.id ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateField("poll_mode", mode.id)}
                      >
                        {mode.name}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-sm">Interval</Label>
                  <Select
                    value={localConfig.poll_interval || "every_hour"}
                    onValueChange={(v) => updateField("poll_interval", v)}
                  >
                    <SelectTrigger className="flex-1 h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POLL_INTERVALS.map((interval) => (
                        <SelectItem key={interval.id} value={interval.id}>
                          {interval.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-16 text-sm">Minute</Label>
                  <Input
                    type="number"
                    value={localConfig.poll_minute || 0}
                    onChange={(e) => updateField("poll_minute", parseInt(e.target.value))}
                    className="flex-1 h-9 bg-background"
                    min={0}
                    max={59}
                  />
                </div>

                <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                  Add Poll Time
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Feed URL</Label>
              <Input
                value={localConfig.rss_url || ""}
                onChange={(e) => updateField("rss_url", e.target.value)}
                placeholder="https://rss.example.com/feed.xml"
                className="bg-muted/30"
              />
            </div>
          </div>
        );

      case "ai_process":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Mode</Label>
              <Select
                value={localConfig.ai_mode || "run_once"}
                onValueChange={(v) => updateField("ai_mode", v)}
              >
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="run_once">Run Once for All Items</SelectItem>
                  <SelectItem value="run_each">Run for Each Item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Model</Label>
              <Select
                value={localConfig.ai_model || "gpt-5-mini-2025-08-07"}
                onValueChange={(v) => updateField("ai_model", v)}
              >
                <SelectTrigger className="bg-muted/30">
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
              <Label className="text-xs font-medium text-muted-foreground">Prompt</Label>
              <Textarea
                value={localConfig.ai_prompt || ""}
                onChange={(e) => updateField("ai_prompt", e.target.value)}
                placeholder="// Loop over input items and process with AI"
                className="min-h-[150px] font-mono text-sm bg-muted/30"
              />
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-600">
                Type $ for a list of special vars/methods. Debug by using console.log() statements.
              </div>
            </div>
          </div>
        );

      case "action_publish":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Credential to connect with</Label>
              <Select
                value={localConfig.publish_credential || ""}
                onValueChange={(v) => updateField("publish_credential", v)}
              >
                <SelectTrigger className="bg-muted/30">
                  <SelectValue placeholder="Select credential" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter_main">Twitter - Main Account</SelectItem>
                  <SelectItem value="linkedin_main">LinkedIn - Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Resource</Label>
              <Select
                value={localConfig.publish_resource || "tweet"}
                onValueChange={(v) => updateField("publish_resource", v)}
              >
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tweet">Tweet</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Operation</Label>
              <Select
                value={localConfig.publish_operation || "create"}
                onValueChange={(v) => updateField("publish_operation", v)}
              >
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="draft">Save as Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Text</Label>
              <Textarea
                value={localConfig.publish_text || ""}
                onChange={(e) => updateField("publish_text", e.target.value)}
                placeholder={"{{ $json.title }}\n{{ $json.link }}"}
                className="min-h-[100px] font-mono text-sm bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Options</Label>
              <div className="text-xs text-muted-foreground">No properties</div>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                Add Field
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={localConfig.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                placeholder="Nome do node"
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={localConfig.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Descrição opcional"
                className="bg-muted/30"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getNodeIcon()}</span>
          <span className="font-semibold">{getNodeTitle()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1"
            onClick={handleExecute}
            disabled={isExecuting}
          >
            <Play className="h-3 w-3" />
            {nodeType.startsWith("trigger_") ? "Fetch Test Event" : "Execute step"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border px-3">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="parameters"
              className="data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 pb-2"
            >
              Parameters
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 pb-2"
            >
              Settings
            </TabsTrigger>
          </TabsList>
          <a
            href="https://docs.n8n.io"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 top-[52px] text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <TabsContent value="parameters" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">{renderParametersContent()}</div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Node Name</Label>
                <Input
                  value={localConfig.label || ""}
                  onChange={(e) => updateField("label", e.target.value)}
                  placeholder="Node name"
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={localConfig.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Add notes about this node..."
                  className="bg-muted/30 min-h-[100px]"
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Bottom Execute Button */}
      <div className="p-3 border-t border-border">
        <Button
          variant="destructive"
          size="sm"
          className="h-8 gap-1"
          onClick={handleExecute}
          disabled={isExecuting}
        >
          <Play className="h-3 w-3" />
          {nodeType.startsWith("trigger_") ? "Fetch Test Event" : "Execute step"}
        </Button>
      </div>
    </div>
  );
};
