import { useState, useMemo } from "react";
import { 
  Mail, FileText, ScrollText, Image, Video, MessageSquare, 
  Send, PenTool, BookOpen, ChevronDown, ChevronUp, Edit2, 
  Check, X, Layers, Plus, Trash2, Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useFormatRules, FormatRule } from "@/hooks/useFormatRules";
import { CreateFormatRuleModal } from "./CreateFormatRuleModal";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LocalFormatRule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  rules: string;
  category: string;
  isSystem: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  tweet: MessageSquare,
  thread: ScrollText,
  carousel: Layers,
  stories: Image,
  reels: Video,
  linkedin: FileText,
  instagram: Send,
  newsletter: Mail,
  blog: BookOpen,
  script: PenTool,
  social: MessageSquare,
  video: Video,
  email: Mail,
  article: BookOpen,
};

const DEFAULT_FORMAT_RULES: LocalFormatRule[] = [
  {
    id: "tweet",
    name: "Tweet",
    description: "Post curto para Twitter/X",
    icon: MessageSquare,
    rules: TWEET_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "thread",
    name: "Thread",
    description: "Série de tweets conectados",
    icon: ScrollText,
    rules: THREAD_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "carousel",
    name: "Carrossel",
    description: "Slides visuais para Instagram/LinkedIn",
    icon: Layers,
    rules: CAROUSEL_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "stories",
    name: "Stories",
    description: "Sequência de stories para Instagram",
    icon: Image,
    rules: STORIES_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "reels",
    name: "Reels/Shorts",
    description: "Roteiro para vídeo vertical curto",
    icon: Video,
    rules: REELS_FORMAT_RULES,
    category: "Vídeo",
    isSystem: true,
  },
  {
    id: "linkedin",
    name: "Post LinkedIn",
    description: "Post profissional otimizado",
    icon: FileText,
    rules: LINKEDIN_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "instagram",
    name: "Post Instagram",
    description: "Legenda com hashtags otimizadas",
    icon: Send,
    rules: STATIC_POST_FORMAT_RULES,
    category: "Redes Sociais",
    isSystem: true,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "E-mail editorial com seções e CTAs",
    icon: Mail,
    rules: CAPTION_FORMAT_RULES,
    category: "E-mail",
    isSystem: true,
  },
  {
    id: "blog",
    name: "Blog Post",
    description: "Artigo longo com SEO",
    icon: BookOpen,
    rules: CAPTION_FORMAT_RULES,
    category: "Conteúdo Longo",
    isSystem: true,
  },
  {
    id: "script",
    name: "Roteiro",
    description: "Roteiro para vídeo longo",
    icon: PenTool,
    rules: CAPTION_FORMAT_RULES,
    category: "Vídeo",
    isSystem: true,
  },
];

interface FormatRuleCardProps {
  rule: LocalFormatRule;
  canEdit: boolean;
  onSave?: (id: string, rules: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving?: boolean;
}

function FormatRuleCard({ rule, canEdit, onSave, onDelete, isSaving }: FormatRuleCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRules, setEditedRules] = useState(rule.rules);
  const Icon = rule.icon;

  const handleSave = async () => {
    if (onSave) {
      await onSave(rule.id, editedRules);
    }
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
                {!rule.isSystem && (
                  <Badge variant="secondary" className="text-xs">
                    Personalizado
                  </Badge>
                )}
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
                <div className="flex gap-2">
                  {canEdit && !rule.isSystem && onDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir formato?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O formato "{rule.name}" será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(rule.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
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
  const { formatRules, isLoading, updateFormatRule, deleteFormatRule, isUpdating } = useFormatRules();
  const canEdit = isEnterprise;

  // Merge database rules with default rules
  const allRules = useMemo(() => {
    const dbRulesMap = new Map(formatRules.map(r => [r.format_id, r]));
    
    // Convert default rules, checking if they have DB overrides
    const mergedDefaults: LocalFormatRule[] = DEFAULT_FORMAT_RULES.map(defaultRule => {
      const dbRule = dbRulesMap.get(defaultRule.id);
      if (dbRule) {
        // DB override exists
        const rulesContent = typeof dbRule.rules === 'string' 
          ? dbRule.rules 
          : JSON.stringify(dbRule.rules, null, 2);
        return {
          ...defaultRule,
          id: dbRule.id,
          name: dbRule.name,
          description: dbRule.description || defaultRule.description,
          rules: rulesContent,
          isSystem: dbRule.is_system ?? true,
        };
      }
      return defaultRule;
    });

    // Add custom rules from DB that are not in defaults
    const customRules: LocalFormatRule[] = formatRules
      .filter(r => !DEFAULT_FORMAT_RULES.some(d => d.id === r.format_id))
      .map(r => {
        const rulesContent = typeof r.rules === 'string' 
          ? r.rules 
          : JSON.stringify(r.rules, null, 2);
        return {
          id: r.id,
          name: r.name,
          description: r.description || "",
          icon: ICON_MAP[r.format_id] || FileText,
          rules: rulesContent,
          category: getCategoryFromFormatId(r.format_id),
          isSystem: false,
        };
      });

    return [...mergedDefaults, ...customRules];
  }, [formatRules]);

  // Group rules by category
  const groupedRules = useMemo(() => {
    return allRules.reduce((acc, rule) => {
      if (!acc[rule.category]) {
        acc[rule.category] = [];
      }
      acc[rule.category].push(rule);
      return acc;
    }, {} as Record<string, LocalFormatRule[]>);
  }, [allRules]);

  const handleSave = async (id: string, rules: string) => {
    const existingRule = formatRules.find(r => r.id === id);
    if (existingRule) {
      await updateFormatRule({ id, rules });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteFormatRule(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regras de Formato</h1>
          <p className="text-muted-foreground mt-1">
            Visualize e personalize as regras de cada formato de conteúdo.
            {!canEdit && " Faça upgrade para o plano Enterprise para editar."}
          </p>
        </div>
        {canEdit && (
          <CreateFormatRuleModal onCreated={() => {}} />
        )}
      </div>

      {Object.entries(groupedRules).map(([category, rules]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {category}
          </h2>
          <div className="space-y-2">
            {rules.map((rule) => (
              <FormatRuleCard 
                key={rule.id} 
                rule={rule} 
                canEdit={canEdit}
                onSave={handleSave}
                onDelete={!rule.isSystem ? handleDelete : undefined}
                isSaving={isUpdating}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getCategoryFromFormatId(formatId: string): string {
  const categoryMap: Record<string, string> = {
    social: "Redes Sociais",
    video: "Vídeo",
    email: "E-mail",
    article: "Conteúdo Longo",
  };
  return categoryMap[formatId] || "Outros";
}
