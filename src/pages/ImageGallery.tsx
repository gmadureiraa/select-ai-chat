import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ArrowLeft, Download, Trash2, Sparkles } from "lucide-react";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { Badge } from "@/components/ui/badge";

const ImageGallery = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["client-templates", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("client_id", clientId)
        .eq("type", "image");

      if (error) throw error;
      return data;
    },
  });

  const { generations, deleteGeneration } = useImageGenerations(clientId!);

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return "Sem template";
    const template = templates.find(t => t.id === templateId);
    return template?.name || "Template desconhecido";
  };

  // Group generations by template
  const generationsByTemplate = generations.reduce((acc, gen) => {
    const key = gen.template_id || "no-template";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(gen);
    return acc;
  }, {} as Record<string, typeof generations>);

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <div>
          <div className="flex items-center gap-4 mb-2">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Galeria de Imagens</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {generations.length} {generations.length === 1 ? 'imagem gerada' : 'imagens geradas'}
              </p>
            </div>
          </div>
          {client && (
            <p className="text-muted-foreground">{client.name}</p>
          )}
        </div>
        <Button
          onClick={() => navigate(`/client/${clientId}`)}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </Header>

      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto p-6">
          {generations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma imagem gerada ainda</p>
              <p className="text-sm mt-2">
                Comece gerando imagens no dashboard do cliente
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(generationsByTemplate).map(([templateKey, gens]) => (
                <div key={templateKey}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-semibold">
                      {getTemplateName(templateKey === "no-template" ? null : templateKey)}
                    </h2>
                    <Badge variant="secondary">{gens.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {gens.map((gen) => (
                      <Card key={gen.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardContent className="p-0">
                          <div className="aspect-square relative group">
                            <img
                              src={gen.image_url}
                              alt={gen.prompt}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = gen.image_url;
                                  link.download = `image-${gen.id}.png`;
                                  link.click();
                                }}
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => deleteGeneration.mutate(gen.id)}
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {gen.prompt}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(gen.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ImageGallery;
