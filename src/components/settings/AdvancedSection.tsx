import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, ChevronRight, Database, Settings2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";

export function AdvancedSection() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { workspace } = useWorkspace();
  
  const currentSlug = slug || (workspace as { slug?: string })?.slug || "";

  const advancedItems = [
    {
      icon: BookOpen,
      title: "Base de Conhecimento",
      description: "Documentos e referências compartilhadas usados pela IA",
      action: () => navigate(`/${currentSlug}/kaleidos?tab=knowledge-base`),
    },
    {
      icon: FileText,
      title: "Regras de Formato",
      description: "Modelos e regras de formatação para geração de conteúdo",
      action: () => navigate(`/${currentSlug}/kaleidos?tab=format-rules`),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Configurações Avançadas</CardTitle>
        </div>
        <CardDescription>Ferramentas de administração e configurações avançadas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {advancedItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
