import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, X, Loader2, Building2, Link2, Mail, Lock, User } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Signup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    const checkExistingWorkspace = async () => {
      if (user) {
        const { data } = await supabase
          .rpc("get_user_workspace_slug", { p_user_id: user.id });
        
        if (data) {
          navigate(`/${data}`, { replace: true });
        }
      }
    };
    checkExistingWorkspace();
  }, [user, navigate]);

  // Auto-generate slug from company name
  useEffect(() => {
    if (companyName) {
      const generatedSlug = companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generatedSlug);
    }
  }, [companyName]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const { data, error } = await supabase
          .rpc("is_slug_available", { p_slug: slug });
        
        if (!error) {
          setSlugAvailable(data);
        }
      } catch (err) {
        console.error("Error checking slug:", err);
      } finally {
        setCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!slugAvailable) {
      toast.error("URL não disponível. Escolha outra.");
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

      // 2. Create workspace with subscription and tokens using the database function
      const { data: workspaceId, error: workspaceError } = await supabase
        .rpc("create_workspace_with_subscription", {
          p_name: companyName,
          p_slug: slug.toLowerCase(),
          p_owner_id: authData.user.id,
        });

      if (workspaceError) throw workspaceError;

      toast.success("Conta criada com sucesso!");
      
      // Redirect to the new workspace
      navigate(`/${slug}`, { replace: true });
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
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-12 w-12" />
            <h1 className="text-4xl font-bold">
              k<span className="text-primary">AI</span>
            </h1>
          </div>
          <div>
            <CardTitle className="text-2xl text-center">
              Criar Seu Workspace
            </CardTitle>
            <CardDescription className="text-center">
              Configure sua empresa e comece a usar o kAI
            </CardDescription>
          </div>
          
          {/* Plan requirement notice */}
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-center">
              <strong>Plano Básico</strong> - Crie seu próprio workspace e gerencie sua equipe
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Nome da Empresa
              </Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Agência de Marketing"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Slug / URL */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                URL do Workspace
              </Label>
              <div className="flex items-center gap-2">
                <div className="bg-muted px-3 py-2 rounded-l-md border border-r-0 text-sm text-muted-foreground">
                  kai.kaleidos.com.br/
                </div>
                <div className="relative flex-1">
                  <Input
                    id="slug"
                    type="text"
                    placeholder="minha-empresa"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    required
                    disabled={loading}
                    minLength={3}
                    maxLength={50}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!checkingSlug && slugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                    {!checkingSlug && slugAvailable === false && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              </div>
              {slugAvailable === false && (
                <p className="text-sm text-destructive">Esta URL já está em uso</p>
              )}
            </div>

            <div className="border-t my-6" />

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
                placeholder="voce@empresa.com"
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
              disabled={loading || !slugAvailable || slug.length < 3}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Workspace"
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
              Já tem uma conta? Entre aqui
            </button>
            <p className="text-xs text-muted-foreground">
              Quer entrar em um workspace existente? Peça o link de convite ao administrador.
            </p>
          </div>

          {/* Plan info */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              🎁 Você receberá <strong>1.000 tokens grátis</strong> para começar.
              <br />
              Faça upgrade a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
