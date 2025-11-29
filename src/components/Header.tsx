import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Header = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();

  return (
    <div className="border-b border-border/50 bg-background backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-8 py-8 flex items-center justify-between">
        {children}
        <Button
          onClick={signOut}
          variant="outline"
          className="gap-2 border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all"
          size="sm"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
};
