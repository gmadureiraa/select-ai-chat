import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(false);

  // Redirect to workspace if already logged in
  useEffect(() => {
    // 2026-05-17 — audit P0-2: antes navigate(`/${slug}`) caia em 3 RPCs
    // diferentes que podiam devolver "null" / undefined, formando rotas tipo
    // `/null` que entravam em loop de redirect com App.tsx. Sanitizamos cada
    // slug e — pq KAI 2.0 hoje so tem workspace "kaleidos" — qualquer slug
    // valido cai em "/kaleidos" (App.tsx forca isso de toda forma).
    const isValidSlug = (s: unknown): s is string =>
      typeof s === "string" && s.length > 0 && s !== "null" && s !== "undefined";
    const goToWorkspace = (slug: string) => {
      // Sempre redireciona pra /kaleidos. Quando KAI tiver multi-workspace
      // real, trocar pra `/${slug}` (preservando o sanitize acima).
      navigate("/kaleidos", { replace: true });
    };

    const redirectToWorkspace = async () => {
      if (user) {
        setCheckingRedirect(true);
        try {
          // Check for pending invites using RPC (bypasses RLS)
          const { data: pendingInvites } = await supabase.rpc("get_my_pending_workspace_invites");

          if (pendingInvites && pendingInvites.length > 0) {
            const invite = pendingInvites[0];

            // Accept the invite via RPC
            const { data: accepted } = await supabase.rpc("accept_pending_invite", {
              p_workspace_id: invite.workspace_id,
              p_user_id: user.id
            });

            if (accepted && isValidSlug(invite.workspace_slug)) {
              goToWorkspace(invite.workspace_slug);
              return;
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
            if (isValidSlug(workspace?.slug)) {
              goToWorkspace(workspace!.slug);
              return;
            }
          }

          // Fallback to RPC
          const { data: slug } = await supabase
            .rpc("get_user_workspace_slug", { p_user_id: user.id });

          if (isValidSlug(slug)) {
            goToWorkspace(slug);
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error(error.message || "Erro ao entrar com Google");
      }
    } catch (err) {
      console.error("Google login error:", err);
      toast.error("Erro ao entrar com Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (checkingRedirect) {
    return (
      <main
        id="main-content"
        className="min-h-dvh bg-background flex items-center justify-center p-4"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Carregando seu workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-dvh bg-background flex items-center justify-center p-4 relative"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <img src={kaleidosLogo} alt="" aria-hidden="true" className="h-12 w-12" />
            <h1 className="text-4xl font-bold">
              <span className="sr-only">KAI - </span>
              k<span className="text-primary">AI</span>
            </h1>
          </div>
          <div>
            {/* a11y: usamos h2 direto (CardTitle default = h3 e quebra heading-order h1→h3) */}
            <h2 className="text-2xl text-center font-semibold leading-none tracking-tight">
              Entrar
            </h2>
            <CardDescription className="text-center">
              Entre com suas credenciais
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Google Login Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Entrar com Google
          </Button>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => navigate("/reset-password")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  disabled={loading || googleLoading}
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || googleLoading}
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
              onClick={() => navigate("/signup")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading || googleLoading}
            >
              Não tem conta? Criar conta
            </button>
            <p className="text-xs text-muted-foreground">
              Recebeu um convite? Clique no link do convite para acessar.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
