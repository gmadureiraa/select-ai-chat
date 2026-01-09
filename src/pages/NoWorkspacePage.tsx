import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut, Mail, Loader2 } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { CreateWorkspaceDialog } from "@/components/workspace/CreateWorkspaceDialog";

const NoWorkspacePage = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [checkingInvites, setCheckingInvites] = useState(true);

  // Check for pending invites on mount
  useEffect(() => {
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

    checkPendingInvites();
  }, [user, navigate]);

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-12 w-12" />
            <h1 className="text-4xl font-bold">
              k<span className="text-primary">AI</span>
            </h1>
          </div>
          <div>
            <CardTitle className="text-2xl text-center">
              Bem-vindo ao kAI
            </CardTitle>
            <CardDescription className="text-center">
              Você ainda não faz parte de nenhum workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            Para começar a usar o kAI, você precisa criar um novo workspace ou ser convidado para um existente.
          </div>
          
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="w-full"
            size="lg"
          >
            <Building2 className="mr-2 h-5 w-5" />
            Criar Novo Workspace
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-primary" />
              Recebeu um convite?
            </div>
            <p className="text-xs text-muted-foreground">
              Clique no link do email de convite para acessar o workspace automaticamente.
            </p>
          </div>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full text-muted-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>
      
      <CreateWorkspaceDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
};

export default NoWorkspacePage;
