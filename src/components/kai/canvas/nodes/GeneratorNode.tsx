import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { normalizeCanvasFormat, toGenerateContentV2Format } from '../lib/canvasFormats';
import { generateCanvasText } from '../lib/canvasTextGeneration';
import { clampText, sanitizeReferenceText } from '../lib/referenceSanitizer';

const FORMAT_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'carousel', label: 'Carrossel' },
  { value: 'thread', label: 'Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'reel_script', label: 'Roteiro Reels' },
  { value: 'stories', label: 'Stories' },
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
  topic?: string;
  aspectRatio?: string;
  noText?: boolean;
  preserveFace?: boolean;
  isGenerating?: boolean;
  generationStep?: GenerationStep;
  clientId?: string;
  onUpdateData?: (data: Partial<GeneratorNodeData>) => void;
  onDelete?: () => void;
  onCreateOutput?: (data: { type: 'text' | 'image'; content: string; imageUrl?: string; format: string; platform: string; topic?: string }) => void;
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

  // Read connected attachment nodes. Prefer unified fields (extractedContent/textContent/url) when available.
  const getConnectedAttachments = useCallback((): AttachmentOutput[] => {
    const edges = getEdges();
    const incomingEdges = edges.filter(e => e.target === id);
    
    const attachments: AttachmentOutput[] = [];
    
    for (const edge of incomingEdges) {
      const sourceNode = getNode(edge.source);
      if (sourceNode?.type === 'attachment') {
        const d: any = sourceNode.data || {};

        // If user pasted a URL but didn't extract yet, keep a sentinel so we can block generation with a clear message.
        if (d.activeTab === 'link' && d.url && !d.extractedContent && !d.output?.content) {
          attachments.push({
            type: 'text',
            content: '',
            fileName: d.title || d.url,
            transcription: '',
            analysis: { unextractedUrl: d.url },
          });
          continue;
        }

        if (typeof d.extractedContent === 'string' && d.extractedContent.trim()) {
          attachments.push({
            type: 'text',
            content: d.extractedContent,
            fileName: d.title,
            images: d.extractedImages,
            imageCount: Array.isArray(d.extractedImages) ? d.extractedImages.length : undefined,
          });
          continue;
        }

        if (typeof d.textContent === 'string' && d.textContent.trim()) {
          attachments.push({
            type: 'text',
            content: d.textContent,
          });
          continue;
        }

        if (d.output) {
          attachments.push(d.output as AttachmentOutput);
          continue;
        }
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

    // Block if there is a connected link without extraction (preferred behavior)
    const hasUnextractedUrl = attachments.some((a) => (a as any)?.analysis?.unextractedUrl);
    if (hasUnextractedUrl) {
      toast({
        title: 'Extração pendente',
        description: 'Extraia o link no anexo antes de gerar (para evitar conteúdo genérico).',
        variant: 'destructive',
      });
      return;
    }

    // Start generation with step tracking
    data.onUpdateData?.({ isGenerating: true, generationStep: 'analyzing' });

    try {
      // Simulate analyzing step
      await new Promise(resolve => setTimeout(resolve, 500));
      data.onUpdateData?.({ generationStep: 'generating' });

      let textResult: string | null = null;
      let imageResultUrl: string | null = null;

      if (generationType === 'text') {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('Usuário não autenticado');

        const topic = data.topic?.trim();

        // GeneratorNode não tem o mesmo grafo rico do Canvas; aqui concatenamos inputs simples.
        const materialRaw = attachments
          .map((att) => {
            if (att.type === 'text') return att.content || '';
            if (att.type === 'image') return att.transcription || att.analysis || '';
            // youtube/video/audio: prefer transcription when available
            return (att.transcription as any) || (att.analysis as any) || att.content || '';
          })
          .filter(Boolean)
          .join('\n\n');

        const material = clampText(sanitizeReferenceText(materialRaw), 12000);

        if (!material.trim()) {
          toast({
            title: 'Conteúdo vazio',
            description: 'O anexo não tem texto/transcrição. Extraia o link ou adicione texto antes de gerar.',
            variant: 'destructive',
          });
          data.onUpdateData?.({ isGenerating: false, generationStep: 'idle' });
          return;
        }

        const requestParts: string[] = [];
        if (topic) {
          requestParts.push(
            `Tema obrigatório:\n${topic}\n\nRegras de aderência:\n- O conteúdo precisa ser claramente sobre esse tema.\n- Se o material não sustentar o tema, diga isso explicitamente e peça a fonte correta.\n- Não invente dados/números; se não constar, use linguagem condicional.`
          );
        }
        requestParts.push(`Material de referência (use como fonte principal):\n${material}`);
        if (normalizeCanvasFormat(data.format) === 'carousel') {
          requestParts.push('Estrutura: carrossel de 7–10 slides; 1 ideia por slide; gancho no slide 1; CTA no final.\nRequisito de tema: mencione explicitamente o tema no Slide 1 e conecte a tese no Slide 2.');
        }
        if ((data.platform || 'instagram') === 'twitter' && normalizeCanvasFormat(data.format) === 'thread') {
          requestParts.push('Regras: cada tweet deve respeitar 280 caracteres.');
        }
        const request = requestParts.join('\n\n');
        const platform = data.platform || 'instagram';

        textResult = await generateCanvasText({
          clientId: data.clientId || '',
          request,
          format: data.format,
          platform,
          accessToken,
          onChunk: (chunkCount) => {
            if (chunkCount % 10 === 0) {
              data.onUpdateData?.({ generationStep: 'generating' });
            }
          },
        });
      } else {
        // Imagem continua via generate-content-v2 (já usa regras unificadas no backend)
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
              format: toGenerateContentV2Format(normalizeCanvasFormat(data.format)),
              platform: data.platform || 'instagram',
              aspectRatio: data.aspectRatio || '1:1',
              noText: data.noText || false,
              preserveFace: data.preserveFace || false,
            }
          }
        });
        if (error) throw error;
        imageResultUrl = result.imageUrl || result.image_url || null;
      }

      data.onUpdateData?.({ generationStep: 'saving' });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Create output node instead of showing inline
      if (data.onCreateOutput) {
        if (generationType === 'text') {
          data.onCreateOutput({
            type: 'text',
            content: textResult || '',
            format: normalizeCanvasFormat(data.format),
            platform: data.platform || 'instagram',
            topic: data.topic?.trim() || undefined,
          });
        } else {
          data.onCreateOutput({
            type: 'image',
            content: imageResultUrl || '',
            imageUrl: imageResultUrl || '',
            format: 'image',
            platform: data.platform || 'instagram',
            topic: data.topic?.trim() || undefined,
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
      "w-80 shadow-lg transition-all",
      selected ? 'ring-2 ring-primary' : '',
      isGenerating && 'ring-2 ring-primary/50 animate-pulse'
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

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
              isGenerating ? "bg-primary animate-pulse" : "bg-gradient-to-br from-blue-500 to-indigo-600"
            )}>
              <StepIcon />
            </div>
            <span>Gerador</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {connectedCount > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                {connectedCount}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
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

            <div className="space-y-1">
              <Label className="text-xs">Tema/Objetivo (opcional)</Label>
              <Input
                value={data.topic || ''}
                onChange={(e) => data.onUpdateData?.({ topic: e.target.value })}
                placeholder='Ex.: "ETH em 100k"'
                className="h-8 text-xs"
                disabled={isGenerating}
              />
            </div>

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
