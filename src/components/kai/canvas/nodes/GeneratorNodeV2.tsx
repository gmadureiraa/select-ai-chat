import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, X, FileText, Image, Loader2, Link2, 
  Download, Copy, CheckCircle2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AttachmentOutput } from './AttachmentNodeV2';

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

export interface GeneratorNodeV2Data {
  type: 'text' | 'image';
  format?: string;
  platform?: string;
  aspectRatio?: string;
  noText?: boolean;
  preserveFace?: boolean;
  result?: {
    type: 'text' | 'image';
    content: string;
    imageUrl?: string;
  };
  isGenerating?: boolean;
  onUpdateData?: (data: Partial<GeneratorNodeV2Data>) => void;
  onDelete?: () => void;
}

const GeneratorNodeV2Component: React.FC<NodeProps<GeneratorNodeV2Data>> = ({ 
  id,
  data, 
  selected 
}) => {
  const { getEdges, getNode } = useReactFlow();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const generationType = data.type || 'text';
  const isGenerating = data.isGenerating || false;

  // Count connected attachments
  const getConnectedAttachments = useCallback((): AttachmentOutput[] => {
    const edges = getEdges();
    const incomingEdges = edges.filter(e => e.target === id);
    
    const attachments: AttachmentOutput[] = [];
    
    for (const edge of incomingEdges) {
      const sourceNode = getNode(edge.source);
      if (sourceNode?.type === 'attachmentV2' && sourceNode.data?.output) {
        attachments.push(sourceNode.data.output as AttachmentOutput);
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

    data.onUpdateData?.({ isGenerating: true, result: undefined });

    try {
      const { data: result, error } = await supabase.functions.invoke('generate-content-v2', {
        body: {
          type: generationType,
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

      if (generationType === 'text') {
        data.onUpdateData?.({
          isGenerating: false,
          result: {
            type: 'text',
            content: result.content || result.text || ''
          }
        });
      } else {
        data.onUpdateData?.({
          isGenerating: false,
          result: {
            type: 'image',
            content: '',
            imageUrl: result.imageUrl || result.image_url || ''
          }
        });
      }

      toast({ title: 'Conteúdo gerado com sucesso!' });
    } catch (error) {
      console.error('Generation error:', error);
      data.onUpdateData?.({ isGenerating: false });
      toast({
        title: 'Erro ao gerar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  }, [generationType, data, getConnectedAttachments, toast]);

  const handleCopy = useCallback(() => {
    if (data.result?.content) {
      navigator.clipboard.writeText(data.result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copiado!' });
    }
  }, [data.result, toast]);

  const handleDownload = useCallback(() => {
    if (data.result?.imageUrl) {
      const link = document.createElement('a');
      link.href = data.result.imageUrl;
      link.download = `generated-${Date.now()}.png`;
      link.click();
    }
  }, [data.result]);

  return (
    <Card className={`w-80 shadow-lg ${selected ? 'ring-2 ring-primary' : ''}`}>
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
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Gerador</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {connectedCount > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                <Link2 className="h-3 w-3 inline mr-1" />
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
        {/* Type selector */}
        <div className="flex gap-2">
          <Button
            variant={generationType === 'text' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => data.onUpdateData?.({ type: 'text', result: undefined })}
          >
            <FileText className="h-3 w-3 mr-1" />
            Texto
          </Button>
          <Button
            variant={generationType === 'image' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => data.onUpdateData?.({ type: 'image', result: undefined })}
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
                />
                <Label htmlFor="noText" className="text-xs">Sem texto</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="preserveFace"
                  checked={data.preserveFace || false}
                  onCheckedChange={(checked) => data.onUpdateData?.({ preserveFace: !!checked })}
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
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar {generationType === 'text' ? 'Texto' : 'Imagem'}
            </>
          )}
        </Button>

        {/* Result display */}
        {data.result && (
          <div className="border rounded-lg overflow-hidden">
            {data.result.type === 'text' ? (
              <div className="p-2 space-y-2">
                <div className="max-h-40 overflow-y-auto">
                  <p className="text-xs whitespace-pre-wrap">{data.result.content}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {data.result.imageUrl && (
                  <img 
                    src={data.result.imageUrl} 
                    alt="Generated" 
                    className="w-full h-auto"
                  />
                )}
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleDownload}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Baixar
                  </Button>
                </div>
              </div>
            )}
          </div>
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

export const GeneratorNodeV2 = memo(GeneratorNodeV2Component);
