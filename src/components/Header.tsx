import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Header = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();

  return (
    <div className="border-b bg-card shadow-lg">
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-between">
        {children}
        <Button
          onClick={signOut}
          variant="outline"
          className="gap-2"
          size="sm"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
};
