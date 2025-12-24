import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to workspace if already logged in
  useEffect(() => {
    const redirectToWorkspace = async () => {
      if (user) {
        try {
          const { data: slug } = await supabase
            .rpc("get_user_workspace_slug", { p_user_id: user.id });
          
          if (slug) {
            navigate(`/${slug}`, { replace: true });
          } else {
            // User has no workspace, redirect to signup
            navigate("/signup", { replace: true });
          }
        } catch (err) {
          console.error("Error fetching workspace:", err);
        }
      }
    };

    redirectToWorkspace();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // For signup, redirect to the dedicated signup page
        navigate("/signup");
        return;
      }
      
      await signIn(email, password);
      // The useEffect will handle redirection after successful login
    } catch (err) {
      console.error("Login error:", err);
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
              {loading ? "Carregando..." : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/signup")}
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

export default Login;
