import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, X, FileText, Image, Loader2, Link2, 
  Eye, Wand2, Save, CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AttachmentOutput } from './AttachmentNode';

const FORMAT_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'thread', label: 'Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'reels', label: 'Roteiro Reels' },
];

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'tiktok', label: 'TikTok' },
];

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (Quadrado)' },
  { value: '4:5', label: '4:5 (Feed)' },
  { value: '9:16', label: '9:16 (Stories/Reels)' },
  { value: '16:9', label: '16:9 (YouTube)' },
];

type GenerationStep = 'idle' | 'analyzing' | 'generating' | 'saving' | 'done';

const STEP_LABELS: Record<GenerationStep, string> = {
  idle: '',
  analyzing: 'Analisando inputs...',
  generating: 'Gerando conteúdo...',
  saving: 'Salvando resultado...',
  done: 'Concluído!',
};

const STEP_PROGRESS: Record<GenerationStep, number> = {
  idle: 0,
  analyzing: 25,
  generating: 60,
  saving: 90,
  done: 100,
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
  onCreateOutput?: (data: { type: 'text' | 'image'; content: string; imageUrl?: string; format: string; platform: string }) => void;
}

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
    }
    
    return attachments;
  }, [id, getEdges, getNode]);

  const connectedCount = getConnectedAttachments().length;

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
          data.onCreateOutput({
            type: 'text',
            content: result.content || result.text || '',
            format: data.format || 'post',
            platform: data.platform || 'instagram',
          });
        } else {
          data.onCreateOutput({
            type: 'image',
            content: result.imageUrl || result.image_url || '',
            imageUrl: result.imageUrl || result.image_url || '',
            format: 'image',
            platform: data.platform || 'instagram',
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

  // Get step icon
  const StepIcon = useCallback(() => {
    switch (generationStep) {
      case 'analyzing':
        return <Eye className="h-4 w-4 animate-pulse" />;
      case 'generating':
        return <Wand2 className="h-4 w-4 animate-bounce" />;
      case 'saving':
        return <Save className="h-4 w-4 animate-pulse" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  }, [generationStep]);

  return (
    <Card className={cn(
      "w-80 shadow-lg rounded-xl transition-all duration-200",
      selected ? 'ring-2 ring-primary shadow-primary/10' : 'hover:shadow-xl',
      isGenerating && 'ring-2 ring-emerald-500/50'
    )}>
      {/* Input handles - 4 slots for connections */}
      {[0, 1, 2, 3].map((i) => (
        <Handle
          key={i}
          type="target"
          position={Position.Left}
          id={`input-${i}`}
          style={{ top: `${25 + i * 20}%` }}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        />
      ))}

      <CardHeader className={cn(
        "pb-2 rounded-t-xl border-b",
        "bg-emerald-500/5 dark:bg-emerald-500/10",
        "border-emerald-500/15 dark:border-emerald-500/20"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center transition-all duration-200",
              isGenerating 
                ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" 
                : "bg-emerald-500/80 dark:bg-emerald-500"
            )}>
              <StepIcon />
            </div>
            <span>Gerador</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {connectedCount > 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
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
              <StepIcon />
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

        {/* Text options */}
        {generationType === 'text' && (
          <div className="space-y-2">
            <Select 
              value={data.format || 'post'} 
              onValueChange={(v) => data.onUpdateData?.({ format: v })}
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

            <Select 
              value={data.platform || 'instagram'} 
              onValueChange={(v) => data.onUpdateData?.({ platform: v })}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </Card>
  );
};

export const GeneratorNode = memo(GeneratorNodeComponent);
