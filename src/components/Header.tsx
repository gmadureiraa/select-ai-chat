import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Header = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();

  return (
    <div className="border-b border-border/50 bg-background backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-8 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <Button
          onClick={signOut}
          variant="outline"
          className="gap-2 border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all shrink-0"
          size="sm"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </div>
  );
};
