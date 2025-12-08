import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWorkflowTemplates, WorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { Loader2, Sparkles, LayoutTemplate, Zap, Search, Video, Mail, MessageSquare } from "lucide-react";

interface WorkflowTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  content: <LayoutTemplate className="h-4 w-4" />,
  repurpose: <Video className="h-4 w-4" />,
  research: <Search className="h-4 w-4" />,
  automation: <Zap className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  content: "Conteúdo",
  repurpose: "Repurpose",
  research: "Pesquisa",
  automation: "Automação",
};

export const WorkflowTemplateSelector = ({
  open,
  onOpenChange,
  onSelectTemplate,
}: WorkflowTemplateSelectorProps) => {
  const { data: templates, isLoading } = useWorkflowTemplates();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = templates
    ? [...new Set(templates.map((t) => t.category))]
    : [];

  const filteredTemplates = selectedCategory
    ? templates?.filter((t) => t.category === selectedCategory)
    : templates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Templates de Workflow
          </DialogTitle>
          <DialogDescription>
            Escolha um template pré-configurado para começar rapidamente
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="gap-1"
                >
                  {categoryIcons[cat]}
                  {categoryLabels[cat] || cat}
                </Button>
              ))}
            </div>

            {/* Templates Grid */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates?.map((template) => (
                  <Card
                    key={template.id}
                    className="p-4 hover:border-primary/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      onSelectTemplate(template);
                      onOpenChange(false);
                    }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{template.icon || "🔧"}</span>
                          <div>
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {template.name}
                            </h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {categoryLabels[template.category] || template.category}
                            </Badge>
                          </div>
                        </div>
                        {template.is_featured && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Destaque
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          {template.nodes.filter((n: any) => n.type === "agent").length} agentes
                        </span>
                        <span>•</span>
                        <span>{template.connections.length} conexões</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {filteredTemplates?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum template encontrado</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
