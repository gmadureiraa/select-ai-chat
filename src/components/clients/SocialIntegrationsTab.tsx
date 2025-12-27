import { useState, useEffect } from "react";
import { Twitter, Linkedin, Loader2, Check, Eye, EyeOff, Trash2, Share2, X, Instagram, Youtube, RefreshCw } from "lucide-react";
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
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

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
      </div>

      <Separator />

      {/* Section: API Key Connections (Advanced) */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Conexão Avançada (API Keys)</h4>

        {/* Twitter/X Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center">
                  <Twitter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Twitter / X</CardTitle>
                  <CardDescription>OAuth 1.0a para publicação de tweets</CardDescription>
                </div>
              </div>
              {renderCredentialStatus(twitterCredential)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {twitterCredential ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Conta conectada:</span>{" "}
                    <span className="font-medium">{twitterCredential.account_name || 'Conta Twitter'}</span>
                  </p>
                  {twitterCredential.validation_error && (
                    <p className="text-xs text-destructive mt-1">{twitterCredential.validation_error}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Última validação: {twitterCredential.last_validated_at 
                      ? new Date(twitterCredential.last_validated_at).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure as credenciais da Twitter API v2. Você pode obter essas chaves no{" "}
                  <a 
                    href="https://developer.twitter.com/en/portal/dashboard" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Twitter Developer Portal
                  </a>.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tw-api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="tw-api-key"
                        type={showSecrets['tw-api-key'] ? 'text' : 'password'}
                        value={twitterForm.apiKey}
                        onChange={(e) => setTwitterForm({ ...twitterForm, apiKey: e.target.value })}
                        placeholder="Sua API Key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleSecret('tw-api-key')}
                      >
                        {showSecrets['tw-api-key'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tw-api-secret">API Secret</Label>
                    <div className="relative">
                      <Input
                        id="tw-api-secret"
                        type={showSecrets['tw-api-secret'] ? 'text' : 'password'}
                        value={twitterForm.apiSecret}
                        onChange={(e) => setTwitterForm({ ...twitterForm, apiSecret: e.target.value })}
                        placeholder="Sua API Secret"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleSecret('tw-api-secret')}
                      >
                        {showSecrets['tw-api-secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tw-access-token">Access Token</Label>
                    <div className="relative">
                      <Input
                        id="tw-access-token"
                        type={showSecrets['tw-access-token'] ? 'text' : 'password'}
                        value={twitterForm.accessToken}
                        onChange={(e) => setTwitterForm({ ...twitterForm, accessToken: e.target.value })}
                        placeholder="Seu Access Token"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleSecret('tw-access-token')}
                      >
                        {showSecrets['tw-access-token'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tw-access-secret">Access Token Secret</Label>
                    <div className="relative">
                      <Input
                        id="tw-access-secret"
                        type={showSecrets['tw-access-secret'] ? 'text' : 'password'}
                        value={twitterForm.accessTokenSecret}
                        onChange={(e) => setTwitterForm({ ...twitterForm, accessTokenSecret: e.target.value })}
                        placeholder="Seu Access Token Secret"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleSecret('tw-access-secret')}
                      >
                        {showSecrets['tw-access-secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleSaveTwitter}
                  disabled={validateTwitter.isPending || !twitterForm.apiKey || !twitterForm.accessToken}
                >
                  {validateTwitter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar e Validar
                </Button>
              </div>
            )}
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
      </div>
    </div>
  );
}
