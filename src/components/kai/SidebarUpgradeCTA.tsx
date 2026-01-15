import { Sparkles, LayoutDashboard, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";

interface SidebarUpgradeCTAProps {
  collapsed?: boolean;
  planName?: string;
}

export function SidebarUpgradeCTA({ collapsed, planName = "Basic" }: SidebarUpgradeCTAProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  if (collapsed) {
    return null;
  }

  // Only show for Canvas/Basic/Starter plan users (not Pro/Agency/Enterprise)
  const normalizedPlan = planName?.toLowerCase();
  if (normalizedPlan !== "basic" && normalizedPlan !== "starter" && normalizedPlan !== "canvas") {
    return null;
  }

  return (
    <div className="px-3 py-2">
      <div 
        className={cn(
          "relative overflow-hidden rounded-xl p-4",
          "bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10",
          "border border-primary/20"
        )}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-16 h-16 bg-secondary/10 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Upgrade Pro</span>
          </div>

          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Desbloqueie analytics, biblioteca e publicação
          </p>

          {/* Benefits */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
              <span>+10 clientes</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-secondary" />
              <span>Performance analytics</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span>Publicação agendada</span>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            size="sm"
            onClick={() => navigate(`/${slug}/settings?tab=billing`)}
            className={cn(
              "w-full text-xs font-medium",
              "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90",
              "text-white shadow-sm"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Upgrade $99.90/mês
          </Button>
        </div>
      </div>
    </div>
  );
}
