import { useState, useRef } from 'react';
import { Plus, X, GripVertical, Image, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Upload to Supabase storage
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

  const handleRemove = (id: string) => {
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
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Mídia</span>
        <span className="text-xs text-muted-foreground">
          ({value.length}/{maxItems})
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative group w-20 h-20 rounded-lg border border-border overflow-hidden cursor-move",
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
                className="w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <GripVertical className="h-4 w-4 text-white" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => handleRemove(item.id)}
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
              "w-20 h-20 rounded-lg border-2 border-dashed border-border",
              "flex flex-col items-center justify-center gap-1",
              "hover:border-primary hover:bg-primary/5 transition-colors",
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
    </div>
  );
}