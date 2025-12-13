import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface SecondaryLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SecondaryLayout({ children, title }: SecondaryLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/kai")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <img 
              src={kaleidosLogo} 
              alt="kAI" 
              className="h-6 w-6 object-contain" 
            />
            <span className="font-semibold text-lg">{title}</span>
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/kai")}
            className="h-8 w-8"
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
