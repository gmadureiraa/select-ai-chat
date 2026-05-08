import { useMemo } from "react";
import {
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Video,
  Share2,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLateConnection, LatePlatform } from "@/hooks/useLateConnection";
import {
  useClientPlatformStatus,
  type SupportedPlatform,
} from "@/hooks/useClientPlatformStatus";
import { useSocialCredentials } from "@/hooks/useSocialCredentials";
import { useToast } from "@/components/ui/use-toast";

/**
 * SocialIntegrationsPanel — dashboard de plataformas conectadas via Postiz.
 *
 * Diferente do SocialIntegrationsTab (legacy, lista cards de "conectar / desconectar"
 * por plataforma), esse painel mostra um *resumo* das contas já conectadas com
 * avatar + nome + botão desconectar, e tem um menu único "+ Conectar nova" pra
 * iniciar OAuth de qualquer plataforma suportada.
 *
 * Drop-in replacement no longo prazo — hoje vive lado a lado durante migração
 * Late→Postiz (UI ainda referencia "Postiz" mas o hook `useLateConnection` já
 * chama postiz-oauth-start internamente, não Late.com).
 */

interface SocialIntegrationsPanelProps {
  clientId: string;
}

// Plataformas suportadas pelo Postiz (espelha LATE_API_PLATFORMS no hook).
const SUPPORTED_PLATFORMS: Array<{
  id: LatePlatform;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  brandClass: string;
}> = [
  { id: "twitter", name: "X / Twitter", icon: Twitter, brandClass: "bg-black text-white" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, brandClass: "bg-[#0A66C2] text-white" },
  { id: "instagram", name: "Instagram", icon: Instagram, brandClass: "bg-gradient-to-tr from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white" },
  { id: "facebook", name: "Facebook", icon: Share2, brandClass: "bg-[#1877F2] text-white" },
  { id: "threads", name: "Threads", icon: Share2, brandClass: "bg-black text-white" },
  { id: "tiktok", name: "TikTok", icon: Video, brandClass: "bg-black text-white" },
  { id: "youtube", name: "YouTube", icon: Youtube, brandClass: "bg-[#FF0000] text-white" },
];

export function SocialIntegrationsPanel({ clientId }: SocialIntegrationsPanelProps) {
  const { toast } = useToast();
  const { credentials, isLoading: isLoadingCreds } = useSocialCredentials(clientId);
  const { statuses, verifyAccounts, isVerifying } = useClientPlatformStatus(clientId);
  const lateConnection = useLateConnection({ clientId });

  const platformMap = useMemo(() => {
    const m = new Map<LatePlatform, (typeof SUPPORTED_PLATFORMS)[number]>();
    SUPPORTED_PLATFORMS.forEach((p) => m.set(p.id, p));
    return m;
  }, []);

  // Conectados = credenciais válidas que existem em SUPPORTED_PLATFORMS
  const connected = (credentials ?? []).filter((c) =>
    platformMap.has(c.platform as LatePlatform),
  );

  // Plataformas ainda não conectadas (pra mostrar no menu "Conectar nova")
  const notConnectedIds = SUPPORTED_PLATFORMS.filter(
    (p) => !connected.some((c) => c.platform === p.id),
  );

  const handleSync = async () => {
    try {
      await verifyAccounts.mutateAsync();
      toast({
        title: "Sincronizado",
        description: "Status das contas atualizado.",
      });
    } catch (error) {
      toast({
        title: "Erro ao sincronizar",
        description: error instanceof Error ? error.message : "Falha ao verificar contas",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (platform: LatePlatform) => {
    await lateConnection.disconnect(platform);
  };

  const handleConnect = (platform: LatePlatform) => {
    lateConnection.openOAuth(platform);
  };

  if (isLoadingCreds) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                Plataformas conectadas
                {connected.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {connected.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Contas integradas via Postiz para publicação automática.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isVerifying}
                className="gap-1.5"
              >
                {isVerifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={notConnectedIds.length === 0 || lateConnection.isLoading}
                  >
                    {lateConnection.isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Conectar nova
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {notConnectedIds.length === 0 ? (
                    <DropdownMenuItem disabled>
                      Todas as plataformas já estão conectadas
                    </DropdownMenuItem>
                  ) : (
                    notConnectedIds.map((p) => {
                      const Icon = p.icon;
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => handleConnect(p.id)}
                          className="gap-2 cursor-pointer"
                        >
                          <span
                            className={`h-6 w-6 rounded flex items-center justify-center ${p.brandClass}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-sm">{p.name}</span>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {connected.length === 0 ? (
            <div className="text-center py-10 px-4 border-2 border-dashed border-border rounded-lg">
              <div className="text-sm font-medium text-foreground">
                Nenhuma conta conectada ainda
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Conecte X, Instagram, LinkedIn ou outras redes via Postiz
                para agendar e publicar direto daqui.
              </p>
            </div>
          ) : (
            connected.map((cred) => {
              const platform = cred.platform as LatePlatform;
              const config = platformMap.get(platform);
              if (!config) return null;
              const Icon = config.icon;

              const status = statuses[platform as SupportedPlatform];
              const isConnecting =
                lateConnection.isLoading &&
                lateConnection.currentPlatform === platform;

              const accountName =
                cred.account_name ||
                status?.accountName ||
                config.name;

              const isHealthy = cred.is_valid;

              return (
                <div
                  key={cred.id}
                  className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={undefined} alt={accountName} />
                      <AvatarFallback
                        className={`${config.brandClass} text-xs font-semibold`}
                      >
                        <Icon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    {/* Status dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        isHealthy ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {accountName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {config.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isHealthy ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Conectado via Postiz
                        </Badge>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 gap-1 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              Reconectar
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs max-w-xs">
                              {cred.validation_error ||
                                "Token expirou ou conta foi desconectada do Postiz."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {cred.last_validated_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Validado{" "}
                          {new Date(cred.last_validated_at).toLocaleDateString(
                            "pt-BR",
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isHealthy && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting}
                        className="h-8 gap-1"
                      >
                        {isConnecting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="text-xs">Reconectar</span>
                      </Button>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDisconnect(platform)}
                          disabled={isConnecting}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          {isConnecting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Desconectar conta</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
