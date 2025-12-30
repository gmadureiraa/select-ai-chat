import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { toast } from "sonner";

const WorkspaceLogin = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);

  // Check if workspace exists and get its name
  useEffect(() => {
    const checkWorkspace = async () => {
      if (!slug) {
        navigate("/login");
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
          navigate("/login");
          return;
        }

        setWorkspaceName(data.name);
      } catch (err) {
        console.error("Error checking workspace:", err);
        navigate("/login");
      } finally {
        setCheckingWorkspace(false);
      }
    };

    checkWorkspace();
  }, [slug, navigate]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !checkingWorkspace && slug) {
      navigate(`/${slug}`, { replace: true });
    }
  }, [user, checkingWorkspace, slug, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (!result.error) {
        // Redirect to the workspace
        navigate(`/${slug}`, { replace: true });
      }
    } catch (err) {
      console.error("Login error:", err);
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
            <CardTitle className="text-2xl text-center">
              Entrar
            </CardTitle>
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
                  Carregando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate(`/${slug}/join`)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Não tem conta? Crie uma agora
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceLogin;
