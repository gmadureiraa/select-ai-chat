import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  Check,
  X,
  Crown,
  AlertTriangle,
  Code2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * WorkspaceSettingsTab — gerencia metadados do workspace.
 *
 * Permite ao owner editar nome, slug e logo, ver plan_type e dono,
 * além de editar `settings` (JSON livre) em modo avançado. RLS garante
 * que só o owner consegue de fato persistir alterações.
 */
export function WorkspaceSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { workspace, isOwner, isLoadingWorkspace } = useWorkspace();

  const workspaceId = workspace?.id ?? null;

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [settingsJson, setSettingsJson] = useState<string>("{}");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Slug validation
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Fetch full workspace details (settings is in workspace context already, but
  // we want updated_at + plan + owner info, so re-fetch directly).
  const { data: workspaceDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["workspace-settings-detail", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Fetch owner profile
  const { data: ownerProfile } = useQuery({
    queryKey: ["workspace-owner-profile", workspaceDetails?.owner_id],
    queryFn: async () => {
      if (!workspaceDetails?.owner_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", workspaceDetails.owner_id)
        .maybeSingle();
      return data;
    },
    enabled: !!workspaceDetails?.owner_id,
  });

  // Fetch subscription (for plan_type display)
  const { data: subscription } = useQuery({
    queryKey: ["workspace-settings-subscription", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data } = await supabase
        .from("workspace_subscriptions")
        .select(
          `
          status,
          current_period_end,
          subscription_plans ( name, type )
        `,
        )
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return data;
    },
    enabled: !!workspaceId,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (!workspaceDetails) return;
    setName(workspaceDetails.name ?? "");
    setSlug(workspaceDetails.slug ?? "");
    setLogoUrl(workspaceDetails.logo_url ?? null);
    setSettingsJson(
      JSON.stringify(workspaceDetails.settings ?? {}, null, 2),
    );
  }, [workspaceDetails?.id]);

  // Slug availability check (only when changed and != current)
  useEffect(() => {
    if (!slug || slug.length < 3 || slug === workspaceDetails?.slug) {
      setSlugAvailable(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setIsCheckingSlug(true);
      try {
        const { data } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!cancelled) setSlugAvailable(!data);
      } catch {
        if (!cancelled) setSlugAvailable(null);
      } finally {
        if (!cancelled) setIsCheckingSlug(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug, workspaceDetails?.slug]);

  // Mutation: save workspace
  const updateWorkspace = useMutation({
    mutationFn: async (updates: {
      name: string;
      slug: string | null;
      logo_url: string | null;
      settings: Record<string, unknown>;
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("workspaces")
        .update({
          name: updates.name,
          slug: updates.slug,
          logo_url: updates.logo_url,
          // Cast: Supabase Json type is recursive — TS can't widen
          // Record<string, unknown> automatically.
          settings: updates.settings as never,
        })
        .eq("id", workspaceId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-settings-detail"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
      toast({
        title: "Workspace atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!isOwner) return;
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Defina um nome para o workspace.",
        variant: "destructive",
      });
      return;
    }
    if (slug && slug !== workspaceDetails?.slug && slugAvailable === false) {
      toast({
        title: "Slug indisponível",
        description: "Escolha outra URL para o workspace.",
        variant: "destructive",
      });
      return;
    }
    let parsedSettings: Record<string, unknown> = {};
    try {
      parsedSettings = JSON.parse(settingsJson || "{}");
      if (typeof parsedSettings !== "object" || Array.isArray(parsedSettings)) {
        throw new Error("Settings precisa ser um objeto JSON.");
      }
    } catch (e) {
      toast({
        title: "JSON inválido",
        description: e instanceof Error ? e.message : "Verifique o formato.",
        variant: "destructive",
      });
      return;
    }

    updateWorkspace.mutate({
      name: name.trim(),
      slug: slug.trim() || null,
      logo_url: logoUrl,
      settings: parsedSettings,
    });
  };

  const hasChanges =
    !!workspaceDetails &&
    (name !== (workspaceDetails.name ?? "") ||
      slug !== (workspaceDetails.slug ?? "") ||
      logoUrl !== (workspaceDetails.logo_url ?? null) ||
      settingsJson !==
        JSON.stringify(workspaceDetails.settings ?? {}, null, 2));

  if (isLoadingWorkspace || isLoadingDetails) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Nenhum workspace encontrado.
      </div>
    );
  }

  // Non-owners get read-only view
  const readOnly = !isOwner;
  const planLabel =
    (subscription?.subscription_plans as { name?: string; type?: string } | null)
      ?.name ||
    (subscription?.subscription_plans as { name?: string; type?: string } | null)
      ?.type ||
    "free";

  return (
    <div
      className={cn(
        "max-w-4xl mx-auto h-full overflow-y-auto",
        isMobile ? "px-4 py-4" : "px-6 py-8",
      )}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          Workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurações gerais do workspace
        </p>
      </div>

      {readOnly && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            Apenas o proprietário pode editar essas configurações.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* Identity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>
              Nome, URL e logo do workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={cn(
                "flex gap-6",
                isMobile ? "flex-col items-center" : "items-start",
              )}
            >
              <AvatarUpload
                currentUrl={logoUrl}
                onUpload={(url) => setLogoUrl(url)}
                fallback={name?.slice(0, 2) || "WS"}
                size="lg"
                bucket="client-files"
                folder="workspace-logos"
              />
              <div className={cn("flex-1 space-y-4", isMobile && "w-full")}>
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Nome do Workspace</Label>
                  <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Minha Agência"
                    disabled={readOnly}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ws-slug">URL do Workspace</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">
                      app.kaleidos.ai/
                    </span>
                    <div className="flex-1 relative">
                      <Input
                        id="ws-slug"
                        value={slug}
                        onChange={(e) =>
                          setSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          )
                        }
                        placeholder="minha-agencia"
                        disabled={readOnly}
                        className={cn(
                          "pr-8",
                          slugAvailable === true && "border-green-500",
                          slugAvailable === false && "border-destructive",
                        )}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {isCheckingSlug && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingSlug && slugAvailable === true && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {!isCheckingSlug && slugAvailable === false && (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  </div>
                  {slugAvailable === false && (
                    <p className="text-xs text-destructive">
                      Esta URL já está em uso
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan + Owner Card */}
        <Card>
          <CardHeader>
            <CardTitle>Conta</CardTitle>
            <CardDescription>
              Plano e proprietário do workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-muted-foreground">Plano</Label>
                <div className="mt-1">
                  <Badge variant="outline" className="capitalize">
                    {planLabel}
                  </Badge>
                  {subscription?.status && (
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      {subscription.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-muted-foreground">Proprietário</Label>
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Crown className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {ownerProfile?.full_name ||
                      ownerProfile?.email ||
                      "Proprietário"}
                    {ownerProfile?.id === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (você)
                      </span>
                    )}
                  </div>
                  {ownerProfile?.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {ownerProfile.email}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">ID do Workspace</Label>
              <div className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                {workspace.id}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings (JSON) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-muted-foreground" />
                  Configurações avançadas
                </CardTitle>
                <CardDescription>
                  JSON livre para flags e preferências
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Esconder" : "Mostrar"}
              </Button>
            </div>
          </CardHeader>
          {showAdvanced && (
            <CardContent>
              <Label htmlFor="ws-settings" className="text-xs text-muted-foreground">
                Edite com cuidado. Precisa ser um objeto JSON válido.
              </Label>
              <Textarea
                id="ws-settings"
                value={settingsJson}
                onChange={(e) => setSettingsJson(e.target.value)}
                rows={10}
                className="font-mono text-xs mt-2"
                disabled={readOnly}
                spellCheck={false}
              />
            </CardContent>
          )}
        </Card>

        {/* Save bar */}
        {!readOnly && (
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/80 backdrop-blur border-t flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground mr-auto">
              {hasChanges ? "Alterações não salvas" : "Sem alterações"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasChanges || updateWorkspace.isPending}
              onClick={() => {
                if (!workspaceDetails) return;
                setName(workspaceDetails.name ?? "");
                setSlug(workspaceDetails.slug ?? "");
                setLogoUrl(workspaceDetails.logo_url ?? null);
                setSettingsJson(
                  JSON.stringify(workspaceDetails.settings ?? {}, null, 2),
                );
              }}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                !hasChanges ||
                updateWorkspace.isPending ||
                (slug !== workspaceDetails?.slug && slugAvailable === false)
              }
            >
              {updateWorkspace.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkspaceSettingsTab;
