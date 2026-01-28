import { useState } from "react";
import { 
  Rocket, 
  GraduationCap, 
  Star, 
  MessageCircle,
  TrendingUp,
  Heart,
  Flame,
  BookOpen,
  Users,
  Lightbulb,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BriefingTemplate {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  briefing: string;
  category: 'conversion' | 'engagement' | 'branding' | 'content';
  isCustom?: boolean;
}

const BRIEFING_TEMPLATES: BriefingTemplate[] = [
  // Conversion focused
  {
    id: "lancamento",
    name: "Lançamento",
    icon: Rocket,
    color: "text-orange-500",
    category: 'conversion',
    briefing: "Criar conteúdos para lançamento de produto/serviço. Destacar benefícios principais, criar urgência e incluir CTA forte para conversão.",
  },
  {
    id: "cases",
    name: "Cases",
    icon: Star,
    color: "text-yellow-500",
    category: 'conversion',
    briefing: "Criar conteúdos destacando resultados e depoimentos de clientes. Foco em transformação, números concretos e prova social.",
  },
  // Engagement focused
  {
    id: "engajamento",
    name: "Engajamento",
    icon: MessageCircle,
    color: "text-green-500",
    category: 'engagement',
    briefing: "Criar conteúdos para gerar engajamento e interação: enquetes, perguntas provocativas, debates e conexão com a audiência.",
  },
  {
    id: "viral",
    name: "Viral/Trend",
    icon: Flame,
    color: "text-red-500",
    category: 'engagement',
    briefing: "Criar conteúdos com potencial viral. Usar trends atuais, formatos populares, hooks irresistíveis e elementos compartilháveis.",
  },
  {
    id: "comunidade",
    name: "Comunidade",
    icon: Users,
    color: "text-cyan-500",
    category: 'engagement',
    briefing: "Criar conteúdos para fortalecer a comunidade. Destacar membros, promover discussões, celebrar conquistas coletivas.",
  },
  // Content/Educational
  {
    id: "educacional",
    name: "Educativo",
    icon: GraduationCap,
    color: "text-blue-500",
    category: 'content',
    briefing: "Criar conteúdos educativos com dicas práticas e valor real para a audiência. Foco em resolver problemas e ensinar conceitos de forma simples.",
  },
  {
    id: "tutorial",
    name: "Tutorial",
    icon: BookOpen,
    color: "text-indigo-500",
    category: 'content',
    briefing: "Criar conteúdos no formato passo a passo. Guias práticos, how-to, demonstrações e instruções claras e acionáveis.",
  },
  {
    id: "insights",
    name: "Insights",
    icon: Lightbulb,
    color: "text-amber-500",
    category: 'content',
    briefing: "Compartilhar insights únicos e perspectivas originais. Análises profundas, previsões de tendências e reflexões provocativas.",
  },
  // Branding focused
  {
    id: "autoridade",
    name: "Autoridade",
    icon: TrendingUp,
    color: "text-purple-500",
    category: 'branding',
    briefing: "Criar conteúdos que posicionem como autoridade no mercado. Compartilhar insights exclusivos, tendências e análises profundas.",
  },
  {
    id: "conexao",
    name: "Conexão",
    icon: Heart,
    color: "text-pink-500",
    category: 'branding',
    briefing: "Criar conteúdos para humanizar a marca e criar conexão emocional. Bastidores, histórias pessoais e valores da marca.",
  },
  {
    id: "dados",
    name: "Dados",
    icon: BarChart3,
    color: "text-teal-500",
    category: 'branding',
    briefing: "Criar conteúdos baseados em dados e estatísticas. Infográficos, pesquisas, benchmarks e análises quantitativas.",
  },
  {
    id: "storytelling",
    name: "Storytelling",
    icon: Sparkles,
    color: "text-violet-500",
    category: 'branding',
    briefing: "Criar conteúdos narrativos envolventes. Histórias de origem, jornada do herói, cases emocionais e arcos narrativos completos.",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  conversion: '💰 Conversão',
  engagement: '💬 Engajamento', 
  content: '📚 Conteúdo',
  branding: '✨ Marca',
};

interface BriefingTemplatesProps {
  onSelect: (briefing: string) => void;
  disabled?: boolean;
}

export function BriefingTemplates({ onSelect, disabled }: BriefingTemplatesProps) {
  const [showAll, setShowAll] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<BriefingTemplate[]>(() => {
    const saved = localStorage.getItem('custom-briefing-templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', briefing: '' });

  const allTemplates = [...BRIEFING_TEMPLATES, ...customTemplates];
  const visibleTemplates = showAll ? allTemplates : allTemplates.slice(0, 6);

  const handleSaveCustomTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.briefing.trim()) return;
    
    const template: BriefingTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplate.name,
      icon: Sparkles,
      color: 'text-primary',
      category: 'content',
      briefing: newTemplate.briefing,
      isCustom: true,
    };
    
    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    localStorage.setItem('custom-briefing-templates', JSON.stringify(updated));
    setNewTemplate({ name: '', briefing: '' });
    setDialogOpen(false);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('custom-briefing-templates', JSON.stringify(updated));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">💡 Templates rápidos</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled={disabled}>
              <Plus className="h-3 w-3" />
              Criar template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar template personalizado</DialogTitle>
              <DialogDescription>
                Salve um briefing personalizado para reutilizar depois.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Promoção Black Friday"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-briefing">Briefing</Label>
                <Textarea
                  id="template-briefing"
                  value={newTemplate.briefing}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, briefing: e.target.value }))}
                  placeholder="Descreva o tipo de conteúdo, tom, objetivo..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCustomTemplate}>
                Salvar template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {visibleTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Tooltip key={template.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(template.briefing)}
                  disabled={disabled}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border",
                    "hover:border-primary/50 hover:bg-muted/50 transition-all",
                    "text-center group",
                    template.isCustom && "border-dashed",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {template.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomTemplate(template.id);
                      }}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                  <Icon className={cn("h-5 w-5", template.color, "group-hover:scale-110 transition-transform")} />
                  <span className="text-xs font-medium truncate w-full">{template.name}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">{template.briefing}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {allTemplates.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full h-7 text-xs gap-1"
          disabled={disabled}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver todos ({allTemplates.length} templates)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
