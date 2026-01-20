import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { User, Sun, Moon, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { PlanBillingCard } from "@/components/settings/PlanBillingCard";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SettingsNavigation, SettingsSection } from "@/components/settings/SettingsNavigation";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function SettingsTab() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canManageTeam } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  
  // Initialize section from URL section parameter
  const sectionParam = searchParams.get("section");
  const validSections: SettingsSection[] = ["profile", "billing", "team", "appearance"];
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

  const renderProfileSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Perfil</CardTitle>
        </div>
        <CardDescription>Informações da sua conta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <AvatarUpload
            currentUrl={profile?.avatar_url}
            onUpload={(url) => updateAvatar.mutate(url)}
            fallback={user?.email?.slice(0, 2) || "U"}
            size="lg"
            bucket="client-files"
            folder="user-avatars"
          />
          <div className="flex-1 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Email</div>
            <div className="text-base">{user?.email || "Não disponível"}</div>
          </div>
        </div>
        <Separator />
        <div className="grid gap-2">
          <div className="text-sm font-medium text-muted-foreground">ID do Usuário</div>
          <div className="text-xs font-mono bg-muted/50 p-2 rounded">{user?.id || "Não disponível"}</div>
        </div>
      </CardContent>
    </Card>
  );

  const renderBillingSection = () => (
    <PlanBillingCard />
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="theme-toggle" className="text-base font-medium">
                Modo Escuro
              </Label>
              <p className="text-sm text-muted-foreground">
                Alternar entre tema claro e escuro
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
    switch (activeSection) {
      case "profile":
        return renderProfileSection();
      case "billing":
        return renderBillingSection();
      case "team":
        return <TeamManagement />;
      case "appearance":
        return renderAppearanceSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className={cn("max-w-6xl mx-auto h-full overflow-y-auto", isMobile ? "px-4 py-4" : "px-6 py-8")}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie sua conta e preferências</p>
      </div>
      
      <div className={cn("flex", isMobile ? "flex-col gap-4" : "gap-8")}>
        {/* Navigation */}
        <SettingsNavigation
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          showTeam={canManageTeam}
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
