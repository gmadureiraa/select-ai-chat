import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Paperclip, X, Link2, FileText, Upload, Image as ImageIcon, Video, 
  Music, FileJson, Eye, Loader2, CheckCircle2, Expand, ChevronLeft,
  ChevronRight, Instagram, AlertCircle, RefreshCw, Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TranscriptionModal } from '../components/TranscriptionModal';

// Expanded interface with Instagram support
export interface AttachmentOutput {
  type: 'image' | 'video' | 'audio' | 'text' | 'url' | 'instagram' | 'youtube';
  content: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
  imageBase64?: string;
  fileName?: string;
  mimeType?: string;
  // Instagram-specific fields
  extractedImages?: string[];
  caption?: string;
  imageCount?: number;
  videoUrl?: string;
  // Error state
  extractionFailed?: boolean;
  errorMessage?: string;
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
  const [showTranscription, setShowTranscription] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { toast } = useToast();

  const output = data.output;
 
  // Detect URL type - with specific Instagram validation
  const detectUrlType = (url: string): 'youtube' | 'instagram' | 'instagram-profile' | 'generic' => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    
    // Instagram: only accept post (/p/) or reel (/reel/) URLs
    if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/') || url.includes('instagr.am/p/')) {
      return 'instagram';
    }
    
    // Instagram profile URLs - we can't extract these
    if (url.includes('instagram.com/') && !url.includes('/p/') && !url.includes('/reel/')) {
      return 'instagram-profile';
    }
    
    return 'generic';
  };

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    setIsProcessing(true);
    const urlType = detectUrlType(urlInput);
    
    try {
      // Handle Instagram profile URLs - NOT supported
      if (urlType === 'instagram-profile') {
        toast({ 
          title: 'Link de perfil não suportado', 
          description: 'Cole o link de um POST ou REEL específico do Instagram (ex: instagram.com/p/xxx ou instagram.com/reel/xxx)',
          variant: 'destructive' 
        });
        setIsProcessing(false);
        setProcessStatus('');
        return;
      }
      
      if (urlType === 'youtube') {
        setProcessStatus('Extraindo YouTube...');
        console.log('[AttachmentNode] Extracting YouTube:', urlInput);
        
        const { data: result, error } = await supabase.functions.invoke('extract-youtube', {
          body: { url: urlInput }
        });
        
        if (error) throw error;
        
        console.log('[AttachmentNode] YouTube result:', result);
        
        data.onUpdateData?.({
          output: {
            type: 'youtube',
            content: urlInput,
            transcription: result?.transcript || result?.description || '',
            fileName: result?.title || 'YouTube Video'
          }
        });
        
        toast({ title: 'YouTube extraído!', description: result?.title });
        
      } else if (urlType === 'instagram') {
        setProcessStatus('Verificando link...');
        console.log('[AttachmentNode] Extracting Instagram:', urlInput);
        
        const isReel = urlInput.includes('/reel/');
        
        setProcessStatus(isReel ? 'Extraindo Reels...' : 'Extraindo imagens...');
        
        const { data: result, error } = await supabase.functions.invoke('extract-instagram', {
          body: { url: urlInput }
        });
        
        console.log('[AttachmentNode] Instagram result:', result, 'Error:', error);
        
        // Handle extraction failure CLEARLY
        if (error || result?.error) {
          const errorMsg = result?.error || error?.message || 'Erro desconhecido';
          console.error('[AttachmentNode] Instagram extraction failed:', errorMsg);
          
          toast({ 
            title: 'Não foi possível extrair', 
            description: 'Este post pode ser privado ou indisponível. O link NÃO será aceito.',
            variant: 'destructive' 
          });
          
          // DO NOT accept the link - show error state
          data.onUpdateData?.({
            output: {
              type: 'instagram',
              content: urlInput,
              extractionFailed: true,
              errorMessage: errorMsg,
              fileName: 'Falha na extração'
            }
          });
          
          return;
        }
        
        const images = result.images || [];
        const caption = result.caption || '';
        
        if (images.length === 0) {
          toast({ 
            title: 'Nenhuma imagem encontrada', 
            description: 'O post pode estar vazio ou inacessível.',
            variant: 'destructive' 
          });
          return;
        }
        
        // For Reels, try to transcribe the video
        let transcription = '';
        if (isReel && images.length > 0) {
          setProcessStatus('Transcrevendo Reels...');
          try {
            console.log('[AttachmentNode] Transcribing Reels video...');
            const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-media', {
              body: { url: images[0], fileName: 'reels.mp4' }
            });
            
            if (!transcribeError && transcribeData?.text) {
              transcription = transcribeData.text;
              console.log('[AttachmentNode] Reels transcription success:', transcription.substring(0, 100));
            } else {
              console.warn('[AttachmentNode] Reels transcription failed:', transcribeError);
            }
          } catch (e) {
            console.warn('[AttachmentNode] Transcription error:', e);
          }
        }
        
        // SUCCESS - Update with extracted data
        data.onUpdateData?.({
          output: {
            type: 'instagram',
            content: caption,
            extractedImages: images,
            caption: caption,
            transcription: transcription || undefined,
            imageCount: images.length,
            videoUrl: isReel ? images[0] : undefined,
            fileName: isReel ? 'Reels' : `Carrossel (${images.length} ${images.length === 1 ? 'imagem' : 'imagens'})`
          }
        });
        
        toast({ 
          title: `Instagram importado!`, 
          description: `${images.length} mídia(s) extraída(s)${transcription ? ' + transcrição' : ''}`
        });
        
      } else {
        // Generic URL - warn that it might not work well
        setProcessStatus('Extraindo conteúdo...');
        console.log('[AttachmentNode] Generic URL scraping:', urlInput);
        
        const { data: result, error } = await supabase.functions.invoke('scrape-newsletter', {
          body: { url: urlInput }
        });
        
        if (error) throw error;
        
        const extractedContent = result?.content || result?.text || '';
        
        if (!extractedContent || extractedContent.length < 50) {
          toast({ 
            title: 'Pouco conteúdo extraído', 
            description: 'Este site pode ter proteções contra scraping.',
            variant: 'destructive' 
          });
        }
        
        data.onUpdateData?.({
          output: {
            type: 'url',
            content: urlInput,
            transcription: extractedContent,
            fileName: result?.title || 'Web Content'
          }
        });
        
        toast({ title: 'Conteúdo extraído!' });
      }
    } catch (error) {
      console.error('[AttachmentNode] Error extracting URL:', error);
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
        
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          
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
        const type = fileType.startsWith('video/') ? 'video' : 'audio';
        setProcessStatus(`Fazendo upload de ${type === 'video' ? 'vídeo' : 'áudio'}...`);
        
        console.log('[AttachmentNode] Uploading media file:', file.name, fileType);
        
        // Upload to content-media bucket (has proper RLS)
        const fileName = `canvas/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('content-media')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error('[AttachmentNode] Upload error:', uploadError);
          throw new Error(`Falha no upload: ${uploadError.message}`);
        }
        
        console.log('[AttachmentNode] Upload successful:', fileName);
        
        const { data: { publicUrl } } = supabase.storage
          .from('content-media')
          .getPublicUrl(fileName);
        
        console.log('[AttachmentNode] Public URL:', publicUrl);
        
        setProcessStatus('Transcrevendo...');
        
        const { data: transcription, error: transcribeError } = await supabase.functions.invoke('transcribe-media', {
          body: { 
            url: publicUrl,
            fileName: file.name,
            mimeType: fileType 
          }
        });
        
        console.log('[AttachmentNode] Transcription result:', transcription, 'Error:', transcribeError);
        
        const transcribedText = transcription?.text || transcription?.transcript;
        
        data.onUpdateData?.({
          output: {
            type,
            content: publicUrl,
            transcription: transcribeError ? undefined : transcribedText,
            fileName: file.name,
            mimeType: fileType
          }
        });
        
        if (transcribedText) {
          toast({ 
            title: `${type === 'video' ? 'Vídeo' : 'Áudio'} transcrito!`,
            description: `${transcribedText.split(' ').length} palavras extraídas`
          });
        } else {
          toast({ 
            title: `${type === 'video' ? 'Vídeo' : 'Áudio'} enviado`,
            description: 'Sem transcrição disponível',
            variant: 'destructive'
          });
        }
        
      } else {
        setProcessStatus('Fazendo upload...');
        
        const fileName = `canvas/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('content-media')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('content-media')
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
      console.error('[AttachmentNode] Error processing file:', error);
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

  const retryExtraction = useCallback(() => {
    setUrlInput(output?.content || '');
    data.onUpdateData?.({ output: undefined });
  }, [output, data]);

  const getOutputIcon = () => {
    if (!output) return <Paperclip className="h-4 w-4" />;
    
    if (output.extractionFailed) return <AlertCircle className="h-4 w-4 text-destructive" />;
    
    switch (output.type) {
      case 'image': return <ImageIcon className="h-4 w-4 text-green-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'audio': return <Music className="h-4 w-4 text-blue-500" />;
      case 'url': return <Link2 className="h-4 w-4 text-orange-500" />;
      case 'youtube': return <Play className="h-4 w-4 text-red-500" />;
      case 'instagram': return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'text': return <FileText className="h-4 w-4 text-muted-foreground" />;
      default: return <Paperclip className="h-4 w-4" />;
    }
  };

  const clearOutput = useCallback(() => {
    data.onUpdateData?.({ output: undefined });
    setUrlInput('');
    setTextInput('');
    setCurrentImageIndex(0);
  }, [data]);

  // Instagram carousel navigation
  const nextImage = () => {
    if (output?.extractedImages) {
      setCurrentImageIndex((prev) => 
        prev < output.extractedImages!.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (output?.extractedImages) {
      setCurrentImageIndex((prev) => 
        prev > 0 ? prev - 1 : output.extractedImages!.length - 1
      );
    }
  };

  return (
    <Card className={`w-80 shadow-lg ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getOutputIcon()}
            <span>Anexo</span>
            {output && (
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
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
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">{processStatus}</span>
            <span className="text-xs text-muted-foreground">Aguarde...</span>
          </div>
        ) : output ? (
          <div className="space-y-3">
            {/* EXTRACTION FAILED STATE */}
            {output.extractionFailed && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Extração falhou</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {output.errorMessage || 'Não foi possível extrair conteúdo deste link.'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={retryExtraction}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* INSTAGRAM SUCCESS STATE - Gallery */}
            {output.type === 'instagram' && !output.extractionFailed && output.extractedImages && output.extractedImages.length > 0 && (
              <div className="space-y-2">
                {/* Image gallery */}
                <div className="relative rounded-lg overflow-hidden bg-black/5">
                  <img 
                    src={output.extractedImages[currentImageIndex]} 
                    alt={`Slide ${currentImageIndex + 1}`}
                    className="w-full h-40 object-cover"
                  />
                  
                  {/* Navigation - only if multiple images */}
                  {output.extractedImages.length > 1 && (
                    <>
                      <button 
                        onClick={prevImage}
                        className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={nextImage}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      
                      {/* Counter */}
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        {currentImageIndex + 1}/{output.extractedImages.length}
                      </div>
                      
                      {/* Dots */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {output.extractedImages.map((_, idx) => (
                          <button
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                            onClick={() => setCurrentImageIndex(idx)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
                      {/* Caption preview with expand option */}
                      {output.caption && (
                        <div className="bg-pink-500/10 rounded-md p-2 space-y-1">
                          <p className="text-xs line-clamp-2 text-foreground">{output.caption}</p>
                          {output.caption.length > 80 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-6 text-[10px] gap-1 text-pink-600 hover:text-pink-700 hover:bg-pink-500/10"
                              onClick={() => setShowCaption(true)}
                            >
                              <Expand className="h-3 w-3" />
                              Ver legenda completa
                            </Button>
                          )}
                        </div>
                      )}
                
                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] bg-pink-500/20 text-pink-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Instagram className="h-3 w-3" />
                    {output.imageCount} {output.imageCount === 1 ? 'imagem' : 'imagens'}
                  </span>
                  {output.transcription && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Transcrito
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* VIDEO with player */}
            {output.type === 'video' && output.content && (
              <div className="space-y-2">
                <video 
                  src={output.content} 
                  controls 
                  className="w-full h-32 rounded-md bg-black/10"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Video className="h-4 w-4 text-purple-500" />
                  <span className="truncate">{output.fileName}</span>
                </div>
              </div>
            )}

            {/* AUDIO with player */}
            {output.type === 'audio' && output.content && (
              <div className="space-y-2">
                <audio 
                  src={output.content} 
                  controls 
                  className="w-full"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Music className="h-4 w-4 text-blue-500" />
                  <span className="truncate">{output.fileName}</span>
                </div>
              </div>
            )}
            
            {/* IMAGE preview */}
            {output.type === 'image' && output.imageBase64 && (
              <img 
                src={output.imageBase64} 
                alt="Preview" 
                className="w-full h-32 object-cover rounded-md"
              />
            )}
            
            {/* YOUTUBE preview */}
            {output.type === 'youtube' && (
              <div className="bg-red-500/10 rounded-md p-3 flex items-center gap-2">
                <Play className="h-5 w-5 text-red-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{output.fileName}</span>
                  <span className="text-[10px] text-muted-foreground">YouTube</span>
                </div>
              </div>
            )}
            
            {/* GENERIC URL preview */}
            {output.type === 'url' && (
              <div className="bg-orange-500/10 rounded-md p-3 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-orange-500" />
                <span className="text-xs truncate">{output.content}</span>
              </div>
            )}
            
            {/* TEXT preview */}
            {output.type === 'text' && (
              <div className="bg-muted rounded-md p-2">
                <p className="text-xs line-clamp-3">{output.content}</p>
              </div>
            )}
            
            {/* Transcription preview - for all types that have it */}
            {output.transcription && !output.extractionFailed && (
              <div className="bg-blue-500/10 rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                  <FileText className="h-3 w-3" />
                  Transcrição
                </div>
                <p className="text-xs line-clamp-2 text-muted-foreground">
                  {output.transcription}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-[10px] gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-500/20"
                  onClick={() => setShowTranscription(true)}
                >
                  <Expand className="h-3 w-3" />
                  Ver transcrição completa
                </Button>
              </div>
            )}

            {/* Analysis indicator */}
            {output.analysis && (
              <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                <FileJson className="h-3 w-3" /> Análise de estilo
              </span>
            )}

            {/* Transcription modal */}
            {output.transcription && (
              <TranscriptionModal
                open={showTranscription}
                onOpenChange={setShowTranscription}
                transcription={output.transcription}
                fileName={output.fileName}
              />
            )}
            
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
                placeholder="YouTube, Instagram, ou URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="text-xs h-8"
              />
              <div className="flex gap-1 text-[10px] text-muted-foreground">
                <span className="bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded">YouTube</span>
                <span className="bg-pink-500/10 text-pink-600 px-1.5 py-0.5 rounded">Instagram</span>
                <span className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded">Web</span>
              </div>
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
      
      {/* Transcription Modal */}
      <TranscriptionModal
        open={showTranscription}
        onOpenChange={setShowTranscription}
        transcription={output?.transcription || ""}
        fileName={output?.fileName}
      />
      
      {/* Caption Modal for Instagram */}
      <TranscriptionModal
        open={showCaption}
        onOpenChange={setShowCaption}
        transcription={output?.caption || ""}
        fileName="Legenda do Instagram"
      />
      
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
