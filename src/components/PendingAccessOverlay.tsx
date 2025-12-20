import { ReactNode } from "react";
import { Clock, LogOut, TrendingUp, Users, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface PendingAccessOverlayProps {
  children: ReactNode;
}

// Mock performance preview component
const MockPerformancePreview = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance</h1>
          <p className="text-muted-foreground">Visão geral das métricas</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Eye, label: "Visualizações", value: "124.5K", change: "+12.3%" },
          { icon: Users, label: "Seguidores", value: "45.2K", change: "+8.7%" },
          { icon: Heart, label: "Engajamento", value: "3.8%", change: "+2.1%" },
          { icon: TrendingUp, label: "Alcance", value: "89.1K", change: "+15.4%" },
        ].map((kpi, i) => (
          <Card key={i} className="p-4 bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <kpi.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
                <p className="text-xs text-green-500">{kpi.change}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area Chart Mock */}
        <Card className="p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Crescimento de Seguidores</h3>
          <div className="h-48 flex items-end gap-1">
            {[40, 55, 45, 60, 75, 65, 80, 70, 85, 90, 82, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-primary/20 to-primary/60 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Jan</span>
            <span>Fev</span>
            <span>Mar</span>
            <span>Abr</span>
            <span>Mai</span>
            <span>Jun</span>
          </div>
        </Card>

        {/* Donut Chart Mock */}
        <Card className="p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Distribuição de Conteúdo</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="12" strokeDasharray="125.6 251.2" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--accent))" strokeWidth="12" strokeDasharray="62.8 251.2" strokeDashoffset="-125.6" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" strokeDasharray="50.2 251.2" strokeDashoffset="-188.4" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">100%</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary" /> Reels</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-accent" /> Posts</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-secondary" /> Stories</span>
          </div>
        </Card>
      </div>

      {/* Table Mock */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Top Conteúdos</h3>
        <div className="space-y-3">
          {[
            { title: "Como aumentar seu engajamento", views: "12.4K", engagement: "5.2%" },
            { title: "Dicas de copywriting para redes sociais", views: "9.8K", engagement: "4.8%" },
            { title: "Estratégias de crescimento orgânico", views: "8.2K", engagement: "4.1%" },
            { title: "Análise de métricas que importam", views: "7.5K", engagement: "3.9%" },
          ].map((content, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="font-medium">{content.title}</span>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>{content.views} views</span>
                <span>{content.engagement}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const PendingAccessOverlay = ({ children }: PendingAccessOverlayProps) => {
  const { signOut } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Mock performance dashboard in the background - less blur */}
      <div className="blur-[3px] pointer-events-none select-none opacity-70">
        {/* Render children but also overlay with mock content */}
        <div className="flex h-screen">
          {/* Sidebar placeholder */}
          <div className="w-60 border-r border-border bg-sidebar p-4 space-y-4">
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="space-y-2 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-8 bg-muted/50 rounded" />
              ))}
            </div>
          </div>
          {/* Main content with mock performance */}
          <div className="flex-1 overflow-auto bg-background">
            <MockPerformancePreview />
          </div>
        </div>
      </div>
      
      {/* Overlay centralizado */}
      <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/30">
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
