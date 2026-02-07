import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Mail, Loader2, UserPlus, RefreshCw, Clock } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { toast } from "sonner";

const NoWorkspacePage = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [checkingInvites, setCheckingInvites] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check for pending invites
  const checkPendingInvites = async () => {
    if (!user) {
      setCheckingInvites(false);
      return;
    }

    try {
      const { data: pendingInvites } = await supabase.rpc("get_my_pending_workspace_invites");

      if (pendingInvites && pendingInvites.length > 0) {
        const invite = pendingInvites[0];
        
        // Accept the invite via RPC
        await supabase.rpc("accept_pending_invite", {
          p_workspace_id: invite.workspace_id,
          p_user_id: user.id
        });
        
        toast.success("Convite aceito! Redirecionando...");
        
        // Redirect to the workspace
        navigate(`/${invite.workspace_slug}`, { replace: true });
        return;
      }
    } catch (err) {
      console.error("Error checking invites:", err);
    } finally {
      setCheckingInvites(false);
    }
  };

  // Check for pending invites on mount
  useEffect(() => {
    checkPendingInvites();
  }, [user, navigate]);

  const handleRefreshInvites = async () => {
    setIsRefreshing(true);
    await checkPendingInvites();
    setIsRefreshing(false);
    if (!checkingInvites) {
      toast.info("Nenhum convite pendente encontrado");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (checkingInvites) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando convites pendentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header Card */}
        <Card className="border-primary/20">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="flex items-center justify-center gap-4">
              <img src={kaleidosLogo} alt="Kaleidos" className="h-14 w-14" />
              <h1 className="text-4xl font-bold">
                k<span className="text-primary">AI</span>
              </h1>
            </div>
            <div>
              <CardTitle className="text-2xl">
                Olá, {user?.email?.split('@')[0] || 'usuário'}! 👋
              </CardTitle>
              <CardDescription className="mt-2">
                Você ainda não tem acesso ao sistema
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* Pending Access Info */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              Acesso Pendente
            </CardTitle>
            <CardDescription>
              Seu acesso precisa ser autorizado por um administrador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Para ter acesso ao kAI, você precisa ser convidado por um administrador da equipe.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-medium">Seu email:</span>
              </div>
              <p className="text-sm font-mono bg-background rounded px-2 py-1 break-all">
                {user?.email}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Check Invites */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </div>
              Recebeu um convite?
            </CardTitle>
            <CardDescription>
              Verifique se há convites pendentes para sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleRefreshInvites}
                disabled={isRefreshing}
                className="w-full"
              >
                {isRefreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Verificar convites pendentes
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Convites são aceitos automaticamente quando detectados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoWorkspacePage;
