import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PerformanceClients() {
  const navigate = useNavigate();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Análise de Performance</h1>
        <p className="text-muted-foreground">
          Escolha um cliente para visualizar métricas e insights de performance
        </p>
      </div>

      {/* Client Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients?.map((client) => (
          <Card
            key={client.id}
            className="hover:shadow-lg transition-all cursor-pointer border-accent/20 hover:border-accent/40 group"
            onClick={() => navigate(`/client/${client.id}/performance`)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1">
                  <CardTitle className="group-hover:text-accent transition-colors">
                    {client.name}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="line-clamp-2">
                {client.description || "Visualize dashboards e métricas de performance"}
              </CardDescription>
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Ver análise completa</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
