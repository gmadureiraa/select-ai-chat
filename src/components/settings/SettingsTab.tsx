import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { User, Sun, Moon, Palette, Key, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SettingsNavigation, SettingsSection } from "@/components/settings/SettingsNavigation";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// 2026-05-17 — sections grandes viraram lazy. SettingsTab inteiro era ~178kB
// porque eager-importava TUDO; agora só baixa a section que o user navegou.
// Profile/Notifications/Appearance ficam eager pq são o caso comum + pequenos.
// 2026-05-18 — removidos TeamManagement (substituído por WorkspaceMembersTab)
// e AuditLogSettings (feature descontinuada).
const Documentation = lazy(() => import("@/pages/Documentation"));
const AIUsageSettings = lazy(() =>
  import("@/components/settings/AIUsageSettings").then((m) => ({ default: m.AIUsageSettings })),
);
const WebhookSettings = lazy(() =>
  import("@/components/settings/WebhookSettings").then((m) => ({ default: m.WebhookSettings })),
);
const WorkspaceSettingsTab = lazy(() =>
  import("@/components/workspace/WorkspaceSettingsTab").then((m) => ({ default: m.WorkspaceSettingsTab })),
);
const WorkspaceMembersTab = lazy(() =>
  import("@/components/workspace/WorkspaceMembersTab").then((m) => ({ default: m.WorkspaceMembersTab })),
);
const IntegrationsSettings = lazy(() =>
  import("@/components/settings/IntegrationsSettings").then((m) => ({ default: m.IntegrationsSettings })),
);
const MCPDocsTab = lazy(() =>
  import("@/components/kai/MCPDocsTab").then((m) => ({ default: m.MCPDocsTab })),
);

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function SettingsTab() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canManageTeam, isOwner } = useWorkspace();
  const { isSuperAdmin } = useSuperAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // State for name editing
  const [editedName, setEditedName] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);

  // State for password reset
  const [isSendingReset, setIsSendingReset] = useState(false);


  // Initialize section from URL section parameter
  // 2026-05-18 — section aliases pra bookmarks antigos:
  // ?section=team → members | ?section=audit-log → members
  const sectionParamRaw = searchParams.get("section");
  const sectionParam =
    sectionParamRaw === "team" || sectionParamRaw === "audit-log"
      ? "members"
      : sectionParamRaw;
  const validSections: SettingsSection[] = [
    "profile",
    "workspace",
    "members",
    "notifications",
    "appearance",
    "integrations",
    "docs",
    "ai-usage",
    "webhooks",
    "mcp",
  ];
  const initialSection = validSections.includes(sectionParam as SettingsSection)
    ? (sectionParam as SettingsSection)
    : "profile";
  
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  
  // Sync URL changes to state (for back/forward navigation)
  useEffect(() => {
    const section = searchParams.get("section");
    if (section && validSections.includes(section as SettingsSection)) {
      setActiveSection(section as SettingsSection);
    }
  }, [searchParams]);
  
  // Handle section change - update both state and URL
  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    const params = new URLSearchParams(searchParams);
    params.set("section", section);
    setSearchParams(params);
  };
  
  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Reset editedName when profile loads
  useEffect(() => {
    if (profile?.full_name && editedName === null) {
      setEditedName(profile.full_name);
    }
  }, [profile?.full_name]);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (updates: { avatar_url?: string | null; full_name?: string }) => {
      if (!user?.id) throw new Error("User not found");
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });

  // Update profile avatar
  const updateAvatar = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      if (!user?.id) throw new Error("User not found");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a foto.",
        variant: "destructive",
      });
    },
  });

  // Handle name save
  const handleSaveName = async () => {
    if (!editedName?.trim()) return;
    
    setIsSavingName(true);
    try {
      await updateProfile.mutateAsync({ full_name: editedName.trim() });
      toast({
        title: "Nome atualizado",
        description: "Seu nome foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o nome.",
        variant: "destructive",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email de redefinição.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };


  const hasNameChanges = editedName !== null && editedName !== profile?.full_name;

  const renderProfileSection = () => (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Perfil</CardTitle>
          </div>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn(
            "flex gap-6",
            isMobile ? "flex-col items-center" : "items-start"
          )}>
            <AvatarUpload
              currentUrl={profile?.avatar_url}
              onUpload={(url) => updateAvatar.mutate(url)}
              fallback={user?.email?.slice(0, 2) || "U"}
              size="lg"
              bucket="client-files"
              folder="user-avatars"
            />
            <div className={cn("flex-1 space-y-4", isMobile && "w-full")}>
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className={cn("flex gap-2", isMobile && "flex-col")}>
                  <Input
                    id="name"
                    value={editedName ?? profile?.full_name ?? ""}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="flex-1"
                  />
                  {hasNameChanges && (
                    <Button onClick={handleSaveName} disabled={isSavingName} size="sm" className={cn(isMobile && "w-full")}>
                      {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Email Field */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
                  {user?.email || "Não disponível"}
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid gap-2">
            <Label className="text-muted-foreground">ID do Usuário</Label>
            <div className="text-xs font-mono bg-muted/50 p-2 rounded break-all">{user?.id || "Não disponível"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Segurança</CardTitle>
          </div>
          <CardDescription>Gerencie a segurança da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "flex gap-4",
            isMobile ? "flex-col" : "items-center justify-between"
          )}>
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Redefinir Senha</Label>
              <p className="text-sm text-muted-foreground">
                Enviaremos um link para redefinir sua senha por email
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handlePasswordReset}
              disabled={isSendingReset}
              className={cn(isMobile && "w-full")}
            >
              {isSendingReset ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Enviar link
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );


  const renderNotificationsSection = () => (
    <NotificationSettings />
  );

  const renderAppearanceSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Aparência</CardTitle>
        </div>
        <CardDescription>Personalize a aparência do aplicativo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <Label htmlFor="theme-toggle" className="text-base font-medium">
                Modo Escuro
              </Label>
              <p className="text-sm text-muted-foreground">
                {isMobile ? "Claro/Escuro" : "Alternar entre tema claro e escuro"}
              </p>
            </div>
          </div>
          <Switch
            id="theme-toggle"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderSectionContent = () => {
    // Wrap em Suspense pra cobrir as sections lazy (TeamManagement,
    // Documentation, AIUsageSettings, WebhookSettings, WorkspaceSettingsTab,
    // WorkspaceMembersTab, IntegrationsSettings, AuditLogSettings, MCPDocsTab).
    // Profile/Notifications/Appearance ficam eager e não precisam de fallback.
    const content = (() => {
      switch (activeSection) {
        case "profile":
          return renderProfileSection();
        case "workspace":
          return isOwner ? <WorkspaceSettingsTab /> : renderProfileSection();
        case "members":
          return canManageTeam ? <WorkspaceMembersTab /> : renderProfileSection();
        case "notifications":
          return renderNotificationsSection();
        case "appearance":
          return renderAppearanceSection();
        case "integrations":
          return <IntegrationsSettings />;
        case "docs":
          return <Documentation />;
        case "ai-usage":
          return <AIUsageSettings />;
        case "webhooks":
          return <WebhookSettings />;
        case "mcp":
          // MCP é workspace-wide (token único compartilhado).
          // Movido pra cá em 2026-05-09 — antes vivia como item solto no
          // footer da sidebar principal. Faz mais sentido em Sistema porque
          // configura como o Claude Code se conecta ao backend Kaleidos.
          return <MCPDocsTab />;
        default:
          return renderProfileSection();
      }
    })();

    return <Suspense fallback={<SectionSkeleton />}>{content}</Suspense>;
  };

  return (
    <div className={cn("max-w-6xl mx-auto h-full overflow-y-auto", isMobile ? "px-4 py-4" : "px-6 py-8")}>
      <div className="mb-6">
        <span className="kai-eyebrow mb-1.5 inline-block">CONTA · CONFIGURAÇÕES</span>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie sua conta e preferências</p>
      </div>
      
      <div className={cn("flex", isMobile ? "flex-col gap-4" : "gap-8")}>
        {/* Navigation */}
        <SettingsNavigation
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          showWorkspace={isOwner}
          showMembers={canManageTeam}
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
