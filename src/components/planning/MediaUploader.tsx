import { useState, useRef } from 'react';
import { Plus, X, GripVertical, Video, Loader2, Maximize2, FolderDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageLightbox } from './ImageLightbox';
import JSZip from 'jszip';

// Helper to convert any URL (HTTP or Data URL) to Blob
const urlToBlob = async (url: string): Promise<Blob> => {
  if (url.startsWith('data:')) {
    const [header, base64Data] = url.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  return response.blob();
};

// Helper to get file extension from URL or Data URL
const getExtensionFromUrl = (url: string, type: 'image' | 'video'): string => {
  if (url.startsWith('data:')) {
    const match = url.match(/data:(\w+)\/(\w+)/);
    if (match) return match[2] === 'jpeg' ? 'jpg' : match[2];
  } else {
    const urlPath = url.split('?')[0];
    const ext = urlPath.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(ext)) {
      return ext;
    }
  }
  return type === 'video' ? 'mp4' : 'png';
};

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  file?: File;
}

interface MediaUploaderProps {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  maxItems?: number;
  clientId?: string;
  className?: string;
}

export function MediaUploader({
  value,
  onChange,
  maxItems = 4,
  clientId,
  className
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenLightbox = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (downloadingAll || value.length === 0) return;
    
    setDownloadingAll(true);
    const zip = new JSZip();
    let successCount = 0;
    
    try {
      for (const [idx, item] of value.entries()) {
        try {
          const blob = await urlToBlob(item.url);
          const extension = getExtensionFromUrl(item.url, item.type);
          zip.file(`media-${idx + 1}.${extension}`, blob);
          successCount++;
        } catch (err) {
          console.error(`Error downloading media ${idx + 1}:`, err);
        }
      }
      
      if (successCount === 0) {
        toast.error('Não foi possível baixar nenhuma mídia');
        return;
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midias-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${successCount} mídia(s) baixada(s) em um arquivo ZIP!`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao criar arquivo ZIP');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxItems - value.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (filesToProcess.length === 0) {
      toast.error(`Máximo de ${maxItems} arquivos permitidos`);
      return;
    }

    setIsUploading(true);
    const newItems: MediaItem[] = [];

    for (const file of filesToProcess) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        toast.error(`Arquivo ${file.name} não é uma imagem ou vídeo`);
        continue;
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = clientId 
          ? `planning/${clientId}/${fileName}` 
          : `planning/general/${fileName}`;

        const { data, error } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Erro ao fazer upload de ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(data.path);

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          url: urlData.publicUrl,
          type: isVideo ? 'video' : 'image',
        });
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Erro ao fazer upload de ${file.name}`);
      }
    }

    if (newItems.length > 0) {
      onChange([...value, ...newItems]);
      toast.success(`${newItems.length} arquivo(s) adicionado(s)`);
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter(item => item.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...value];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    onChange(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mídia</span>
          <span className="text-xs text-muted-foreground">
            ({value.length}/{maxItems})
          </span>
        </div>
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="h-7 text-xs gap-1.5"
          >
            {downloadingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderDown className="h-3.5 w-3.5" />
            )}
            Baixar todas
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {value.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative group w-20 h-20 rounded-xl border border-border/50 overflow-hidden",
              "shadow-sm hover:shadow-md transition-all duration-200",
              draggedIndex === index && "opacity-50"
            )}
          >
            {item.type === 'video' ? (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover cursor-pointer"
                onClick={(e) => handleOpenLightbox(e, index)}
              />
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20 cursor-move"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => handleOpenLightbox(e, index)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={(e) => handleRemove(e, item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {value.length < maxItems && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "w-20 h-20 rounded-xl border-2 border-dashed border-border/50",
              "flex flex-col items-center justify-center gap-1",
              "hover:border-primary hover:bg-primary/5 transition-all duration-200",
              "text-muted-foreground hover:text-primary",
              isUploading && "opacity-50 cursor-wait"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="text-[10px]">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Lightbox for viewing images larger */}
      <ImageLightbox
        images={value.map(v => ({ url: v.url, type: v.type }))}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
