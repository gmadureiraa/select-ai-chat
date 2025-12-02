import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backTo, children }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        {backTo && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(backTo)}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </header>
  );
}
