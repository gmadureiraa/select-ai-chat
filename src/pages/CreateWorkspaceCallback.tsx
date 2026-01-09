import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function CreateWorkspaceCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setErrorMessage("Sessão de pagamento não encontrada");
      return;
    }

    const verifyAndCreateWorkspace = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-checkout-and-create-workspace", {
          body: { sessionId },
        });

        if (error) throw error;

        if (data?.slug) {
          setWorkspaceSlug(data.slug);
          setStatus("success");
          // Redirect after 2 seconds
          setTimeout(() => {
            navigate(`/${data.slug}`);
          }, 2000);
        } else {
          throw new Error(data?.error || "Erro ao criar workspace");
        }
      } catch (error) {
        console.error("Error verifying checkout:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Erro ao verificar pagamento");
      }
    };

    verifyAndCreateWorkspace();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Criando seu Workspace...</h1>
            <p className="text-muted-foreground">
              Aguarde enquanto verificamos o pagamento e configuramos seu novo workspace.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">Workspace Criado!</h1>
            <p className="text-muted-foreground">
              Seu novo workspace foi criado com sucesso. Você será redirecionado em instantes...
            </p>
            <Button onClick={() => navigate(`/${workspaceSlug}`)}>
              Ir para o Workspace
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Erro ao Criar Workspace</h1>
            <p className="text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                Voltar ao Início
              </Button>
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
