import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWorkflowTemplates, WorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { Loader2, Sparkles, LayoutTemplate, Zap, Search, Video, Bot, GitBranch, ArrowRight, Users } from "lucide-react";
import { motion } from "framer-motion";

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

const categoryColors: Record<string, string> = {
  content: "from-blue-500/20 to-blue-600/5",
  repurpose: "from-purple-500/20 to-purple-600/5",
  research: "from-amber-500/20 to-amber-600/5",
  automation: "from-emerald-500/20 to-emerald-600/5",
};

export const WorkflowTemplateSelector = ({
  open,
  onOpenChange,
  onSelectTemplate,
}: WorkflowTemplateSelectorProps) => {
  const { data: templates, isLoading } = useWorkflowTemplates();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const categories = templates
    ? [...new Set(templates.map((t) => t.category))]
    : [];

  const filteredTemplates = selectedCategory
    ? templates?.filter((t) => t.category === selectedCategory)
    : templates;

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'trigger': return <Zap className="h-3 w-3 text-orange-400" />;
      case 'agent': return <Bot className="h-3 w-3 text-blue-400" />;
      case 'condition': return <GitBranch className="h-3 w-3 text-yellow-400" />;
      case 'tool': return <Zap className="h-3 w-3 text-green-400" />;
      default: return <LayoutTemplate className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 overflow-hidden">
        <div className="p-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              Templates de Workflow
            </DialogTitle>
            <DialogDescription className="text-base">
              Escolha um template pré-configurado com agentes e conexões prontos para usar
            </DialogDescription>
          </DialogHeader>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="rounded-full"
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="gap-1 rounded-full"
                >
                  {categoryIcons[cat]}
                  {categoryLabels[cat] || cat}
                </Button>
              ))}
            </div>

            {/* Templates Grid */}
            <ScrollArea className="h-[450px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates?.map((template, index) => {
                  const agentNodes = template.nodes.filter((n: any) => n.type === "agent");
                  const isHovered = hoveredTemplate === template.id;
                  
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        className={`relative overflow-hidden p-5 cursor-pointer transition-all duration-300 border-2 ${
                          isHovered ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]' : 'border-border hover:border-muted-foreground/30'
                        }`}
                        onClick={() => {
                          onSelectTemplate(template);
                          onOpenChange(false);
                        }}
                        onMouseEnter={() => setHoveredTemplate(template.id)}
                        onMouseLeave={() => setHoveredTemplate(null)}
                      >
                        {/* Background gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${categoryColors[template.category] || 'from-gray-500/20 to-gray-600/5'} opacity-50`} />
                        
                        <div className="relative space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">{template.icon || "🔧"}</div>
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {template.name}
                                </h3>
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {categoryLabels[template.category] || template.category}
                                </Badge>
                              </div>
                            </div>
                            {template.is_featured && (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Destaque
                              </Badge>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>

                          {/* Agents Flow Preview */}
                          {agentNodes.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap py-2">
                              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
                                <Zap className="h-3 w-3 text-orange-400" />
                                <span className="text-xs text-orange-400">Trigger</span>
                              </div>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              {agentNodes.slice(0, 3).map((agent: any, i: number) => (
                                <div key={i} className="flex items-center gap-1">
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                                    <Bot className="h-3 w-3 text-blue-400" />
                                    <span className="text-xs text-blue-400 max-w-[80px] truncate">
                                      {agent.config?.name || `Agente ${i + 1}`}
                                    </span>
                                  </div>
                                  {i < agentNodes.slice(0, 3).length - 1 && (
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              ))}
                              {agentNodes.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{agentNodes.length - 3} mais
                                </span>
                              )}
                            </div>
                          )}

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs pt-2 border-t border-border/50">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Bot className="h-3.5 w-3.5 text-blue-400" />
                              <span className="font-medium">{agentNodes.length}</span> agentes
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <GitBranch className="h-3.5 w-3.5 text-green-400" />
                              <span className="font-medium">{template.connections.length}</span> conexões
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="h-3.5 w-3.5 text-purple-400" />
                              <span className="font-medium">{template.nodes.length}</span> nodes
                            </span>
                          </div>

                          {/* Use button on hover */}
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute bottom-5 right-5"
                            >
                              <Button size="sm" className="shadow-lg">
                                Usar Template
                                <ArrowRight className="h-4 w-4 ml-1" />
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {filteredTemplates?.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
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