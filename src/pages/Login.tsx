import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(false);

  // Redirect to workspace if already logged in
  useEffect(() => {
    const redirectToWorkspace = async () => {
      if (user) {
        setCheckingRedirect(true);
        try {
          // Get user email
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const userEmail = authUser?.email;

          // Check for pending invites and accept them automatically
          if (userEmail) {
            const { data: pendingInvites } = await supabase
              .from("workspace_invites")
              .select("id, workspace_id, workspaces(slug)")
              .eq("email", userEmail)
              .is("accepted_at", null)
              .gt("expires_at", new Date().toISOString())
              .limit(1);

            if (pendingInvites && pendingInvites.length > 0) {
              const invite = pendingInvites[0];
              const workspace = invite.workspaces as { slug: string } | null;
              
              // Accept the invite via RPC
              const { data: accepted } = await supabase.rpc("accept_pending_invite", {
                p_workspace_id: invite.workspace_id,
                p_user_id: user.id
              });
              
              if (accepted && workspace?.slug) {
                navigate(`/${workspace.slug}`, { replace: true });
                return;
              }
            }
          }

          // Check existing memberships
          const { data: memberships } = await supabase
            .from("workspace_members")
            .select("workspace_id, workspaces(slug)")
            .eq("user_id", user.id)
            .limit(1);

          if (memberships && memberships.length > 0) {
            const workspace = memberships[0].workspaces as { slug: string } | null;
            if (workspace?.slug) {
              navigate(`/${workspace.slug}`, { replace: true });
              return;
            }
          }

          // Fallback to RPC
          const { data: slug } = await supabase
            .rpc("get_user_workspace_slug", { p_user_id: user.id });
          
          if (slug) {
            navigate(`/${slug}`, { replace: true });
          } else {
            // User has no workspace, redirect to no-workspace page
            navigate("/no-workspace", { replace: true });
          }
        } catch (err) {
          console.error("Error fetching workspace:", err);
          navigate("/no-workspace", { replace: true });
        } finally {
          setCheckingRedirect(false);
        }
      }
    };

    redirectToWorkspace();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      // The useEffect will handle redirection after successful login
    } catch (err: unknown) {
      console.error("Login error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao entrar";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingRedirect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando seu workspace...</p>
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
              Entrar
            </CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Não tem conta? Criar conta
            </button>
            <p className="text-xs text-muted-foreground">
              Recebeu um convite? Clique no link do convite para acessar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
