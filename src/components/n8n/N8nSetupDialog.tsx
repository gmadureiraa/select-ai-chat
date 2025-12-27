import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, ExternalLink, Loader2 } from "lucide-react";

interface N8nSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (apiUrl: string, apiKey: string) => Promise<void>;
  isLoading?: boolean;
  existingUrl?: string;
}

export function N8nSetupDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  isLoading,
  existingUrl 
}: N8nSetupDialogProps) {
  const [apiUrl, setApiUrl] = useState(existingUrl || "");
  const [apiKey, setApiKey] = useState("");

  const handleSave = async () => {
    if (!apiUrl || !apiKey) return;
    await onSave(apiUrl, apiKey);
    onOpenChange(false);
    setApiKey("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Conectar n8n
          </DialogTitle>
          <DialogDescription>
            Configure as credenciais da API do seu n8n para conectar seus workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="n8n-url">URL da instância n8n</Label>
            <Input
              id="n8n-url"
              placeholder="https://seu-n8n.exemplo.com"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A URL base da sua instância n8n (sem /api ou caminhos adicionais)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n8n-key">API Key</Label>
            <Input
              id="n8n-key"
              type="password"
              placeholder="n8n_api_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Encontre sua API Key em: n8n → Settings → API
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-2">Como obter a API Key:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Acesse sua instância n8n</li>
              <li>Vá em Settings → API</li>
              <li>Crie uma nova API Key</li>
              <li>Copie e cole aqui</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <a href="https://docs.n8n.io/api/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação
            </a>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!apiUrl || !apiKey || isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}