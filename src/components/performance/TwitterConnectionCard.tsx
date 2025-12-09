import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2, LogOut, RefreshCw, Key } from "lucide-react";
import { useTwitterConnection, useStartTwitterOAuth, useDisconnectTwitter, useSaveTwitterCredentials } from "@/hooks/useTwitterOAuth";

interface TwitterConnectionCardProps {
  clientId: string;
}

export const TwitterConnectionCard = ({ clientId }: TwitterConnectionCardProps) => {
  const { data: connection, isLoading: isLoadingConnection } = useTwitterConnection(clientId);
  const { mutate: startOAuth, isPending: isStarting } = useStartTwitterOAuth();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectTwitter(clientId);
  const { mutate: saveCredentials, isPending: isSaving } = useSaveTwitterCredentials(clientId);
  
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const handleSaveAndConnect = () => {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    
    saveCredentials(
      { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
      {
        onSuccess: () => {
          startOAuth({ clientId });
        }
      }
    );
  };

  const handleDisconnect = () => {
    disconnect();
    setShowCredentialsForm(false);
    setApiKey("");
    setApiSecret("");
  };

  if (isLoadingConnection) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = !!connection?.username;
  const hasCredentials = !!connection?.twitter_api_key;

  return (
    <Card className={isConnected ? "border-blue-500/30 bg-blue-500/5" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Conexão X (Twitter)
          {isConnected && <CheckCircle className="h-3 w-3 text-green-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Conta:</span>
              <span className="font-medium">@{connection.username}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" disabled>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sincronizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <LogOut className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        ) : showCredentialsForm || hasCredentials ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Insira suas credenciais do Twitter Developer Portal (OAuth 2.0)
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="apiKey" className="text-xs">Client ID</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Seu Twitter Client ID"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="apiSecret" className="text-xs">Client Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="Seu Twitter Client Secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveAndConnect}
                disabled={isSaving || isStarting || !apiKey.trim() || !apiSecret.trim()}
                className="flex-1 bg-black hover:bg-black/80 text-white"
                size="sm"
              >
                {isSaving || isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Salvar e Conectar
              </Button>
              
              {!hasCredentials && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCredentialsForm(false)}
                >
                  Cancelar
                </Button>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground">
              Crie um app em{" "}
              <a 
                href="https://developer.twitter.com/en/portal/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                developer.twitter.com
              </a>
              {" "}com OAuth 2.0 habilitado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Conecte sua conta do X para importar métricas automaticamente
            </p>
            <Button
              onClick={() => setShowCredentialsForm(true)}
              className="w-full bg-black hover:bg-black/80 text-white"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Conectar X
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
