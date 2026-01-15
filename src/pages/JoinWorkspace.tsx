import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Building2 } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const JoinWorkspace = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Check if workspace exists and get its name
  useEffect(() => {
    const checkWorkspace = async () => {
      if (!slug) {
        navigate("/signup");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id, name")
          .eq("slug", slug.toLowerCase())
          .maybeSingle();

        if (error || !data) {
          toast.error("Workspace não encontrado");
          navigate("/signup");
          return;
        }

        setWorkspaceName(data.name);
        setWorkspaceId(data.id);
      } catch (err) {
        console.error("Error checking workspace:", err);
        navigate("/signup");
      } finally {
        setCheckingWorkspace(false);
      }
    };

    checkWorkspace();
  }, [slug, navigate]);

  // Redirect if already logged in
  useEffect(() => {
    const checkExistingAccess = async () => {
      if (user && workspaceId) {
        // Check if user is already a member
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (membership) {
          navigate(`/${slug}`, { replace: true });
          return;
        }

        // User is logged in but not a member - redirect to workspace to show pending overlay
        navigate(`/${slug}`, { replace: true });
      }
    };

    if (!checkingWorkspace) {
      checkExistingAccess();
    }
  }, [user, workspaceId, slug, navigate, checkingWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workspaceId || !slug) {
      toast.error("Workspace inválido");
      return;
    }

    setLoading(true);

    try {
      // 1. Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/${slug}`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Falha ao criar conta");

      // 2. Create access request for this workspace
      const { error: requestError } = await supabase
        .from("workspace_access_requests")
        .insert({
          workspace_id: workspaceId,
          user_id: authData.user.id,
          status: "pending",
          message: `Solicitação de acesso via ${slug}/join`,
        });

      if (requestError) {
        console.error("Error creating access request:", requestError);
        // Don't throw - the account was created, just log the error
      }

      toast.success("Conta criada! Aguardando aprovação do administrador.");
      
      // Redirect to the workspace - will show pending overlay
      navigate(`/${slug}`, { replace: true });
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao criar conta";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingWorkspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <CardTitle className="text-2xl text-center">Criar Conta</CardTitle>
            <CardDescription className="text-center">
              <span className="flex items-center justify-center gap-2 mt-2">
                <Building2 className="h-4 w-4" />
                <strong>{workspaceName}</strong>
              </span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Seu Nome Completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="João Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
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
                  Criando conta...
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate(`/${slug}/login`)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Já tem uma conta? Entre aqui
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Após criar sua conta, um administrador precisará aprovar seu acesso.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinWorkspace;
