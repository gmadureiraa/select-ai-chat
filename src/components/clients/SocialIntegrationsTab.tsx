import { Loader2, Check, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocialCredentials } from "@/hooks/useSocialCredentials";
import { useLateConnection, LatePlatform } from "@/hooks/useLateConnection";
import { useClientPlatformStatus } from "@/hooks/useClientPlatformStatus";
import { useToast } from "@/components/ui/use-toast";
// 2026-05-18 rev2 — MetricoolBrandMapper removido. Conexão de contas
// agora via Late/Zernio (PlatformConnectCards no SV settings).
import { getNetworkBranding } from "@/lib/network-branding";
import { cn } from "@/lib/utils";

interface SocialIntegrationsTabProps {
  clientId: string;
}

// Descrições curtas por plataforma (vão pro card subtitle).
const PLATFORM_DESCRIPTIONS: Record<LatePlatform, string> = {
  twitter: "Publique tweets automaticamente",
  linkedin: "Posts e artigos profissionais",
  instagram: "Feed, Reels e Stories",
  facebook: "Posts e Stories em páginas",
  threads: "Threads do Instagram",
  tiktok: "Vídeos curtos virais",
  youtube: "Vídeos e Shorts",
};

export function SocialIntegrationsTab({ clientId }: SocialIntegrationsTabProps) {
  const { 
    credentials, 
    isLoading, 
  } = useSocialCredentials(clientId);
  
  const { toast } = useToast();

  const lateConnection = useLateConnection({ clientId });
  const { verifyAccounts, isVerifying } = useClientPlatformStatus(clientId);

  // 2026-05-19 P1 fix audit: removido `currentMetricoolBlogId` IIFE — variável
  // nunca lida em nenhum lugar (legacy de antes da migração Metricool→Late).

  const handleSyncWithLate = async () => {
    try {
      await verifyAccounts.mutateAsync();
      toast({
        title: "Sincronizado",
        description: "Status das contas atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao sincronizar",
        description: error instanceof Error ? error.message : "Falha ao verificar contas",
        variant: "destructive",
      });
    }
  };

  // Removed the useEffect that reads query params - all OAuth handling is now via postMessage only
  // This eliminates "ghost toasts" from stale query parameters

  const getCredentialForPlatform = (platform: LatePlatform) => {
    return credentials?.find(c => c.platform === platform);
  };

  const renderPlatformCard = (platform: LatePlatform) => {
    const branding = getNetworkBranding(platform);
    const Icon = branding.icon;
    const description = PLATFORM_DESCRIPTIONS[platform];
    const credential = getCredentialForPlatform(platform);
    const isConnecting = lateConnection.isLoading && lateConnection.currentPlatform === platform;
    const isConnected = !!credential?.is_valid;

    return (
      <Card
        key={platform}
        className={cn(
          "relative border-2 transition-all hover:shadow-md overflow-hidden",
          isConnected
            ? cn(branding.borderColor, branding.accentBg)
            : "border-dashed border-primary/20 hover:border-primary/40",
        )}
      >
        {/* Faixa colorida no topo — assinatura visual da rede */}
        <div
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-1", branding.bgGradient)}
        />
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shadow-sm",
                  branding.bgGradient,
                )}
              >
                <Icon className={cn("h-5 w-5", branding.iconOnBgClass)} />
              </div>
              <div>
                <CardTitle className="text-base">{branding.label}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isConnected ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  <span className="text-muted-foreground">Conta conectada:</span>{" "}
                  <span className="font-medium">{credential?.account_name || branding.label}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conectado em:{" "}
                  {credential?.last_validated_at
                    ? new Date(credential.last_validated_at).toLocaleDateString("pt-BR")
                    : "N/A"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lateConnection.openOAuth(platform)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reconectar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // 2026-05-19 P0 fix: confirma antes (destrutivo).
                    if (window.confirm(`Desconectar ${platform}? Você precisará reconectar via OAuth.`)) {
                      lateConnection.disconnect(platform);
                    }
                  }}
                  disabled={lateConnection.isLoading && lateConnection.currentPlatform === platform}
                >
                  {lateConnection.isLoading && lateConnection.currentPlatform === platform ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta {branding.label} para publicação automática.
              </p>
              <Button
                onClick={() => lateConnection.openOAuth(platform)}
                disabled={isConnecting}
                className={cn(
                  branding.bgGradient,
                  branding.iconOnBgClass,
                  "hover:opacity-90 border-0",
                )}
              >
                {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Icon className={cn("h-4 w-4 mr-2", branding.iconOnBgClass)} />
                Conectar {branding.label}
              </Button>

              {credential?.validation_error && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                  {credential.validation_error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Integrações Sociais</h3>
          <p className="text-sm text-muted-foreground">
            Conecte suas redes sociais para publicação automática
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncWithLate}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      <div className="grid gap-4">
        {(['twitter', 'linkedin', 'instagram', 'facebook', 'threads', 'tiktok', 'youtube'] as LatePlatform[]).map(platform =>
          renderPlatformCard(platform)
        )}
      </div>

      {/* 2026-05-18 rev2 — MetricoolBrandMapper removido. Conexões agora via Late/Zernio. */}
    </div>
  );
}
