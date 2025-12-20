import { ReactNode } from "react";
import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface PendingAccessOverlayProps {
  children: ReactNode;
}

export const PendingAccessOverlay = ({ children }: PendingAccessOverlayProps) => {
  const { signOut } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Layout real mas borrado e sem interação */}
      <div className="blur-md pointer-events-none select-none opacity-50">
        {children}
      </div>
      
      {/* Overlay centralizado */}
      <div className="absolute inset-0 flex items-center justify-center z-50">
        <div className="text-center space-y-6 p-10 rounded-2xl bg-card/95 border border-border/50 shadow-2xl backdrop-blur-sm max-w-md mx-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Aguardando aprovação
            </h2>
            <p className="text-muted-foreground">
              Entre em contato com o time Kaleidos
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={signOut}
            className="mt-4"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};
