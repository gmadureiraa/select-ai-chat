import { Twitter, Linkedin, Loader2, Check, Trash2, Share2, RefreshCw, Instagram, Video, Youtube, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocialCredentials } from "@/hooks/useSocialCredentials";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { EnterpriseLockScreen } from "@/components/shared/EnterpriseLockScreen";
import { useLateConnection, LatePlatform } from "@/hooks/useLateConnection";
import { useClientPlatformStatus } from "@/hooks/useClientPlatformStatus";
import { useToast } from "@/components/ui/use-toast";

interface SocialIntegrationsTabProps {
  clientId: string;
}

const platformConfig: Record<LatePlatform, { 
  name: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
  description: string;
  comingSoon?: boolean;
}> = {
  twitter: { 
    name: "X / Twitter", 
    icon: Twitter, 
    color: "bg-black",
    description: "Publique tweets automaticamente"
  },
  linkedin: { 
    name: "LinkedIn", 
    icon: Linkedin, 
    color: "bg-[#0A66C2]",
    description: "Posts e artigos profissionais"
  },
  instagram: { 
    name: "Instagram", 
    icon: Instagram, 
    color: "bg-gradient-to-tr from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
    description: "Feed, Reels e Stories"
  },
  facebook: { 
    name: "Facebook", 
    icon: Share2, 
    color: "bg-[#1877F2]",
    description: "Posts e Stories em páginas"
  },
  threads: { 
    name: "Threads", 
    icon: Share2, 
    color: "bg-black",
    description: "Threads do Instagram"
  },
  tiktok: { 
    name: "TikTok", 
    icon: Video, 
    color: "bg-black",
    description: "Vídeos curtos virais"
  },
  youtube: { 
    name: "YouTube", 
    icon: Youtube, 
    color: "bg-[#FF0000]",
    description: "Vídeos e Shorts"
  },
};

export function SocialIntegrationsTab({ clientId }: SocialIntegrationsTabProps) {
  const { 
    credentials, 
    isLoading, 
  } = useSocialCredentials(clientId);
  const { isEnterprise } = usePlanFeatures();
  const { toast } = useToast();

  const lateConnection = useLateConnection({ clientId });
  const { verifyAccounts, isVerifying } = useClientPlatformStatus(clientId);

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
    const config = platformConfig[platform];
    const credential = getCredentialForPlatform(platform);
    const Icon = config.icon;
    const isConnecting = lateConnection.isLoading && lateConnection.currentPlatform === platform;

    if (config.comingSoon) {
      return (
        <Card key={platform} className="border-2 border-dashed border-muted opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${config.color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">{config.name}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">Em breve</Badge>
            </div>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card key={platform} className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${config.color} flex items-center justify-center`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">{config.name}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
            {credential?.is_valid && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {credential?.is_valid ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  <span className="text-muted-foreground">Conta conectada:</span>{" "}
                  <span className="font-medium">{credential.account_name || config.name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conectado em: {credential.last_validated_at 
                    ? new Date(credential.last_validated_at).toLocaleDateString('pt-BR')
                    : 'N/A'}
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
                  onClick={() => lateConnection.disconnect(platform)}
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
                Conecte sua conta {config.name} para publicação automática.
              </p>
              <Button
                onClick={() => lateConnection.openOAuth(platform)}
                disabled={isConnecting}
                className={config.color}
              >
                {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Icon className="h-4 w-4 mr-2" />
                Conectar {config.name}
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

  if (!isEnterprise) {
    return (
      <EnterpriseLockScreen
        title="Integrações de Publicação"
        description="Configure APIs para publicação automática nas redes sociais. Disponível exclusivamente no plano Enterprise."
        icon={<Share2 className="h-10 w-10 text-muted-foreground" />}
      />
    );
  }

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
    </div>
  );
}
