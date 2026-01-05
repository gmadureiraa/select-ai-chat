import { useState, useEffect } from "react";
import { Twitter, Linkedin, Loader2, Check, Eye, EyeOff, Trash2, Share2, X, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocialCredentials, SocialCredential } from "@/hooks/useSocialCredentials";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { EnterpriseLockScreen } from "@/components/shared/EnterpriseLockScreen";
import { useTwitterOAuthPopup } from "@/hooks/useTwitterOAuth";
import { useLinkedInOAuthPopup } from "@/hooks/useLinkedInOAuth";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  // Twitter OAuth 2.0
  const twitterOAuth = useTwitterOAuthPopup(clientId);
  
  // LinkedIn OAuth 2.0
  const linkedInOAuth = useLinkedInOAuthPopup(clientId);
  
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
    const linkedInOAuthStatus = searchParams.get('linkedin_oauth');
    const message = searchParams.get('message');

    if (linkedInOAuthStatus === 'success') {
      toast({
        title: "LinkedIn conectado!",
        description: "Sua conta LinkedIn foi conectada com sucesso.",
      });
      searchParams.delete('linkedin_oauth');
      searchParams.delete('message');
      setSearchParams(searchParams);
    } else if (linkedInOAuthStatus === 'error') {
      toast({
        title: "Erro ao conectar LinkedIn",
        description: message || "Ocorreu um erro ao conectar sua conta.",
        variant: "destructive",
      });
      searchParams.delete('linkedin_oauth');
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
          Conecte suas redes sociais para publicação automática
        </p>
      </div>

      {/* Section: OAuth Connections (Easy) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Conexão Simples (OAuth)</h4>
          <Badge variant="secondary" className="text-xs">Recomendado</Badge>
        </div>

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
                
                {twitterCredential?.validation_error && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                    {twitterCredential.validation_error}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LinkedIn OAuth */}
        <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#0A66C2] flex items-center justify-center">
                  <Linkedin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">LinkedIn</CardTitle>
                  <CardDescription>Publicação via OAuth 2.0</CardDescription>
                </div>
              </div>
              {linkedInCredential?.is_valid && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {linkedInCredential?.is_valid ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Conta conectada:</span>{" "}
                    <span className="font-medium">{linkedInCredential.account_name || 'LinkedIn User'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conectado em: {linkedInCredential.last_validated_at 
                      ? new Date(linkedInCredential.last_validated_at).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => linkedInOAuth.openPopup()}
                    disabled={linkedInOAuth.isLoading}
                  >
                    {linkedInOAuth.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reconectar
                  </Button>
                  <Button
                    variant="ghost"
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
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta LinkedIn para publicar posts automaticamente.
                </p>
                <Button
                  onClick={() => linkedInOAuth.openPopup()}
                  disabled={linkedInOAuth.isLoading}
                  className="bg-[#0A66C2] hover:bg-[#0A66C2]/90"
                >
                  {linkedInOAuth.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Linkedin className="h-4 w-4 mr-2" />
                  Conectar LinkedIn
                </Button>
                
                {linkedInCredential?.validation_error && (
                  <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                    {linkedInCredential.validation_error}
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
              >
                {validateTwitter.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar e Validar
              </Button>
            </CardContent>
          </Card>

          {/* LinkedIn Access Token Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#0A66C2] flex items-center justify-center">
                  <Linkedin className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm">LinkedIn Access Token</CardTitle>
                  <CardDescription className="text-xs">Token manual (avançado)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkedInCredential?.is_valid ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Token configurado</p>
                      <p className="text-xs text-muted-foreground">
                        {linkedInCredential.account_name || 'LinkedIn User'}
                      </p>
                    </div>
                    {renderCredentialStatus(linkedInCredential)}
                  </div>
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
                    Remover Token
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="li-token" className="text-xs">Access Token</Label>
                    <div className="relative">
                      <Input
                        id="li-token"
                        type={showSecrets['li-token'] ? 'text' : 'password'}
                        value={linkedinForm.oauthAccessToken}
                        onChange={(e) => setLinkedinForm({ ...linkedinForm, oauthAccessToken: e.target.value })}
                        placeholder="Access Token do LinkedIn"
                        className="text-xs h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-2"
                        onClick={() => toggleSecret('li-token')}
                      >
                        {showSecrets['li-token'] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
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
