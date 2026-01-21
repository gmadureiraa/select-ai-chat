import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Paperclip, X, Link2, FileText, Upload, Image, Video, 
  Music, FileJson, Eye, Loader2, CheckCircle2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AttachmentOutput {
  type: 'image' | 'video' | 'audio' | 'text' | 'url';
  content: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
  imageBase64?: string;
  fileName?: string;
  mimeType?: string;
}

export interface AttachmentNodeData {
  output?: AttachmentOutput;
  onUpdateData?: (data: Partial<AttachmentNodeData>) => void;
  onDelete?: () => void;
}

const AttachmentNodeComponent: React.FC<NodeProps<AttachmentNodeData>> = ({ 
  data, 
  selected 
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'text' | 'file'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const { toast } = useToast();

  const output = data.output;

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    setIsProcessing(true);
    setProcessStatus('Extraindo conteúdo...');
    
    try {
      // Detect URL type and extract content
      const isYoutube = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');
      
      if (isYoutube) {
        const { data: result, error } = await supabase.functions.invoke('extract-youtube', {
          body: { url: urlInput }
        });
        
        if (error) throw error;
        
        data.onUpdateData?.({
          output: {
            type: 'url',
            content: urlInput,
            transcription: result?.transcript || result?.description || '',
            fileName: result?.title || 'YouTube Video'
          }
        });
      } else {
        // Generic URL scraping
        const { data: result, error } = await supabase.functions.invoke('scrape-newsletter', {
          body: { url: urlInput }
        });
        
        if (error) throw error;
        
        data.onUpdateData?.({
          output: {
            type: 'url',
            content: urlInput,
            transcription: result?.content || result?.text || '',
            fileName: result?.title || 'Web Content'
          }
        });
      }
      
      toast({ title: 'Conteúdo extraído com sucesso!' });
    } catch (error) {
      console.error('Error extracting URL:', error);
      toast({ 
        title: 'Erro ao extrair conteúdo', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  }, [urlInput, data, toast]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    
    data.onUpdateData?.({
      output: {
        type: 'text',
        content: textInput,
      }
    });
    
    toast({ title: 'Texto adicionado!' });
  }, [textInput, data, toast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const fileType = file.type;
    
    try {
      if (fileType.startsWith('image/')) {
        setProcessStatus('Processando imagem...');
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          
          // Analyze image
          setProcessStatus('Analisando imagem...');
          try {
            const { data: analysis, error } = await supabase.functions.invoke('analyze-image-complete', {
              body: { imageUrl: base64, analysisType: 'full' }
            });
            
            data.onUpdateData?.({
              output: {
                type: 'image',
                content: base64,
                imageBase64: base64,
                analysis: error ? undefined : analysis,
                fileName: file.name,
                mimeType: fileType
              }
            });
          } catch {
            data.onUpdateData?.({
              output: {
                type: 'image',
                content: base64,
                imageBase64: base64,
                fileName: file.name,
                mimeType: fileType
              }
            });
          }
          
          setIsProcessing(false);
          setProcessStatus('');
          toast({ title: 'Imagem adicionada!' });
        };
        reader.readAsDataURL(file);
        
      } else if (fileType.startsWith('video/') || fileType.startsWith('audio/')) {
        setProcessStatus('Fazendo upload...');
        
        // Upload file first
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('client-files')
          .getPublicUrl(fileName);
        
        setProcessStatus('Transcrevendo...');
        
        // Transcribe - using correct parameter names expected by edge function
        const { data: transcription, error: transcribeError } = await supabase.functions.invoke('transcribe-media', {
          body: { 
            url: publicUrl,
            fileName: file.name,
            mimeType: fileType 
          }
        });
        
        const type = fileType.startsWith('video/') ? 'video' : 'audio';
        
        data.onUpdateData?.({
          output: {
            type,
            content: publicUrl,
            transcription: transcribeError ? undefined : (transcription?.text || transcription?.transcript),
            fileName: file.name,
            mimeType: fileType
          }
        });
        
        toast({ title: `${type === 'video' ? 'Vídeo' : 'Áudio'} processado!` });
        
      } else {
        // Generic file - just store reference
        setProcessStatus('Fazendo upload...');
        
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('client-files')
          .getPublicUrl(fileName);
        
        data.onUpdateData?.({
          output: {
            type: 'text',
            content: `Arquivo: ${file.name}\nURL: ${publicUrl}`,
            fileName: file.name,
            mimeType: fileType
          }
        });
        
        toast({ title: 'Arquivo enviado!' });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({ 
        title: 'Erro ao processar arquivo', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  }, [data, toast]);

  const getOutputIcon = () => {
    if (!output) return <Paperclip className="h-4 w-4" />;
    
    switch (output.type) {
      case 'image': return <Image className="h-4 w-4 text-green-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'audio': return <Music className="h-4 w-4 text-blue-500" />;
      case 'url': return <Link2 className="h-4 w-4 text-orange-500" />;
      case 'text': return <FileText className="h-4 w-4 text-muted-foreground" />;
      default: return <Paperclip className="h-4 w-4" />;
    }
  };

  const clearOutput = useCallback(() => {
    data.onUpdateData?.({ output: undefined });
    setUrlInput('');
    setTextInput('');
  }, [data]);

  return (
    <Card className={`w-72 shadow-lg ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getOutputIcon()}
            <span>Anexo</span>
            {output && (
              <span className="text-xs text-muted-foreground">
                ({output.fileName || output.type})
              </span>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={data.onDelete}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{processStatus}</span>
          </div>
        ) : output ? (
          <div className="space-y-2">
            {/* Preview */}
            {output.type === 'image' && output.imageBase64 && (
              <img 
                src={output.imageBase64} 
                alt="Preview" 
                className="w-full h-32 object-cover rounded-md"
              />
            )}
            
            {output.type === 'video' && (
              <div className="bg-purple-500/10 rounded-md p-3 flex items-center gap-2">
                <Video className="h-5 w-5 text-purple-500" />
                <span className="text-xs truncate">{output.fileName}</span>
              </div>
            )}
            
            {output.type === 'audio' && (
              <div className="bg-blue-500/10 rounded-md p-3 flex items-center gap-2">
                <Music className="h-5 w-5 text-blue-500" />
                <span className="text-xs truncate">{output.fileName}</span>
              </div>
            )}
            
            {output.type === 'url' && (
              <div className="bg-orange-500/10 rounded-md p-3 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-orange-500" />
                <span className="text-xs truncate">{output.content}</span>
              </div>
            )}
            
            {output.type === 'text' && (
              <div className="bg-muted rounded-md p-2">
                <p className="text-xs line-clamp-3">{output.content}</p>
              </div>
            )}
            
            {/* Status indicators */}
            <div className="flex flex-wrap gap-1">
              {output.analysis && (
                <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <FileJson className="h-3 w-3" /> Análise
                </span>
              )}
              {output.transcription && (
                <span className="text-[10px] bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Transcrição
                </span>
              )}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs"
              onClick={clearOutput}
            >
              Limpar
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid grid-cols-3 h-8">
              <TabsTrigger value="file" className="text-xs">
                <Upload className="h-3 w-3 mr-1" />
                Arquivo
              </TabsTrigger>
              <TabsTrigger value="link" className="text-xs">
                <Link2 className="h-3 w-3 mr-1" />
                Link
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Texto
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="mt-2">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Clique ou arraste</span>
                <span className="text-[10px] text-muted-foreground">Imagem, vídeo, áudio...</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                />
              </label>
            </TabsContent>
            
            <TabsContent value="link" className="mt-2 space-y-2">
              <Input
                placeholder="Cole a URL aqui..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="text-xs h-8"
              />
              <Button 
                size="sm" 
                className="w-full text-xs h-7"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
              >
                <Eye className="h-3 w-3 mr-1" />
                Extrair Conteúdo
              </Button>
            </TabsContent>
            
            <TabsContent value="text" className="mt-2 space-y-2">
              <Textarea
                placeholder="Digite seu texto, briefing, instruções..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="text-xs min-h-[60px] resize-none"
              />
              <Button 
                size="sm" 
                className="w-full text-xs h-7"
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </TabsContent>
          </Tabs>
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

export const AttachmentNode = memo(AttachmentNodeComponent);
