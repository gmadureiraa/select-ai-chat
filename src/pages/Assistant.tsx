import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Assistant = () => {
  const navigate = useNavigate();

  const { data: clients, isLoading: isLoadingClients } = useQuery({
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

  const handleSelectClient = (clientId: string) => {
    navigate(`/chat/${clientId}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-lg w-full px-6">
        <div className="text-center space-y-6">
          {/* Logo and title */}
          <div className="space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full blur-xl" />
              </div>
              <img 
                src={kaleidosLogo} 
                alt="kAI" 
                className="h-16 w-16 object-contain relative z-10 mx-auto" 
              />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Assistente kAI</h1>
              <p className="text-muted-foreground mt-2">
                Selecione um cliente para começar
              </p>
            </div>
          </div>

          {/* Client selector */}
          <div className="space-y-4">
            <Select onValueChange={handleSelectClient}>
              <SelectTrigger className="w-full h-12 text-base">
                <SelectValue placeholder="Escolha um cliente..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : clients?.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum cliente cadastrado
                  </div>
                ) : (
                  clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <span>{client.name}</span>
                        {client.description && (
                          <span className="text-muted-foreground text-xs">
                            • {client.description.slice(0, 30)}...
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Client cards grid */}
            {!isLoadingClients && clients && clients.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                {clients.slice(0, 6).map((client) => (
                  <Card
                    key={client.id}
                    className="p-4 cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/30"
                    onClick={() => handleSelectClient(client.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        {client.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {client.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoadingClients && (!clients || clients.length === 0) && (
              <div className="py-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhum cliente cadastrado ainda
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Acesse a área de Clientes para criar um
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
