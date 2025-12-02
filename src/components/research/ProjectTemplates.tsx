import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutTemplate, Target, FileText, Users, Sparkles } from "lucide-react";

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  items: Array<{
    type: string;
    title: string;
    content?: string;
    position_x: number;
    position_y: number;
  }>;
}

const templates: ProjectTemplate[] = [
  {
    id: "competitor-analysis",
    name: "Análise de Concorrentes",
    description: "Template para análise detalhada de concorrentes com comparações",
    icon: <Target className="h-6 w-6" />,
    items: [
      { type: "note", title: "Objetivo da Análise", content: "Defina aqui o objetivo principal da análise de concorrentes...", position_x: 100, position_y: 100 },
      { type: "note", title: "Concorrente 1", content: "Nome, URL, pontos fortes e fracos...", position_x: 400, position_y: 100 },
      { type: "note", title: "Concorrente 2", content: "Nome, URL, pontos fortes e fracos...", position_x: 700, position_y: 100 },
      { type: "note", title: "Concorrente 3", content: "Nome, URL, pontos fortes e fracos...", position_x: 1000, position_y: 100 },
      { type: "comparison", title: "Comparação Final", position_x: 550, position_y: 350 },
      { type: "ai_chat", title: "Análise IA", position_x: 550, position_y: 600 },
    ],
  },
  {
    id: "content-briefing",
    name: "Briefing de Conteúdo",
    description: "Template para criação de briefings estruturados",
    icon: <FileText className="h-6 w-6" />,
    items: [
      { type: "note", title: "Tema Principal", content: "Qual é o tema central do conteúdo?", position_x: 100, position_y: 100 },
      { type: "note", title: "Público-Alvo", content: "Quem é o público-alvo deste conteúdo?", position_x: 400, position_y: 100 },
      { type: "note", title: "Objetivos", content: "Quais são os objetivos do conteúdo?", position_x: 700, position_y: 100 },
      { type: "note", title: "Referências", content: "Links e materiais de referência...", position_x: 100, position_y: 350 },
      { type: "note", title: "Tom de Voz", content: "Como o conteúdo deve soar?", position_x: 400, position_y: 350 },
      { type: "note", title: "Call-to-Action", content: "Qual ação esperamos do leitor?", position_x: 700, position_y: 350 },
      { type: "ai_chat", title: "Gerador de Briefing", position_x: 400, position_y: 600 },
    ],
  },
  {
    id: "ux-research",
    name: "Research de UX",
    description: "Template para pesquisa de experiência do usuário",
    icon: <Users className="h-6 w-6" />,
    items: [
      { type: "note", title: "Hipóteses", content: "Quais são as hipóteses a serem validadas?", position_x: 100, position_y: 100 },
      { type: "note", title: "Metodologia", content: "Entrevistas, testes de usabilidade, surveys...", position_x: 400, position_y: 100 },
      { type: "note", title: "Perfil de Usuários", content: "Descrição dos participantes da pesquisa...", position_x: 700, position_y: 100 },
      { type: "note", title: "Descobertas", content: "Principais insights encontrados...", position_x: 100, position_y: 350 },
      { type: "note", title: "Pain Points", content: "Problemas identificados...", position_x: 400, position_y: 350 },
      { type: "note", title: "Oportunidades", content: "Oportunidades de melhoria...", position_x: 700, position_y: 350 },
      { type: "comparison", title: "Síntese", position_x: 250, position_y: 600 },
      { type: "ai_chat", title: "Análise de Research", position_x: 550, position_y: 600 },
    ],
  },
];

interface ProjectTemplatesProps {
  onApplyTemplate: (template: ProjectTemplate) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ProjectTemplates = ({ onApplyTemplate, open, onOpenChange }: ProjectTemplatesProps) => {
  const handleApply = (template: ProjectTemplate) => {
    onApplyTemplate(template);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Templates de Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleApply(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  {template.icon}
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {template.description}
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  {template.items.length} itens pré-configurados
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { ProjectTemplate };
