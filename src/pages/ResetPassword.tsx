import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

// ResetPassword — handler do callback do email "esqueci minha senha".
// Supabase coloca um token de recovery no hash da URL e o evento PASSWORD_RECOVERY
// dispara automaticamente quando o cliente carrega. A partir daí o user está numa
// "sessão de recovery" e pode chamar `auth.updateUser({ password })`.
//
// Modos:
// - request: mostra form pra digitar email (caso user navegue direto pra cá)
// - reset:   mostra form pra digitar nova senha (após clicar no link do email)
const ResetPassword = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Quando o user clica no link do email, Supabase dispara PASSWORD_RECOVERY
    // automaticamente e estabelece sessão temporária.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });

    // Fallback: se a URL tem #access_token=... (formato do callback), assume reset
    if (window.location.hash.includes("access_token") || window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess(true);
      toast.success("Email de recuperação enviado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar email");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada! Redirecionando…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background flex items-center justify-center p-4 relative"
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
            <h2 className="text-2xl text-center font-semibold leading-none tracking-tight">
              {mode === "reset" ? "Nova senha" : "Recuperar senha"}
            </h2>
            <CardDescription className="text-center mt-2">
              {mode === "reset"
                ? "Defina sua nova senha abaixo"
                : "Te enviaremos um link por email"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {mode === "request" && success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm">
                Enviamos um link pra <strong>{email}</strong>.
                <br />
                Verifique sua caixa de entrada (e o spam).
              </p>
              <Button variant="ghost" onClick={() => navigate("/login")} className="mt-2">
                Voltar ao login
              </Button>
            </div>
          ) : mode === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Voltar ao login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirmar senha</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                />
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Senhas não coincidem
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || password.length < 6 || password !== passwordConfirm}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando…
                  </>
                ) : (
                  "Alterar senha"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPassword;
