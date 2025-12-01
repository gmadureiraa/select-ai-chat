import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

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
            className="p-6 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer group"
            onClick={() => navigate(`/client/${client.id}/performance`)}
          >
            <div className="flex items-start gap-3 mb-4">
              <BarChart3 className="h-5 w-5 text-foreground mt-0.5" />
              <h3 className="font-semibold text-lg">{client.name}</h3>
            </div>
            {client.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {client.description}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
