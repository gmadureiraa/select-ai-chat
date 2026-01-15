import { useState } from "react";
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
import { SecondaryLayout } from "@/components/SecondaryLayout";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SettingsNavigation, SettingsSection } from "@/components/settings/SettingsNavigation";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canManageTeam } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  
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
    <SecondaryLayout title="Configurações">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Navigation */}
          <SettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            showTeam={canManageTeam}
          />
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}
