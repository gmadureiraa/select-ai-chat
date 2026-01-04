import { useState, useEffect } from "react";
import { Twitter, Linkedin, Loader2, Check, Eye, EyeOff, Trash2, Share2, X, Instagram, Youtube, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocialCredentials, SocialCredential } from "@/hooks/useSocialCredentials";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { EnterpriseLockScreen } from "@/components/shared/EnterpriseLockScreen";
import { useInstagramConnection, useStartInstagramOAuth, useFetchInstagramOAuthMetrics, useDisconnectInstagram } from "@/hooks/useInstagramOAuth";
import { useYouTubeConnection, useStartYouTubeOAuth, useFetchYouTubeAnalytics, useDisconnectYouTube } from "@/hooks/useYouTubeOAuth";
import { useTwitterOAuthPopup } from "@/hooks/useTwitterOAuth";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface SocialIntegrationsTabProps {
  clientId: string;
}

export function SocialIntegrationsTab({ clientId }: SocialIntegrationsTabProps) {
  const { 
    credentials, 
    isLoading, 
    twitterCredential, 
    linkedInCredential, 
    validateTwitter, 
    validateLinkedIn,
    deleteCredential 
  } = useSocialCredentials(clientId);
  const { isEnterprise } = usePlanFeatures();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Instagram OAuth
  const { data: instagramConnection, isLoading: instagramLoading } = useInstagramConnection(clientId);
  const startInstagramOAuth = useStartInstagramOAuth();
  const fetchInstagramMetrics = useFetchInstagramOAuthMetrics();
  const disconnectInstagram = useDisconnectInstagram();

  // YouTube OAuth
  const { data: youtubeConnection, isLoading: youtubeLoading } = useYouTubeConnection(clientId);
  const startYouTubeOAuth = useStartYouTubeOAuth();
  const fetchYouTubeAnalytics = useFetchYouTubeAnalytics();
  const disconnectYouTube = useDisconnectYouTube();

  // Twitter OAuth 2.0
  const twitterOAuth = useTwitterOAuthPopup(clientId);
  const [showAdvancedTwitter, setShowAdvancedTwitter] = useState(false);

  const [twitterForm, setTwitterForm] = useState({
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  });

  const [linkedinForm, setLinkedinForm] = useState({
    oauthAccessToken: "",
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Handle OAuth callback messages
  useEffect(() => {
    const instagramOAuth = searchParams.get('instagram_oauth');
    const youtubeOAuth = searchParams.get('youtube_oauth');
    const message = searchParams.get('message');

    if (instagramOAuth === 'success') {
      toast({
        title: "Instagram conectado!",
        description: "Sua conta Instagram foi conectada com sucesso.",
      });
      searchParams.delete('instagram_oauth');
      searchParams.delete('message');
      setSearchParams(searchParams);
    } else if (instagramOAuth === 'error') {
      toast({
        title: "Erro ao conectar Instagram",
        description: message || "Ocorreu um erro ao conectar sua conta.",
        variant: "destructive",
      });
      searchParams.delete('instagram_oauth');
      searchParams.delete('message');
      setSearchParams(searchParams);
    }

    if (youtubeOAuth === 'success') {
      toast({
        title: "YouTube conectado!",
        description: "Sua conta YouTube foi conectada com sucesso.",
      });
      searchParams.delete('youtube_oauth');
      searchParams.delete('message');
      setSearchParams(searchParams);
    } else if (youtubeOAuth === 'error') {
      toast({
        title: "Erro ao conectar YouTube",
        description: message || "Ocorreu um erro ao conectar sua conta.",
        variant: "destructive",
      });
      searchParams.delete('youtube_oauth');
      searchParams.delete('message');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const handleSaveTwitter = async () => {
    await validateTwitter.mutateAsync(twitterForm);
    setTwitterForm({ apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" });
  };

  const handleSaveLinkedin = async () => {
    await validateLinkedIn.mutateAsync(linkedinForm);
    setLinkedinForm({ oauthAccessToken: "" });
  };

  const toggleSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const renderCredentialStatus = (credential: SocialCredential | undefined) => {
    if (!credential) return null;

    return (
      <div className="flex items-center gap-2">
        {credential.is_valid === true && (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Check className="h-3 w-3 mr-1" />
            Verificado
          </Badge>
        )}
        {credential.is_valid === false && (
          <Badge variant="outline" className="text-destructive border-destructive">
            <X className="h-3 w-3 mr-1" />
            Inválido
          </Badge>
        )}
        {credential.is_valid === null && (
          <Badge variant="outline" className="text-muted-foreground">
            Não verificado
          </Badge>
        )}
      </div>
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
      <div>
        <h3 className="text-lg font-medium">Integrações Sociais</h3>
        <p className="text-sm text-muted-foreground">
          Conecte suas redes sociais para métricas automáticas e publicação
        </p>
      </div>

      {/* Section: OAuth Connections (Easy) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Conexão Simples (OAuth)</h4>
          <Badge variant="secondary" className="text-xs">Recomendado</Badge>
        </div>

        {/* Instagram OAuth */}
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Instagram</CardTitle>
                  <CardDescription>Métricas automáticas via login</CardDescription>
                </div>
              </div>
              {instagramConnection && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {instagramLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando conexão...
              </div>
            ) : instagramConnection ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Conta conectada:</span>{" "}
                    <span className="font-medium">@{instagramConnection.instagram_username}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em: {instagramConnection.expires_at 
                      ? new Date(instagramConnection.expires_at).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchInstagramMetrics.mutate(clientId)}
                    disabled={fetchInstagramMetrics.isPending}
                  >
                    {fetchInstagramMetrics.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectInstagram.mutate(clientId)}
                    disabled={disconnectInstagram.isPending}
                  >
                    {disconnectInstagram.isPending ? (
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
                  Conecte sua conta Instagram Business para obter métricas automaticamente.
                  Requer uma conta Business conectada a uma Página do Facebook.
                </p>
                <Button
                  onClick={() => startInstagramOAuth.mutate(clientId)}
                  disabled={startInstagramOAuth.isPending}
                  className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90"
                >
                  {startInstagramOAuth.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Instagram className="h-4 w-4 mr-2" />
                  Conectar Instagram
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YouTube OAuth */}
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-600 flex items-center justify-center">
                  <Youtube className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">YouTube</CardTitle>
                  <CardDescription>Analytics e métricas via login</CardDescription>
                </div>
              </div>
              {youtubeConnection && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {youtubeLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando conexão...
              </div>
            ) : youtubeConnection ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Canal conectado:</span>{" "}
                    <span className="font-medium">{youtubeConnection.channel_title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em: {youtubeConnection.expires_at 
                      ? new Date(youtubeConnection.expires_at).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchYouTubeAnalytics.mutate(clientId)}
                    disabled={fetchYouTubeAnalytics.isPending}
                  >
                    {fetchYouTubeAnalytics.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectYouTube.mutate(clientId)}
                    disabled={disconnectYouTube.isPending}
                  >
                    {disconnectYouTube.isPending ? (
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
                  Conecte seu canal do YouTube para obter analytics e métricas de vídeos automaticamente.
                </p>
                <Button
                  onClick={() => startYouTubeOAuth.mutate(clientId)}
                  disabled={startYouTubeOAuth.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {startYouTubeOAuth.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Youtube className="h-4 w-4 mr-2" />
                  Conectar YouTube
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Twitter/X OAuth 2.0 */}
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center">
                  <Twitter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">X / Twitter</CardTitle>
                  <CardDescription>Publicação de tweets via OAuth 2.0</CardDescription>
                </div>
              </div>
              {twitterCredential?.is_valid && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {twitterCredential?.is_valid ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Conta conectada:</span>{" "}
                    <span className="font-medium">@{twitterCredential.account_name || 'Twitter'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conectado em: {twitterCredential.last_validated_at 
                      ? new Date(twitterCredential.last_validated_at).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => twitterOAuth.openPopup()}
                    disabled={twitterOAuth.isLoading}
                  >
                    {twitterOAuth.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reconectar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCredential.mutate('twitter')}
                    disabled={deleteCredential.isPending}
                  >
                    {deleteCredential.isPending ? (
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
                  Conecte sua conta X/Twitter para publicação automática de tweets. 
                  Você será redirecionado para autorizar o acesso.
                </p>
                <Button
                  onClick={() => twitterOAuth.openPopup()}
                  disabled={twitterOAuth.isLoading}
                  className="bg-black hover:bg-black/80"
                >
                  {twitterOAuth.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Twitter className="h-4 w-4 mr-2" />
                  Conectar com X
                </Button>
                
                {/* Show error if previous attempt failed */}
                {twitterCredential?.validation_error && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                    {twitterCredential.validation_error}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Section: API Key Connections (Advanced) - Collapsible */}
      <Collapsible open={showAdvancedTwitter} onOpenChange={setShowAdvancedTwitter}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
            <span className="text-sm font-medium">Conexão Avançada (API Keys manuais)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedTwitter ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">
            Use esta opção apenas se a conexão OAuth não funcionar ou se você precisa de tokens específicos.
          </p>
          
          {/* Twitter API Keys Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                  <Twitter className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm">Twitter API Keys</CardTitle>
                  <CardDescription className="text-xs">OAuth 1.0a (manual)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm space-y-2">
                <p className="font-medium text-amber-600 dark:text-amber-400 text-xs">⚠️ IMPORTANTE: Siga TODOS os passos</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Acesse <a href="https://developer.twitter.com/en/portal/projects-and-apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">Projects & Apps</a> e selecione seu app</li>
                  <li><strong>"User authentication settings"</strong> → <strong>"Read and write"</strong></li>
                  <li><strong>Type:</strong> "Web App, Automated App or Bot"</li>
                  <li><strong>Callback URI:</strong> <code className="bg-muted px-1 rounded text-[10px]">https://example.com/callback</code></li>
                  <li className="text-amber-600 dark:text-amber-400 font-medium">CRÍTICO: Regenere Access Token após mudar permissões!</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tw-api-key" className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      id="tw-api-key"
                      type={showSecrets['tw-api-key'] ? 'text' : 'password'}
                      value={twitterForm.apiKey}
                      onChange={(e) => setTwitterForm({ ...twitterForm, apiKey: e.target.value })}
                      placeholder="API Key"
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => toggleSecret('tw-api-key')}
                    >
                      {showSecrets['tw-api-key'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tw-api-secret" className="text-xs">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="tw-api-secret"
                      type={showSecrets['tw-api-secret'] ? 'text' : 'password'}
                      value={twitterForm.apiSecret}
                      onChange={(e) => setTwitterForm({ ...twitterForm, apiSecret: e.target.value })}
                      placeholder="API Secret"
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => toggleSecret('tw-api-secret')}
                    >
                      {showSecrets['tw-api-secret'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tw-access-token" className="text-xs">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="tw-access-token"
                      type={showSecrets['tw-access-token'] ? 'text' : 'password'}
                      value={twitterForm.accessToken}
                      onChange={(e) => setTwitterForm({ ...twitterForm, accessToken: e.target.value })}
                      placeholder="Access Token"
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => toggleSecret('tw-access-token')}
                    >
                      {showSecrets['tw-access-token'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tw-access-secret" className="text-xs">Access Token Secret</Label>
                  <div className="relative">
                    <Input
                      id="tw-access-secret"
                      type={showSecrets['tw-access-secret'] ? 'text' : 'password'}
                      value={twitterForm.accessTokenSecret}
                      onChange={(e) => setTwitterForm({ ...twitterForm, accessTokenSecret: e.target.value })}
                      placeholder="Access Token Secret"
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => toggleSecret('tw-access-secret')}
                    >
                      {showSecrets['tw-access-secret'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSaveTwitter}
                disabled={validateTwitter.isPending || !twitterForm.apiKey || !twitterForm.accessToken}
                size="sm"
              >
                {validateTwitter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar e Validar
              </Button>
            </CardContent>
          </Card>

        {/* LinkedIn Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#0A66C2] flex items-center justify-center">
                  <Linkedin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">LinkedIn</CardTitle>
                  <CardDescription>OAuth 2.0 para publicação de posts</CardDescription>
                </div>
              </div>
              {renderCredentialStatus(linkedInCredential)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedInCredential ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Conta conectada:</span>{" "}
                    <span className="font-medium">{linkedInCredential.account_name || 'Conta LinkedIn'}</span>
                  </p>
                  {linkedInCredential.validation_error && (
                    <p className="text-xs text-destructive mt-1">{linkedInCredential.validation_error}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Última validação: {linkedInCredential.last_validated_at 
                      ? new Date(linkedInCredential.last_validated_at).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteCredential.mutate('linkedin')}
                    disabled={deleteCredential.isPending}
                  >
                    {deleteCredential.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure o Access Token do LinkedIn. Você pode obter através da{" "}
                  <a 
                    href="https://www.linkedin.com/developers/apps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    LinkedIn Developer Platform
                  </a>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="li-access-token">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="li-access-token"
                      type={showSecrets['li-access-token'] ? 'text' : 'password'}
                      value={linkedinForm.oauthAccessToken}
                      onChange={(e) => setLinkedinForm({ oauthAccessToken: e.target.value })}
                      placeholder="Seu LinkedIn Access Token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecret('li-access-token')}
                    >
                      {showSecrets['li-access-token'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleSaveLinkedin}
                  disabled={validateLinkedIn.isPending || !linkedinForm.oauthAccessToken}
                >
                  {validateLinkedIn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar e Validar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
