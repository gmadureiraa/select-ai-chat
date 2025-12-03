import { BookOpen, Lightbulb, Layout, Sparkles, GitBranch, Edit3, Target, Palette, LucideIcon } from "lucide-react";

export interface ResearchCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  description: string;
}

export const RESEARCH_CATEGORIES: ResearchCategory[] = [
  { 
    id: "reference", 
    label: "Referência de Conteúdo", 
    icon: BookOpen,
    color: "cyan",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/30",
    textClass: "text-cyan-500",
    description: "Material para usar como base na criação de conteúdo"
  },
  { 
    id: "central_idea", 
    label: "Ideia Central", 
    icon: Lightbulb,
    color: "yellow",
    bgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500/30",
    textClass: "text-yellow-500",
    description: "Conceito principal ou tese do projeto"
  },
  { 
    id: "standard", 
    label: "Padrão de Comunicação", 
    icon: Layout,
    color: "purple",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-500",
    description: "Template ou estrutura a ser seguida"
  },
  { 
    id: "insight", 
    label: "Insight/Descoberta", 
    icon: Sparkles,
    color: "green",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
    textClass: "text-green-500",
    description: "Aprendizado ou descoberta importante"
  },
  { 
    id: "connection", 
    label: "Conexão/Relação", 
    icon: GitBranch,
    color: "blue",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    textClass: "text-blue-500",
    description: "Ponte entre conceitos ou materiais"
  },
  { 
    id: "draft", 
    label: "Rascunho/WIP", 
    icon: Edit3,
    color: "orange",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    textClass: "text-orange-500",
    description: "Trabalho em progresso"
  },
  { 
    id: "goal", 
    label: "Objetivo/Meta", 
    icon: Target,
    color: "red",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    textClass: "text-red-500",
    description: "Meta ou resultado desejado"
  },
  { 
    id: "creative", 
    label: "Criativo/Visual", 
    icon: Palette,
    color: "pink",
    bgClass: "bg-pink-500/10",
    borderClass: "border-pink-500/30",
    textClass: "text-pink-500",
    description: "Elemento visual ou criativo"
  },
];

export const getCategoryById = (id: string | undefined): ResearchCategory | undefined => {
  if (!id) return undefined;
  return RESEARCH_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryColor = (id: string | undefined): string => {
  const category = getCategoryById(id);
  return category?.color || "gray";
};
