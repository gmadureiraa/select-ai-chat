import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AvatarUpload } from "@/components/ui/avatar-upload";
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
import { User, Key, Trash2, Mail, Loader2, Check, Save, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AccountSettingsSection() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [editedName, setEditedName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-account", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, email")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (updates: { full_name?: string; avatar_url?: string | null }) => {
      if (!user?.id) throw new Error("Usuário não encontrado");
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-account"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-hero"] });
      toast({
        title: "Perfil atualizado",
        description: "Suas alterações foram salvas com sucesso.",
      });
      setEditedName(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    },
  });

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      
      if (error) throw error;
      
      setPasswordResetSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email de redefinição.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveName = async () => {
    if (editedName === null || editedName === profile?.full_name) return;
    setIsSaving(true);
    await updateProfile.mutateAsync({ full_name: editedName });
    setIsSaving(false);
  };

  const handleAvatarUpload = (url: string | null) => {
    updateProfile.mutate({ avatar_url: url });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail !== user?.email) {
      toast({
        title: "Email incorreto",
        description: "O email digitado não corresponde ao seu email de cadastro.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmEmail: deleteConfirmEmail },
      });

      if (error) throw error;

      toast({
        title: "Conta excluída",
        description: "Sua conta foi excluída com sucesso. Você será redirecionado.",
      });

      // Sign out and redirect
      await signOut();
      navigate("/login");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Erro ao excluir conta",
        description: error.message || "Não foi possível excluir sua conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmEmail("");
    }
  };

  const currentName = editedName !== null ? editedName : (profile?.full_name || "");
  const hasNameChanges = editedName !== null && editedName !== profile?.full_name;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da Conta</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências de segurança</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Perfil</CardTitle>
          </div>
          <CardDescription>Atualize suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <AvatarUpload
              currentUrl={profile?.avatar_url}
              onUpload={handleAvatarUpload}
              fallback={currentName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
              size="lg"
              bucket="client-files"
              folder="user-avatars"
            />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Foto de perfil</p>
              <p className="text-xs text-muted-foreground/70">Clique na imagem para alterar</p>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={currentName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Seu nome completo"
                className="flex-1"
              />
              {hasNameChanges && (
                <Button onClick={handleSaveName} disabled={isSaving} size="sm">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="flex-1 bg-muted/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">O email de login não pode ser alterado</p>
          </div>

          {/* User ID */}
          <div className="space-y-2">
            <Label>ID do Usuário</Label>
            <div className="text-xs font-mono bg-muted/50 p-2 rounded text-muted-foreground">
              {user?.id || "Não disponível"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Segurança</CardTitle>
          </div>
          <CardDescription>Gerencie sua senha e segurança da conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Alterar senha</p>
              <p className="text-sm text-muted-foreground">
                Enviaremos um link para redefinir sua senha
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handlePasswordReset}
              disabled={isResettingPassword || passwordResetSent}
            >
              {isResettingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : passwordResetSent ? (
                <Check className="h-4 w-4 mr-2 text-emerald-500" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {passwordResetSent ? "Email enviado" : "Enviar link"}
            </Button>
          </div>

          {passwordResetSent && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                ✓ Email de redefinição enviado para <strong>{user?.email}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          </div>
          <CardDescription>Ações irreversíveis que afetam sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Excluir conta</p>
              <p className="text-sm text-muted-foreground">
                Esta ação é permanente e não pode ser desfeita
              </p>
            </div>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Você tem certeza absoluta?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>Esta ação é <strong>irreversível</strong>. Ao excluir sua conta:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Todos os seus dados pessoais serão removidos</li>
                      <li>Você perderá acesso a todos os workspaces</li>
                      <li>Todo conteúdo criado por você será desvinculado</li>
                      <li>Sua assinatura será cancelada imediatamente</li>
                    </ul>
                    <div className="pt-3 space-y-2">
                      <Label htmlFor="confirm-email" className="text-foreground font-medium">
                        Para confirmar, digite seu email: <strong>{user?.email}</strong>
                      </Label>
                      <Input
                        id="confirm-email"
                        type="email"
                        placeholder="Digite seu email para confirmar"
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        className="border-destructive/50 focus-visible:ring-destructive"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmEmail("")}>
                    Cancelar
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmEmail !== user?.email}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir minha conta
                      </>
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
