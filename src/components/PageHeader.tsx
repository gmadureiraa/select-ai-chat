import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  onBack?: () => void;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backTo, onBack, badge, children }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    }
  };

  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        {(backTo || onBack) && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="space-y-1">
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
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
