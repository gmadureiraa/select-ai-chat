import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, X, FileText, Image, Loader2, Link2, 
  Eye, Wand2, Save, CheckCircle2, Zap, Brain
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AttachmentOutput } from './AttachmentNode';

// Unified format options - platform derived automatically
const FORMAT_OPTIONS = [
  // Instagram
  { value: 'carousel', label: 'Carrossel Instagram', platform: 'instagram' },
  { value: 'static_post', label: 'Post Estático Instagram', platform: 'instagram' },
  { value: 'reels', label: 'Roteiro Reels', platform: 'instagram' },
  
  // Twitter/X
  { value: 'tweet', label: 'Tweet', platform: 'twitter' },
  { value: 'thread', label: 'Thread Twitter', platform: 'twitter' },
  { value: 'x_article', label: 'Artigo X', platform: 'twitter' },
  
  // LinkedIn
  { value: 'linkedin_post', label: 'Post LinkedIn', platform: 'linkedin' },
  
  // Newsletter
  { value: 'newsletter', label: 'Newsletter', platform: 'other' },
  
  // YouTube
  { value: 'youtube_script', label: 'Roteiro YouTube', platform: 'youtube' },
];

// Helper to get platform from format
const getPlatformFromFormat = (format: string): string => {
  const option = FORMAT_OPTIONS.find(opt => opt.value === format);
  return option?.platform || 'instagram';
};

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (Quadrado)' },
  { value: '4:5', label: '4:5 (Feed)' },
  { value: '9:16', label: '9:16 (Stories/Reels)' },
  { value: '16:9', label: '16:9 (YouTube)' },
];

type GenerationStep = 'idle' | 'extracting' | 'analyzing' | 'loading_rules' | 'generating' | 'streaming' | 'saving' | 'done';

const STEP_LABELS: Record<GenerationStep, string> = {
  idle: '',
  extracting: 'Extraindo conteúdo...',
  analyzing: 'Analisando contexto...',
  loading_rules: 'Carregando regras...',
  generating: 'Gerando com IA...',
  streaming: 'Recebendo resposta...',
  saving: 'Finalizando...',
  done: 'Concluído!',
};

const STEP_PROGRESS: Record<GenerationStep, number> = {
  idle: 0,
  extracting: 15,
  analyzing: 30,
  loading_rules: 45,
  generating: 60,
  streaming: 80,
  saving: 95,
  done: 100,
};

const STEP_ICONS: Record<GenerationStep, React.ElementType> = {
  idle: Sparkles,
  extracting: Eye,
  analyzing: Brain,
  loading_rules: FileText,
  generating: Wand2,
  streaming: Zap,
  saving: Save,
  done: CheckCircle2,
};

export interface GeneratorNodeData {
  type: 'text' | 'image';
  format?: string;
  platform?: string;
  aspectRatio?: string;
  noText?: boolean;
  preserveFace?: boolean;
  isGenerating?: boolean;
  generationStep?: GenerationStep;
  clientId?: string;
  onUpdateData?: (data: Partial<GeneratorNodeData>) => void;
  onDelete?: () => void;
  onCreateOutput?: (data: { type: 'text' | 'image'; content: string; imageUrl?: string; format: string; platform: string; thread_tweets?: Array<{ id: string; text: string; media_urls: string[] }> }) => void;
}

// Step icon component with animation
const StepIconAnimated = ({ step }: { step: GenerationStep }) => {
  const Icon = STEP_ICONS[step];
  const isActive = step !== 'idle' && step !== 'done';
  
  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
    >
      <Icon className={cn(
        "h-4 w-4",
        step === 'done' && "text-green-500"
      )} />
    </motion.div>
  );
};

const GeneratorNodeComponent: React.FC<NodeProps<GeneratorNodeData>> = ({ 
  id,
  data, 
  selected 
}) => {
  const { getEdges, getNode } = useReactFlow();
  const { toast } = useToast();

  const generationType = data.type || 'text';
  const isGenerating = data.isGenerating || false;
  const generationStep = data.generationStep || 'idle';

  // Count connected attachments
  const getConnectedAttachments = useCallback((): AttachmentOutput[] => {
    const edges = getEdges();
    const incomingEdges = edges.filter(e => e.target === id);
    
    const attachments: AttachmentOutput[] = [];
    
    for (const edge of incomingEdges) {
      const sourceNode = getNode(edge.source);
      if (sourceNode?.type === 'attachment' && sourceNode.data?.output) {
        attachments.push(sourceNode.data.output as AttachmentOutput);
      }
      // Also support sticky notes and text nodes as context
      if (sourceNode?.type === 'sticky' && sourceNode.data?.content) {
        attachments.push({
          type: 'text',
          content: sourceNode.data.content as string,
        });
      }
      if (sourceNode?.type === 'text' && sourceNode.data?.content) {
        attachments.push({
          type: 'text',
          content: sourceNode.data.content as string,
        });
      }
      // ENHANCED: Support for output/result nodes as rich context references
      if ((sourceNode?.type === 'output' || sourceNode?.type === 'contentOutput') && sourceNode.data?.content) {
        const isImage = sourceNode.data?.isImage;
        const outputFormat = sourceNode.data?.format || 'unknown';
        const contentStr = sourceNode.data.content as string;
        
        if (isImage) {
          // Image output - use as visual reference
          attachments.push({
            type: 'image',
            content: contentStr,
            imageBase64: contentStr,
          });
        } else {
          // Text output - mark as previous generation for context continuity
          attachments.push({
            type: 'text',
            content: `[CONTEXTO DE GERAÇÃO ANTERIOR - FORMATO: ${outputFormat.toUpperCase()}]\n\n${contentStr}\n\n---\n*Use este conteúdo anterior para manter consistência de tom, estilo e informações.*`,
            transcription: contentStr,
          });
        }
      }
    }
    
    return attachments;
  }, [id, getEdges, getNode]);

  const connectedCount = getConnectedAttachments().length;
  
  // Detect if we have previous outputs connected (for UI feedback)
  const hasPreviousOutputs = useCallback((): boolean => {
    const edges = getEdges();
    const incomingEdges = edges.filter(e => e.target === id);
    
    return incomingEdges.some(edge => {
      const sourceNode = getNode(edge.source);
      return sourceNode?.type === 'output' || sourceNode?.type === 'contentOutput';
    });
  }, [id, getEdges, getNode]);

  const handleGenerate = useCallback(async () => {
    const attachments = getConnectedAttachments();
    
    if (attachments.length === 0) {
      toast({
        title: 'Nenhum anexo conectado',
        description: 'Conecte pelo menos um anexo ao gerador.',
        variant: 'destructive'
      });
      return;
    }

    // Start generation with step tracking
    data.onUpdateData?.({ isGenerating: true, generationStep: 'analyzing' });

    try {
      // Simulate analyzing step
      await new Promise(resolve => setTimeout(resolve, 500));
      data.onUpdateData?.({ generationStep: 'generating' });

      const { data: result, error } = await supabase.functions.invoke('generate-content-v2', {
        body: {
          type: generationType,
          clientId: data.clientId,
          inputs: attachments.map(att => ({
            type: att.type,
            content: att.content,
            imageBase64: att.imageBase64,
            analysis: att.analysis,
            transcription: att.transcription,
          })),
          config: {
            format: data.format || 'post',
            platform: data.platform || 'instagram',
            aspectRatio: data.aspectRatio || '1:1',
            noText: data.noText || false,
            preserveFace: data.preserveFace || false,
          }
        }
      });

      if (error) throw error;

      data.onUpdateData?.({ generationStep: 'saving' });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Create output node instead of showing inline
      if (data.onCreateOutput) {
        if (generationType === 'text') {
          // For threads, include thread_tweets in the output
          const outputData: any = {
            type: 'text',
            content: result.content || result.text || '',
            format: data.format || 'post',
            platform: getPlatformFromFormat(data.format || 'post'),
          };
          
          // If this is a thread and we have parsed tweets, include them
          if (data.format === 'thread' && result.thread_tweets && Array.isArray(result.thread_tweets)) {
            outputData.thread_tweets = result.thread_tweets;
          }
          
          data.onCreateOutput(outputData);
        } else {
          data.onCreateOutput({
            type: 'image',
            content: result.imageUrl || result.image_url || '',
            imageUrl: result.imageUrl || result.image_url || '',
            format: 'image',
            platform: getPlatformFromFormat(data.format || 'post'),
          });
        }
      }

      data.onUpdateData?.({ generationStep: 'done' });
      
      // Reset after short delay
      setTimeout(() => {
        data.onUpdateData?.({ isGenerating: false, generationStep: 'idle' });
      }, 1500);

      toast({ title: 'Conteúdo gerado!', description: 'Resultado adicionado ao canvas.' });
    } catch (error) {
      console.error('Generation error:', error);
      data.onUpdateData?.({ isGenerating: false, generationStep: 'idle' });
      toast({
        title: 'Erro ao gerar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  }, [generationType, data, getConnectedAttachments, toast]);

  return (
    <div className="relative">
      {/* Glow ring when generating */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3], 
              scale: [1, 1.02, 1] 
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 blur-md"
          />
        )}
      </AnimatePresence>
      
      <Card className={cn(
        "w-80 shadow-lg rounded-xl transition-all duration-200 relative",
        selected ? 'ring-2 ring-primary shadow-primary/10' : 'hover:shadow-xl',
        isGenerating && 'ring-2 ring-primary/50 shadow-primary/20'
      )}>
        {/* Input handles - 4 slots for connections */}
        {[0, 1, 2, 3].map((i) => (
          <Handle
            key={i}
            type="target"
            position={Position.Left}
            id={`input-${i}`}
            style={{ top: `${25 + i * 20}%` }}
            className={cn(
              "!w-3 !h-3 transition-all duration-200",
              "!bg-primary !border-2 !border-background",
              "hover:!scale-125 hover:!shadow-md hover:!shadow-primary/30"
            )}
          />
        ))}

      <CardHeader className={cn(
        "pb-2 rounded-t-xl border-b",
        "bg-muted/50",
        "border-border"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center transition-all duration-200",
              isGenerating 
                ? "bg-primary shadow-lg shadow-primary/30" 
                : "bg-muted-foreground/20"
            )}>
              <StepIconAnimated step={generationStep} />
            </div>
            <span>Gerador</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {connectedCount > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <Link2 className="h-3 w-3" />
                {connectedCount}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
              onClick={data.onDelete}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Generation progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StepIconAnimated step={generationStep} />
              <span>{STEP_LABELS[generationStep]}</span>
            </div>
            <Progress value={STEP_PROGRESS[generationStep]} className="h-1.5" />
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-2">
          <Button
            variant={generationType === 'text' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => data.onUpdateData?.({ type: 'text' })}
            disabled={isGenerating}
          >
            <FileText className="h-3 w-3 mr-1" />
            Texto
          </Button>
          <Button
            variant={generationType === 'image' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => data.onUpdateData?.({ type: 'image' })}
            disabled={isGenerating}
          >
            <Image className="h-3 w-3 mr-1" />
            Imagem
          </Button>
        </div>

        {/* Text options - unified format selector (platform derived automatically) */}
        {generationType === 'text' && (
          <div className="space-y-2">
            <Select 
              value={data.format || 'carousel'} 
              onValueChange={(v) => {
                const platform = getPlatformFromFormat(v);
                data.onUpdateData?.({ format: v, platform });
              }}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Context preview for text generation */}
            {connectedCount > 0 && !isGenerating && (
              <div className="bg-muted/50 rounded-lg p-2 text-[10px] space-y-1 border border-border/50">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  <span className="font-medium">Contexto:</span>
                </div>
                <div className="text-muted-foreground pl-4 space-y-0.5">
                  <p>• {connectedCount} input(s) conectado(s)</p>
                  {hasPreviousOutputs() && (
                    <p className="text-primary text-[9px] font-medium">
                      ✨ Memória de contexto ativada
                    </p>
                  )}
                  <p className="text-[9px] opacity-70">
                    + Regras do formato, identidade do cliente, favoritos
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image options */}
        {generationType === 'image' && (
          <div className="space-y-2">
            <Select 
              value={data.aspectRatio || '1:1'} 
              onValueChange={(v) => data.onUpdateData?.({ aspectRatio: v })}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Proporção" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="noText"
                  checked={data.noText || false}
                  onCheckedChange={(checked) => data.onUpdateData?.({ noText: !!checked })}
                  disabled={isGenerating}
                />
                <Label htmlFor="noText" className="text-xs">Sem texto</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="preserveFace"
                  checked={data.preserveFace || false}
                  onCheckedChange={(checked) => data.onUpdateData?.({ preserveFace: !!checked })}
                  disabled={isGenerating}
                />
                <Label htmlFor="preserveFace" className="text-xs">Manter rosto</Label>
              </div>
            </div>

            {/* Context preview for image generation */}
            {connectedCount > 0 && !isGenerating && (
              <div className="bg-muted/50 rounded-lg p-2 text-[10px] space-y-1 border border-border/50">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  <span className="font-medium">Contexto detectado:</span>
                </div>
                <div className="text-muted-foreground pl-4 space-y-0.5">
                  <p>• {connectedCount} input(s) conectado(s)</p>
                  {data.noText && <p>• Sem texto na imagem ✓</p>}
                  {hasPreviousOutputs() && (
                    <p className="text-primary text-[9px] font-medium">
                      ✨ Memória de contexto ativada
                    </p>
                  )}
                  <p className="text-[9px] opacity-70">
                    + Identidade visual e referências do perfil
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <Button
          className="w-full"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || connectedCount === 0}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {STEP_LABELS[generationStep] || 'Gerando...'}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar {generationType === 'text' ? 'Texto' : 'Imagem'}
            </>
          )}
        </Button>

        {/* Helper text */}
        {connectedCount === 0 && !isGenerating && (
          <p className="text-[10px] text-muted-foreground text-center">
            Conecte anexos, notas ou textos a este gerador
          </p>
        )}
      </CardContent>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-3 !h-3 transition-all duration-200",
          "!bg-primary !border-2 !border-background",
          "hover:!scale-125 hover:!shadow-md hover:!shadow-primary/30"
        )}
      />
    </Card>
    </div>
  );
};

export const GeneratorNode = memo(GeneratorNodeComponent);
