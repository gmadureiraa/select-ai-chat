import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const SimpleSignup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceSlug = searchParams.get("workspace");
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitedWorkspaceName, setInvitedWorkspaceName] = useState<string | null>(null);

  // Fetch workspace name if slug is provided
  useEffect(() => {
    const fetchWorkspaceName = async () => {
      if (workspaceSlug) {
        try {
          const { data } = await supabase
            .from("workspaces")
            .select("name")
            .eq("slug", workspaceSlug.toLowerCase())
            .maybeSingle();
          
          if (data) {
            setInvitedWorkspaceName(data.name);
          }
        } catch (err) {
          console.error("Error fetching workspace:", err);
        }
      }
    };

    fetchWorkspaceName();
  }, [workspaceSlug]);

  // If already logged in, check for workspace and redirect
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (user) {
        try {
          // First check for pending invites
          const { data: pendingInvites } = await supabase.rpc("get_my_pending_workspace_invites");

          if (pendingInvites && pendingInvites.length > 0) {
            const invite = pendingInvites[0];
            
            // Accept the invite
            await supabase.rpc("accept_pending_invite", {
              p_workspace_id: invite.workspace_id,
              p_user_id: user.id
            });
            
            toast.success("Convite aceito! Redirecionando...");
            navigate(`/${invite.workspace_slug}`, { replace: true });
            return;
          }

          // Check existing workspace
          const { data: slug } = await supabase.rpc("get_user_workspace_slug", {
            p_user_id: user.id,
          });

          if (slug) {
            navigate(`/${slug}`, { replace: true });
          } else {
            navigate("/no-workspace", { replace: true });
          }
        } catch (err) {
          console.error("Error checking workspace:", err);
          navigate("/no-workspace", { replace: true });
        }
      }
    };

    checkAndRedirect();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Erro ao criar conta");

      toast.success("Conta criada com sucesso!");

      // 2. Check if trigger added user to a workspace (via invite)
      // Small delay to allow trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check for pending invites first
      const { data: pendingInvites } = await supabase.rpc("get_my_pending_workspace_invites");

      if (pendingInvites && pendingInvites.length > 0) {
        const invite = pendingInvites[0];
        
        // Accept the invite
        await supabase.rpc("accept_pending_invite", {
          p_workspace_id: invite.workspace_id,
          p_user_id: authData.user.id
        });
        
        toast.success("Convite aceito! Bem-vindo ao workspace.");
        navigate(`/${invite.workspace_slug}`, { replace: true });
        return;
      }

      // Check if already added to workspace
      const { data: slug } = await supabase.rpc("get_user_workspace_slug", {
        p_user_id: authData.user.id,
      });

      if (slug) {
        // User was invited - redirect to workspace
        toast.success("Você foi adicionado ao workspace automaticamente!");
        navigate(`/${slug}`, { replace: true });
      } else {
        // No invite - go to no-workspace page
        navigate("/no-workspace", { replace: true });
      }
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao criar conta";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle className="text-2xl text-center">Criar Conta</CardTitle>
            <CardDescription className="text-center">
              {invitedWorkspaceName ? (
                <span className="flex flex-col items-center gap-2 mt-2">
                  <span className="flex items-center gap-1 text-primary">
                    <Sparkles className="h-3 w-3" />
                    Você foi convidado!
                  </span>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <strong>{invitedWorkspaceName}</strong>
                  </span>
                </span>
              ) : (
                "Crie sua conta para acessar o kAI"
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : invitedWorkspaceName ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Criar Conta e Aceitar Convite
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Já tem conta? Faça login
            </button>
            {!invitedWorkspaceName && (
              <p className="text-xs text-muted-foreground">
                Recebeu um convite? Clique no link do convite para acessar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleSignup;
