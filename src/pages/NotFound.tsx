import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex items-center justify-center gap-3">
            <img src={kaleidosLogo} alt="kAI" className="h-10 w-10" />
            <h1 className="text-3xl font-bold">
              k<span className="text-primary">AI</span>
            </h1>
          </div>
          
          <div className="py-6">
            <div className="text-8xl font-bold text-primary/20">404</div>
          </div>
          
          <div>
            <CardTitle className="text-xl">Página não encontrada</CardTitle>
            <CardDescription className="mt-2">
              A página que você está procurando não existe ou foi movida.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => navigate(-1)} 
              variant="outline" 
              className="flex-1 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button 
              onClick={() => navigate("/")} 
              className="flex-1 gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Precisa de ajuda?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/login")}
                className="flex-1 gap-2 text-muted-foreground"
              >
                <Search className="h-4 w-4" />
                Entrar na conta
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                className="flex-1 gap-2 text-muted-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                Suporte
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;