import React, { useState, useCallback, memo, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Paperclip, X, Link2, FileText, Upload, Image as ImageIcon, Video, 
  Music, Eye, Loader2, CheckCircle2, Expand, ChevronLeft,
  ChevronRight, Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TranscriptionModal } from '../components/TranscriptionModal';
import { transcribeImagesChunked } from '@/lib/transcribeImages';
import { cn } from '@/lib/utils';

// Simplified interface - MVP focused
export interface AttachmentOutput {
  type: 'image' | 'video' | 'audio' | 'text' | 'youtube' | 'library';
  content: string;
  transcription?: string;
  imageBase64?: string;
  fileName?: string;
  mimeType?: string;
  analysis?: Record<string, unknown>;
  // Multi-image support
  images?: string[];
  imageCount?: number;
  // Library-specific
  libraryTitle?: string;
  libraryImages?: string[];
  libraryId?: string;
  libraryPlatform?: string;
}

export interface AttachmentNodeData {
  output?: AttachmentOutput;
  onUpdateData?: (data: Partial<AttachmentNodeData>) => void;
  onDelete?: () => void;
}

const MAX_IMAGES = 15;

const AttachmentNodeComponent: React.FC<NodeProps<AttachmentNodeData>> = ({ 
  data, 
  selected 
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'link' | 'text'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [showTranscription, setShowTranscription] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const output = data.output;

  // ONLY YouTube is accepted
  const isYoutubeUrl = (url: string): boolean => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    setIsProcessing(true);
    
    try {
      // ONLY YouTube accepted
      if (!isYoutubeUrl(urlInput)) {
        toast({ 
          title: 'Link não suportado', 
          description: 'Apenas links do YouTube são aceitos. Use o upload para outros conteúdos.',
          variant: 'destructive' 
        });
        setIsProcessing(false);
        setProcessStatus('');
        return;
      }

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
      setUrlInput('');
      
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
    setTextInput('');
  }, [textInput, data, toast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    
    try {
      // Check if all files are images for multi-image support
      const allImages = Array.from(files).every(f => f.type.startsWith('image/'));
      
      if (allImages && files.length > 1) {
        // Multi-image upload with transcription
        if (files.length > MAX_IMAGES) {
          toast({ 
            title: 'Limite de imagens', 
            description: `Máximo de ${MAX_IMAGES} imagens por vez. Você selecionou ${files.length}.`,
            variant: 'destructive' 
          });
          setIsProcessing(false);
          return;
        }

        const imageUrls: string[] = [];
        const totalFiles = files.length;

        // Upload all images first
        for (let i = 0; i < totalFiles; i++) {
          const file = files[i];
          setProcessStatus(`Enviando imagem ${i + 1}/${totalFiles}...`);
          
          const fileName = `canvas/${Date.now()}-${i}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('content-media')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('[AttachmentNode] Upload error:', uploadError);
            continue;
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('content-media')
            .getPublicUrl(fileName);
          
          imageUrls.push(publicUrl);
        }

        if (imageUrls.length === 0) {
          throw new Error('Nenhuma imagem foi enviada com sucesso');
        }

        // Transcribe all images
        setProcessStatus(`Transcrevendo ${imageUrls.length} imagens...`);
        
        let transcription = '';
        try {
          const { data: userData } = await supabase.auth.getUser();
          transcription = await transcribeImagesChunked(imageUrls, {
            userId: userData?.user?.id,
            chunkSize: 1
          });
        } catch (transcribeError) {
          console.warn('[AttachmentNode] Transcription error:', transcribeError);
        }

        data.onUpdateData?.({
          output: {
            type: 'image',
            content: imageUrls[0],
            images: imageUrls,
            imageCount: imageUrls.length,
            transcription: transcription || undefined,
            fileName: `${imageUrls.length} imagens`
          }
        });

        toast({ 
          title: `${imageUrls.length} imagens processadas!`,
          description: transcription ? `${transcription.split(' ').length} palavras extraídas` : undefined
        });

      } else {
        // Single file upload
        const file = files[0];
        const fileType = file.type;

        if (fileType.startsWith('image/')) {
          setProcessStatus('Processando imagem...');
          
          // Upload to storage
          const fileName = `canvas/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('content-media')
            .upload(fileName, file);
          
          let imageUrl = '';
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('content-media')
              .getPublicUrl(fileName);
            imageUrl = publicUrl;
          }

          // Also get base64 for preview
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            
            // Transcribe single image
            setProcessStatus('Transcrevendo imagem...');
            let transcription = '';
            try {
              const { data: userData } = await supabase.auth.getUser();
              transcription = await transcribeImagesChunked([imageUrl || base64], {
                userId: userData?.user?.id,
                chunkSize: 1
              });
            } catch (e) {
              console.warn('[AttachmentNode] Transcription error:', e);
            }
            
            data.onUpdateData?.({
              output: {
                type: 'image',
                content: imageUrl || base64,
                imageBase64: base64,
                transcription: transcription || undefined,
                fileName: file.name,
                mimeType: fileType,
                images: [imageUrl || base64],
                imageCount: 1
              }
            });
            
            setIsProcessing(false);
            setProcessStatus('');
            toast({ 
              title: 'Imagem processada!',
              description: transcription ? `${transcription.split(' ').length} palavras extraídas` : undefined
            });
          };
          reader.readAsDataURL(file);
          return; // Exit early, onload handles the rest
          
        } else if (fileType.startsWith('video/') || fileType.startsWith('audio/')) {
          const type = fileType.startsWith('video/') ? 'video' : 'audio';
          setProcessStatus(`Enviando ${type === 'video' ? 'vídeo' : 'áudio'}...`);
          
          console.log('[AttachmentNode] Uploading media file:', file.name, fileType);
          
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
          toast({ 
            title: 'Tipo de arquivo não suportado',
            description: 'Use imagens, vídeos ou áudios.',
            variant: 'destructive'
          });
        }
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [data, toast]);

  const getOutputIcon = () => {
    if (!output) return <Paperclip className="h-4 w-4" />;
    
    switch (output.type) {
      case 'image': return <ImageIcon className="h-4 w-4 text-green-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'audio': return <Music className="h-4 w-4 text-blue-500" />;
      case 'youtube': return <Play className="h-4 w-4 text-red-500" />;
      case 'text': return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'library': return <FileText className="h-4 w-4 text-primary" />;
      default: return <Paperclip className="h-4 w-4" />;
    }
  };

  const clearOutput = useCallback(() => {
    data.onUpdateData?.({ output: undefined });
    setUrlInput('');
    setTextInput('');
    setCurrentImageIndex(0);
  }, [data]);

  // Image gallery navigation - works for both images and libraryImages
  const currentImages = output?.images || output?.libraryImages || [];
  
  const nextImage = () => {
    if (currentImages.length > 0) {
      setCurrentImageIndex((prev) => 
        prev < currentImages.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (currentImages.length > 0) {
      setCurrentImageIndex((prev) => 
        prev > 0 ? prev - 1 : currentImages.length - 1
      );
    }
  };

  // Library content gets wider card for readability
  const isLibraryContent = output?.type === 'library';
  const cardWidth = isLibraryContent ? 'w-96' : 'w-80';

  return (
    <Card className={cn(
      cardWidth, 
      "shadow-lg rounded-xl transition-all duration-200",
      selected ? 'ring-2 ring-primary shadow-primary/10' : 'hover:shadow-xl'
    )}>
      <CardHeader className={cn(
        "pb-2 rounded-t-xl border-b",
        "bg-purple-500/5 dark:bg-purple-500/10",
        "border-purple-500/15 dark:border-purple-500/20"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-purple-500/20 flex items-center justify-center">
              {getOutputIcon()}
            </div>
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
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
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
            {/* IMAGE(S) preview with gallery */}
            {output.type === 'image' && output.images && output.images.length > 0 && (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden bg-black/5">
                  <img 
                    src={output.images[currentImageIndex]} 
                    alt={`Imagem ${currentImageIndex + 1}`}
                    className="w-full h-40 object-cover"
                  />
                  
                  {/* Navigation - only if multiple images */}
                  {output.images.length > 1 && (
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
                        {currentImageIndex + 1}/{output.images.length}
                      </div>
                      
                      {/* Dots */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {output.images.slice(0, 10).map((_, idx) => (
                          <button
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                            onClick={() => setCurrentImageIndex(idx)}
                          />
                        ))}
                        {output.images.length > 10 && (
                          <span className="text-white text-[8px]">+{output.images.length - 10}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Image count badge */}
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {output.imageCount} {output.imageCount === 1 ? 'imagem' : 'imagens'}
                  </span>
                  {output.transcription && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Transcrito
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Fallback for single image without gallery */}
            {output.type === 'image' && output.imageBase64 && (!output.images || output.images.length === 0) && (
              <img 
                src={output.imageBase64} 
                alt="Preview" 
                className="w-full h-32 object-cover rounded-md"
              />
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
            
            {/* TEXT preview */}
            {output.type === 'text' && (
              <div className="bg-muted rounded-md p-2">
                <p className="text-xs line-clamp-3">{output.content}</p>
              </div>
            )}

            {/* LIBRARY content - with full view option */}
            {output.type === 'library' && (
              <div className="space-y-2">
                {/* Title badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{output.libraryTitle || output.fileName}</span>
                  {output.libraryPlatform && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded capitalize">
                      {output.libraryPlatform}
                    </span>
                  )}
                </div>
                
                {/* Library images if any */}
                {output.libraryImages && output.libraryImages.length > 0 && (
                  <div className="relative rounded-lg overflow-hidden bg-black/5">
                    <img 
                      src={output.libraryImages[currentImageIndex] || output.libraryImages[0]} 
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    {output.libraryImages.length > 1 && (
                      <>
                        <button 
                          onClick={prevImage}
                          className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={nextImage}
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          {currentImageIndex + 1}/{output.libraryImages.length}
                        </div>
                        {/* Dots indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {output.libraryImages.slice(0, 8).map((_, idx) => (
                            <button
                              key={idx}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                              }`}
                              onClick={() => setCurrentImageIndex(idx)}
                            />
                          ))}
                          {output.libraryImages.length > 8 && (
                            <span className="text-white text-[8px]">+{output.libraryImages.length - 8}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Content preview - scrollable for full readability */}
                <div className="bg-muted rounded-md p-3 max-h-64 overflow-y-auto">
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{output.content}</p>
                </div>
                
                {/* View full content button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px] gap-1 text-primary hover:text-primary/80 hover:bg-primary/10"
                  onClick={() => setShowTranscription(true)}
                >
                  <Expand className="h-3 w-3" />
                  Ver conteúdo completo
                </Button>
              </div>
            )}
            
            {/* Transcription preview - for all types that have it */}
            {output.transcription && (
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
                Análise de estilo
              </span>
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
                <span className="text-[10px] text-muted-foreground">Até {MAX_IMAGES} imagens, vídeo ou áudio</span>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept="image/*,video/*,audio/*"
                  multiple
                  onChange={handleFileUpload}
                />
              </label>
            </TabsContent>
            
            <TabsContent value="link" className="mt-2 space-y-2">
              <Input
                placeholder="Cole um link do YouTube..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="text-xs h-8"
              />
              <div className="flex gap-1 text-[10px] text-muted-foreground">
                <span className="bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded">YouTube</span>
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
      
      {/* Content/Transcription Modal - works for both transcription and library content */}
      <TranscriptionModal
        open={showTranscription}
        onOpenChange={setShowTranscription}
        transcription={output?.type === 'library' ? output.content : (output?.transcription || "")}
        fileName={output?.type === 'library' ? output.libraryTitle : output?.fileName}
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
