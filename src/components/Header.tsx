import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Header = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();

  return (
    <div className="border-b border-border/50 bg-background backdrop-blur-xl sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 flex items-center justify-between gap-3">
        {children}
        <Button
          onClick={signOut}
          variant="outline"
          size="sm"
          className="gap-2 border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all flex-shrink-0"
        >
          <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </div>
  );
};