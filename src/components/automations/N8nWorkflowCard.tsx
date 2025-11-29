import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface N8nWorkflowCardProps {
  title: string;
  description: string;
  workflowId: string;
  defaultWebhookUrl?: string;
}

export function N8nWorkflowCard({
  title,
  description,
  workflowId,
  defaultWebhookUrl = "",
}: N8nWorkflowCardProps) {
  const [webhookUrl, setWebhookUrl] = useState(defaultWebhookUrl);
  const [isRunning, setIsRunning] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRun = async () => {
    if (!webhookUrl) {
      toast.error("Configure o webhook URL primeiro");
      setIsDialogOpen(true);
      return;
    }

    setIsRunning(true);
    console.log("Executando workflow n8n:", workflowId);

    try {
      const response = await fetch(webhookUrl, {
        method: "GET",
      });

      if (response.ok) {
        toast.success("Workflow executado com sucesso!");
        console.log("Workflow response:", await response.text());
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error) {
      console.error("Erro ao executar workflow:", error);
      toast.error("Erro ao executar workflow. Verifique o webhook URL.");
    } finally {
      setIsRunning(false);
    }
  };

  const saveWebhookUrl = () => {
    localStorage.setItem(`n8n_webhook_${workflowId}`, webhookUrl);
    toast.success("Webhook URL salvo!");
    setIsDialogOpen(false);
  };

  // Load webhook URL from localStorage on mount
  useState(() => {
    const saved = localStorage.getItem(`n8n_webhook_${workflowId}`);
    if (saved) setWebhookUrl(saved);
  });

  return (
    <Card className="border-accent/30 bg-card/50 backdrop-blur-sm hover:border-accent/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {title}
            </CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Workflow</DialogTitle>
                <DialogDescription>
                  Configure o webhook URL do workflow do n8n
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://n8n.srv789271.hstgr.cloud/webhook/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Adicione um Webhook trigger no workflow e cole a URL aqui
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveWebhookUrl}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardFooter>
        <Button
          onClick={handleRun}
          disabled={isRunning || !webhookUrl}
          className="w-full"
          variant="default"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Executar Workflow
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
