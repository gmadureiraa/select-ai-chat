import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Globe, Instagram, Twitter,
  Linkedin, Youtube, Megaphone, Check,
  Building, MessageSquare, Users, Target, FileText,
  BarChart3, RefreshCw,
  LayoutGrid
} from "lucide-react";
import { ClientEditNavigation, type ClientEditSection } from "./ClientEditNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useImportClientSocialContent } from "@/hooks/useImportClientSocialContent";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { SocialIntegrationsPanel } from "./SocialIntegrationsPanel";
import { ClientReferencesManager } from "./ClientReferencesManager";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { AIContextTab } from "./AIContextTab";
import { ClientAnalyticsTab } from "./ClientAnalyticsTab";
import { ClientViralSettingsTab } from "./ClientViralSettingsTab";
import { ClientMCPTab } from "./ClientMCPTab";
import { ClientNotificationsTab } from "./ClientNotificationsTab";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientContext } from "@/hooks/useClientContext";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";

interface ClientEditTabsSimplifiedProps {
  client: Client;
  onClose: () => void;
}

const socialMediaFields = [
  { key: "website", label: "Website", icon: Globe, placeholder: "https://..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
  { key: "threads", label: "Threads", icon: Megaphone, placeholder: "@usuario" },
];

const clientEditSections: ClientEditSection[] = [
  "profile",
  "digital",
  "ai-context",
  "references",
  "integrations",
  "viral",
  "analytics",
  "notifications",
  "mcp",
];

function getUrlSection(value: string | null): ClientEditSection {
  return clientEditSections.includes(value as ClientEditSection)
    ? (value as ClientEditSection)
    : "profile";
}

export function ClientEditTabsSimplified({ client, onClose }: ClientEditTabsSimplifiedProps) {
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.avatar_url || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  const [identityGuide, setIdentityGuide] = useState(client.identity_guide || "");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  // 2026-05-10 — 9 tabs horizontais viraram sidebar com 3 grupos. Default
  // 'profile' (Identidade · Sobre).
  const [activeSection, setActiveSection] = useState<ClientEditSection>(() =>
    getUrlSection(searchParams.get("section")),
  );

  const handleSectionChange = (section: ClientEditSection) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set("section", section);
    setSearchParams(next, { replace: true });
  };

  const [socialMedia, setSocialMedia] = useState<Record<string, string>>(
    client.social_media as Record<string, string> || {}
  );
  const [tags, setTags] = useState<Record<string, string>>(
    client.tags as Record<string, string> || {}
  );

  const { updateClient } = useClients();
  // useClientWebsites é executado pra preservar invalidação de cache
  // (efeitos colaterais do hook), mesmo sem usar o retorno.
  useClientWebsites(client.id);
  const { documents } = useClientDocuments(client.id);
  const { data: ctx } = useClientContext(client.id);
  const { toast } = useToast();

  useEffect(() => {
    const nextSection = getUrlSection(searchParams.get("section"));
    setActiveSection((current) => (current === nextSection ? current : nextSection));
  }, [searchParams]);

  // ──────────────────────────────────────────────────────────────────
  // Completeness score — feedback visual de quão "pronto" o cliente
  // está pra ser usado nos geradores virais. Cada bool conta 1 ponto;
  // peso igual pra simplicidade. Agrupado por tab pra mostrar badge
  // "Faltando" inline em cada trigger.
  // ──────────────────────────────────────────────────────────────────
  const refsCount = ctx?.referenceLibrary?.length ?? 0;
  const visualRefsCount = ctx?.visualReferences?.length ?? 0;
  const hasVoiceProfile = !!(ctx?.tone || ctx?.client?.voice_profile);
  const hasIdentityGuide = !!(identityGuide && identityGuide.trim());

  const tabCompletion = useMemo(() => {
    const profileFields = [
      !!description.trim(),
      !!tags.segment,
      !!tags.tone,
      !!tags.audience,
      !!tags.objectives,
    ];
    const digitalFields = [
      !!socialMedia.website,
      !!socialMedia.instagram,
      !!socialMedia.linkedin || !!socialMedia.twitter || !!socialMedia.youtube,
    ];
    const referencesFields = [
      documents.length > 0,
      refsCount > 0,
      visualRefsCount > 0,
    ];
    const aiContextFields = [hasIdentityGuide, hasVoiceProfile];

    return {
      profile: {
        done: profileFields.filter(Boolean).length,
        total: profileFields.length,
      },
      digital: {
        done: digitalFields.filter(Boolean).length,
        total: digitalFields.length,
      },
      references: {
        done: referencesFields.filter(Boolean).length,
        total: referencesFields.length,
      },
      aiContext: {
        done: aiContextFields.filter(Boolean).length,
        total: aiContextFields.length,
      },
    };
  }, [
    description,
    tags,
    socialMedia,
    documents.length,
    refsCount,
    visualRefsCount,
    hasIdentityGuide,
    hasVoiceProfile,
  ]);

  const overallCompletion = useMemo(() => {
    const totals = Object.values(tabCompletion).reduce(
      (acc, t) => ({ done: acc.done + t.done, total: acc.total + t.total }),
      { done: 0, total: 0 },
    );
    return totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100);
  }, [tabCompletion]);

  // Serializa o form como string estável pra debounce — evita loop de
  // re-render por nova ref de objeto a cada render.
  const formSignature = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        avatarUrl,
        socialMedia,
        tags,
      }),
    [name, description, avatarUrl, socialMedia, tags],
  );
  const debouncedSignature = useDebounce(formSignature, 2000);

  // Auto-save effect — dispara apenas quando a assinatura debounced muda
  // E há alterações pendentes.
  useEffect(() => {
    if (!hasChanges || !client) return;
    let cancelled = false;
    const autoSave = async () => {
      setAutoSaveStatus("saving");
      try {
        await updateClient.mutateAsync({
          id: client.id,
          name,
          description: description || null,
          avatar_url: avatarUrl,
          social_media: socialMedia,
          tags,
        });
        if (cancelled) return;
        setAutoSaveStatus("saved");
        setHasChanges(false);
        setTimeout(() => {
          if (!cancelled) setAutoSaveStatus("idle");
        }, 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        if (!cancelled) setAutoSaveStatus("idle");
      }
    };
    autoSave();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSignature]);

  const markChanged = () => setHasChanges(true);

  const handleContextUpdate = (newContext: string) => {
    setIdentityGuide(newContext);
  };

  return (
    <div className="space-y-6">
      {/* Header with avatar and name - Enhanced */}
      <div className="flex items-start gap-6 pb-6 border-b border-border/50">
        <div className="relative">
          <AvatarUpload
            currentUrl={avatarUrl}
            onUpload={(url) => { setAvatarUrl(url); markChanged(); }}
            fallback={name.charAt(0) || "C"}
            size="lg"
            bucket="client-files"
            folder="client-avatars"
          />
          {/* Auto-save indicator on avatar */}
          {autoSaveStatus === "saving" && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            </div>
          )}
          {autoSaveStatus === "saved" && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); markChanged(); }}
            className="text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
            placeholder="Nome do cliente"
          />
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description || "Adicione uma descrição para este cliente..."}
          </p>

          {/* Completeness bar — feedback visual de "perfil pronto pra
              gerar conteúdo". Reage a campos preenchidos em todas as tabs. */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[280px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overallCompletion >= 80
                    ? "bg-emerald-500"
                    : overallCompletion >= 40
                      ? "bg-amber-500"
                      : "bg-destructive/60",
                )}
                style={{ width: `${overallCompletion}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {overallCompletion}% completo
            </span>
          </div>
        </div>

        {/* Quick actions — atalhos pros 3 apps virais sem precisar fechar
            o dialog primeiro. Mantém o dialog aberto pra preservar contexto;
            usuário fecha quando quiser. */}
        <TooltipProvider delayDuration={200}>
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    onClose();
                    navigate(`/kaleidos?tab=viral-carrossel&client=${client.id}`);
                  }}
                  aria-label="Criar carrossel"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar carrossel</TooltipContent>
            </Tooltip>
            {/* 2026-05-16: shortcuts Reels Viral e Radar Viral removidos
                (saíram do KAI; apps standalone em reels/radar.kaleidos.com.br) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    onClose();
                    navigate(`/kaleidos?tab=performance&client=${client.id}`);
                  }}
                  aria-label="Métricas"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Performance</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 2026-05-10 — 9 tabs horizontais (que estouravam o overflow) viraram
          sidebar com 3 grupos. Espelha o pattern de SettingsTab/SettingsNavigation:
            Identidade            → Sobre, Redes, Contexto IA
            Conteúdo              → Referências, Integrações
            Performance & Configs → Viral, Analytics, Notificações, MCP
          Mobile mantém UX boa via chips horizontais com scroll. */}
      <div className={cn("flex", isMobile ? "flex-col gap-4" : "gap-6")}>
        <ClientEditNavigation
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          completion={{
            profile: tabCompletion.profile,
            digital: tabCompletion.digital,
            references: tabCompletion.references,
            "ai-context": tabCompletion.aiContext,
          }}
        />

        {/* Section content — só renderiza a active pra evitar montar
            componentes pesados (AIContextTab, ClientAnalyticsTab) que não
            estão sendo vistos. Cada section continua com `space-y-4`. */}
        <div className="flex-1 min-w-0 space-y-4">
          {activeSection === "profile" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sobre o Cliente</CardTitle>
                <CardDescription>
                  Descrição, segmento, tom de voz, público e objetivos. Base que
                  vai pros prompts dos geradores virais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-description">Descrição</Label>
                  <Textarea
                    id="client-description"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); markChanged(); }}
                    placeholder="Breve descrição do cliente e seu negócio..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-segment" className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Segmento
                    </Label>
                    <Input
                      id="client-segment"
                      value={tags.segment || ""}
                      onChange={(e) => { setTags({ ...tags, segment: e.target.value }); markChanged(); }}
                      placeholder="Ex: E-commerce, SaaS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-tone" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Tom de Voz
                    </Label>
                    <Input
                      id="client-tone"
                      value={tags.tone || ""}
                      onChange={(e) => { setTags({ ...tags, tone: e.target.value }); markChanged(); }}
                      placeholder="Ex: Profissional, Descontraído"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-audience" className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Público-Alvo
                  </Label>
                  <Textarea
                    id="client-audience"
                    value={tags.audience || ""}
                    onChange={(e) => { setTags({ ...tags, audience: e.target.value }); markChanged(); }}
                    placeholder="Descreva o público principal..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-objectives" className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Objetivos
                  </Label>
                  <Textarea
                    id="client-objectives"
                    value={tags.objectives || ""}
                    onChange={(e) => { setTags({ ...tags, objectives: e.target.value }); markChanged(); }}
                    placeholder="Principais metas e objetivos..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "digital" && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Redes Sociais</CardTitle>
                  <CardDescription>Links para as redes sociais do cliente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {socialMediaFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                      <field.icon
                        className="h-4 w-4 text-muted-foreground flex-shrink-0"
                        aria-hidden="true"
                      />
                      <Input
                        aria-label={field.label}
                        value={socialMedia[field.key] || ""}
                        onChange={(e) => {
                          setSocialMedia({ ...socialMedia, [field.key]: e.target.value });
                          markChanged();
                        }}
                        placeholder={field.placeholder}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <ImportSocialPostsCard clientId={client.id} />
            </>
          )}

          {activeSection === "ai-context" && (
            <AIContextTab
              clientId={client.id}
              identityGuide={identityGuide}
              clientUpdatedAt={client.updated_at}
              onContextUpdate={handleContextUpdate}
            />
          )}

          {activeSection === "references" && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Documentos
                  </CardTitle>
                  <CardDescription>PDFs, apresentações e documentos do cliente</CardDescription>
                </CardHeader>
                <CardContent>
                  <ClientDocumentsManager clientId={client.id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Referências de Conteúdo
                  </CardTitle>
                  <CardDescription>Links, textos e inspirações para criação</CardDescription>
                </CardHeader>
                <CardContent>
                  <ClientReferencesManager clientId={client.id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Referências Visuais
                  </CardTitle>
                  <CardDescription>Imagens de inspiração visual e identidade</CardDescription>
                </CardHeader>
                <CardContent>
                  <VisualReferencesManager clientId={client.id} />
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "integrations" && (
            <>
              {/* Painel novo (resumo + conectar nova) */}
              <SocialIntegrationsPanel clientId={client.id} />
              {/* Cards detalhados legacy (todas plataformas, com descrições) */}
              <SocialIntegrationsTab clientId={client.id} />
            </>
          )}

          {activeSection === "viral" && (
            <ClientViralSettingsTab clientId={client.id} clientName={name || null} />
          )}

          {activeSection === "analytics" && (
            <ClientAnalyticsTab clientId={client.id} />
          )}

          {activeSection === "notifications" && (
            <ClientNotificationsTab clientId={client.id} clientName={name} />
          )}

          {activeSection === "mcp" && (
            <ClientMCPTab clientId={client.id} clientName={name} />
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

// 2026-05-10 — TabCompletionDot removido daqui. O indicador equivalente
// (verde/âmbar/vermelho com done/total) agora vive em ClientEditNavigation,
// renderizado pra cada item da sidebar via prop `completion`.

function ImportSocialPostsCard({ clientId }: { clientId: string }) {
  const importer = useImportClientSocialContent();
  const last = importer.data;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          Importar posts pra biblioteca
        </CardTitle>
        <CardDescription>
          Puxa os últimos 30 posts dos handles cadastrados (Instagram, TikTok,
          Twitter, Threads, LinkedIn) e salva em conteúdo do cliente.
          Idempotente — roda quantas vezes quiser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={() => importer.mutate({ clientId, postsPerPlatform: 30 })}
          disabled={importer.isPending}
          className="gap-2"
        >
          {importer.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando... pode levar 1-3 min
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Importar agora
            </>
          )}
        </Button>

        {last && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <div className="font-medium text-foreground">
              Última execução: {last.totals.inserted} novos · {last.totals.scraped} encontrados · {last.totals.skipped} já existiam
            </div>
            <ul className="space-y-0.5">
              {last.results.map((r) => (
                <li key={r.platform}>
                  <span className="font-mono uppercase">{r.platform}</span>{" "}
                  {r.error ? (
                    <span className="text-destructive">— {r.error}</span>
                  ) : (
                    <>
                      {r.handle ? `@${r.handle}` : "(sem handle)"}: {r.inserted} novos
                      {r.skipped > 0 ? ` (${r.skipped} ignorados)` : ""}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
