import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Palette, 
  MessageSquare, 
  Users, 
  Target, 
  Lightbulb, 
  BookOpen,
  Edit2,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Globe,
  FileText,
  Instagram,
  Linkedin,
  Twitter,
  Youtube
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ClientAnalysis, AnalysisProgress } from '@/hooks/useClientAnalysis';

interface AIClientAnalysisProps {
  analysis: ClientAnalysis | null;
  isAnalyzing: boolean;
  progress: AnalysisProgress;
  error?: string | null;
  onReanalyze?: () => void;
  onUpdate?: (updates: Partial<ClientAnalysis>) => void;
  className?: string;
  compact?: boolean;
}

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
}

function EditableField({ value, onSave, multiline }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex gap-2 items-start">
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 min-h-[80px]"
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
          />
        )}
        <Button size="icon" variant="ghost" onClick={handleSave} className="h-8 w-8">
          <Check className="h-4 w-4 text-green-500" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel} className="h-8 w-8">
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <span className="flex-1">{value}</span>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function SectionCard({ title, icon, children, defaultOpen = true }: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {icon}
              {title}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LoadingState({ progress }: { progress: AnalysisProgress }) {
  const steps = [
    { label: 'Extraindo branding do website', threshold: 20 },
    { label: 'Analisando conteúdo das páginas', threshold: 40 },
    { label: 'Processando documentos', threshold: 60 },
    { label: 'Gerando análise com IA', threshold: 80 },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Brain className="h-8 w-8 text-primary animate-pulse" />
            <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div>
            <h3 className="font-semibold">Analisando Cliente...</h3>
            <p className="text-sm text-muted-foreground">{progress.step}</p>
          </div>
        </div>

        <Progress value={progress.progress} className="h-2 mb-4" />

        <div className="space-y-2">
          {steps.map((step, i) => {
            const isComplete = progress.progress >= step.threshold;
            const isCurrent = progress.progress >= step.threshold - 20 && progress.progress < step.threshold;
            
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-sm transition-colors",
                  isComplete && "text-primary",
                  isCurrent && "text-foreground font-medium",
                  !isComplete && !isCurrent && "text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                )}
                {step.label}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourcesBadge({ sources }: { sources: ClientAnalysis['sources_analyzed'] }) {
  const socialIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-3 w-3" />,
    linkedin: <Linkedin className="h-3 w-3" />,
    twitter: <Twitter className="h-3 w-3" />,
    youtube: <Youtube className="h-3 w-3" />,
  };

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {sources.website && (
        <Badge variant="secondary" className="gap-1">
          <Globe className="h-3 w-3" />
          Website
        </Badge>
      )}
      {sources.branding && (
        <Badge variant="secondary" className="gap-1">
          <Palette className="h-3 w-3" />
          Branding
        </Badge>
      )}
      {sources.documents > 0 && (
        <Badge variant="secondary" className="gap-1">
          <FileText className="h-3 w-3" />
          {sources.documents} doc{sources.documents > 1 ? 's' : ''}
        </Badge>
      )}
      {sources.social_profiles.map(profile => (
        <Badge key={profile} variant="secondary" className="gap-1">
          {socialIcons[profile] || <Globe className="h-3 w-3" />}
          {profile}
        </Badge>
      ))}
    </div>
  );
}

export function AIClientAnalysis({
  analysis,
  isAnalyzing,
  progress,
  error,
  onReanalyze,
  onUpdate,
  className,
  compact = false,
}: AIClientAnalysisProps) {
  if (isAnalyzing) {
    return <LoadingState progress={progress} />;
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <X className="h-8 w-8 text-destructive" />
            <div>
              <h3 className="font-semibold">Erro na Análise</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          {onReanalyze && (
            <Button onClick={onReanalyze} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Nenhuma análise disponível</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Execute a análise para obter insights sobre o cliente
          </p>
          {onReanalyze && (
            <Button onClick={onReanalyze} variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Análise
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const handleUpdateSummary = (value: string) => {
    onUpdate?.({ executive_summary: value });
  };

  return (
    <ScrollArea className={cn("pr-4", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">Análise Inteligente</span>
            <Badge variant="outline" className="text-xs">
              {new Date(analysis.generated_at).toLocaleDateString('pt-BR')}
            </Badge>
          </div>
          {onReanalyze && (
            <Button onClick={onReanalyze} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Re-analisar
            </Button>
          )}
        </div>

        {/* Sources */}
        <SourcesBadge sources={analysis.sources_analyzed} />

        {/* Executive Summary */}
        <SectionCard
          title="Resumo Executivo"
          icon={<Brain className="h-4 w-4 text-primary" />}
        >
          <EditableField
            value={analysis.executive_summary}
            onSave={handleUpdateSummary}
            multiline
          />
        </SectionCard>

        {/* Visual Identity */}
        <SectionCard
          title="Identidade Visual"
          icon={<Palette className="h-4 w-4 text-pink-500" />}
        >
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Cores:</span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {analysis.visual_identity.colors.length > 0 ? (
                  analysis.visual_identity.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono">{color}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Não identificadas</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Tipografia:</span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {analysis.visual_identity.typography.map((font, i) => (
                  <Badge key={i} variant="secondary">{font}</Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Estilo: </span>
              <span>{analysis.visual_identity.style}</span>
            </div>
          </div>
        </SectionCard>

        {/* Tone of Voice */}
        <SectionCard
          title="Tom de Voz"
          icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
        >
          <div className="space-y-3">
            <div>
              <Badge className="mb-2">{analysis.tone_of_voice.primary}</Badge>
              <div className="flex gap-1 flex-wrap">
                {analysis.tone_of_voice.secondary.map((tone, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{tone}</Badge>
                ))}
              </div>
            </div>
            {analysis.tone_of_voice.avoid.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Evitar:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {analysis.tone_of_voice.avoid.map((item, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{item}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Target Audience */}
        <SectionCard
          title="Público-Alvo"
          icon={<Users className="h-4 w-4 text-green-500" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              {analysis.target_audience.demographics.age && (
                <div>
                  <span className="text-muted-foreground">Idade:</span>
                  <div>{analysis.target_audience.demographics.age}</div>
                </div>
              )}
              {analysis.target_audience.demographics.role && (
                <div>
                  <span className="text-muted-foreground">Cargo:</span>
                  <div>{analysis.target_audience.demographics.role}</div>
                </div>
              )}
              {analysis.target_audience.demographics.location && (
                <div>
                  <span className="text-muted-foreground">Localização:</span>
                  <div>{analysis.target_audience.demographics.location}</div>
                </div>
              )}
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Perfil:</span>
              <div className="flex gap-1 flex-wrap mt-1">
                {analysis.target_audience.psychographics.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Objectives */}
        <SectionCard
          title="Objetivos Sugeridos"
          icon={<Target className="h-4 w-4 text-orange-500" />}
        >
          <ul className="space-y-1">
            {analysis.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary">•</span>
                {obj}
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Content Themes */}
        <SectionCard
          title="Temas de Conteúdo"
          icon={<BookOpen className="h-4 w-4 text-purple-500" />}
        >
          <div className="flex gap-2 flex-wrap">
            {analysis.content_themes.map((theme, i) => (
              <Badge key={i} variant="secondary">{theme}</Badge>
            ))}
          </div>
        </SectionCard>

        {/* Recommendations */}
        <SectionCard
          title="Recomendações da IA"
          icon={<Lightbulb className="h-4 w-4 text-yellow-500" />}
        >
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}
