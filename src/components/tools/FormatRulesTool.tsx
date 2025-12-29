import { useState } from "react";
import { 
  Mail, FileText, ScrollText, Image, Video, MessageSquare, 
  Send, PenTool, BookOpen, ChevronDown, ChevronUp, Edit2, 
  Check, X, Layers
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { 
  TWEET_FORMAT_RULES,
  THREAD_FORMAT_RULES,
  CAROUSEL_FORMAT_RULES,
  STORIES_FORMAT_RULES,
  REELS_FORMAT_RULES,
  LINKEDIN_FORMAT_RULES,
  STATIC_POST_FORMAT_RULES,
  CAPTION_FORMAT_RULES,
} from "@/types/template";

interface FormatRule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  rules: string;
  category: string;
}

const DEFAULT_FORMAT_RULES: FormatRule[] = [
  {
    id: "tweet",
    name: "Tweet",
    description: "Post curto para Twitter/X",
    icon: MessageSquare,
    rules: TWEET_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "thread",
    name: "Thread",
    description: "Série de tweets conectados",
    icon: ScrollText,
    rules: THREAD_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "carousel",
    name: "Carrossel",
    description: "Slides visuais para Instagram/LinkedIn",
    icon: Layers,
    rules: CAROUSEL_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "stories",
    name: "Stories",
    description: "Sequência de stories para Instagram",
    icon: Image,
    rules: STORIES_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "reels",
    name: "Reels/Shorts",
    description: "Roteiro para vídeo vertical curto",
    icon: Video,
    rules: REELS_FORMAT_RULES,
    category: "Vídeo"
  },
  {
    id: "linkedin",
    name: "Post LinkedIn",
    description: "Post profissional otimizado",
    icon: FileText,
    rules: LINKEDIN_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "instagram",
    name: "Post Instagram",
    description: "Legenda com hashtags otimizadas",
    icon: Send,
    rules: STATIC_POST_FORMAT_RULES,
    category: "Redes Sociais"
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "E-mail editorial com seções e CTAs",
    icon: Mail,
    rules: CAPTION_FORMAT_RULES,
    category: "E-mail"
  },
  {
    id: "blog",
    name: "Blog Post",
    description: "Artigo longo com SEO",
    icon: BookOpen,
    rules: CAPTION_FORMAT_RULES,
    category: "Conteúdo Longo"
  },
  {
    id: "script",
    name: "Roteiro",
    description: "Roteiro para vídeo longo",
    icon: PenTool,
    rules: CAPTION_FORMAT_RULES,
    category: "Vídeo"
  },
];

function FormatRuleCard({ rule, canEdit }: { rule: FormatRule; canEdit: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRules, setEditedRules] = useState(rule.rules);
  const Icon = rule.icon;

  const handleSave = () => {
    // TODO: Save to database when connected
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedRules(rule.rules);
    setIsEditing(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50 hover:border-border transition-colors">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">{rule.name}</CardTitle>
                  <CardDescription className="text-xs">{rule.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {rule.category}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Regras do formato
                </span>
                {canEdit && !isEditing && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedRules}
                    onChange={(e) => setEditedRules(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono">
                    {rule.rules}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function FormatRulesTool() {
  const { isEnterprise } = usePlanFeatures();
  const canEdit = isEnterprise;

  // Group rules by category
  const groupedRules = DEFAULT_FORMAT_RULES.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, FormatRule[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regras de Formato</h1>
        <p className="text-muted-foreground mt-1">
          Visualize e personalize as regras de cada formato de conteúdo.
          {!canEdit && " Faça upgrade para o plano Enterprise para editar."}
        </p>
      </div>

      {Object.entries(groupedRules).map(([category, rules]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {category}
          </h2>
          <div className="space-y-2">
            {rules.map((rule) => (
              <FormatRuleCard key={rule.id} rule={rule} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
