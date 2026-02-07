import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { User, Sun, Moon, Palette, Key, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SecondaryLayout } from "@/components/SecondaryLayout";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SettingsNavigation, SettingsSection } from "@/components/settings/SettingsNavigation";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canManageTeam } = useWorkspace();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for name editing
  const [editedName, setEditedName] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  
  // State for password reset
  const [isSendingReset, setIsSendingReset] = useState(false);
  
  // State for account deletion
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  // Initialize section from URL tab parameter
  const tabParam = searchParams.get("tab");
  const validSections: SettingsSection[] = ["profile", "team", "notifications", "appearance"];
  const initialSection = validSections.includes(tabParam as SettingsSection) 
    ? (tabParam as SettingsSection) 
    : "profile";
  
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  
  // Sync URL changes to state (for back/forward navigation)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && validSections.includes(tab as SettingsSection)) {
      setActiveSection(tab as SettingsSection);
    }
  }, [searchParams]);
  
  // Handle section change - update both state and URL
  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    setSearchParams({ tab: section });
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

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "EXCLUIR") return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      
      if (error) throw error;
      
      toast({
        title: "Conta excluída",
        description: "Sua conta foi excluída com sucesso.",
      });
      
      await signOut();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir sua conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation("");
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
    switch (activeSection) {
      case "profile":
        return renderProfileSection();
      case "team":
        return <TeamManagement />;
      case "notifications":
        return renderNotificationsSection();
      case "appearance":
        return renderAppearanceSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <SecondaryLayout title="Configurações">
      <div className={cn("max-w-6xl mx-auto", isMobile ? "px-4 py-4" : "px-6 py-8")}>
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
    </SecondaryLayout>
  );
}
