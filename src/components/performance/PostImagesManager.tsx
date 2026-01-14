import { useState, useRef } from "react";
import { Plus, Trash2, Loader2, FileText, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadToClientFiles, getPublicUrl } from "@/lib/storage";
import { transcribeImagesChunked } from "@/lib/transcribeImages";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PostImagesManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
  clientId: string;
  onTranscribe?: (transcription: string) => void;
  className?: string;
}

const getStorageUrl = (path: string) => {
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

export const PostImagesManager = ({
  images,
  onChange,
  clientId,
  onTranscribe,
  className,
}: PostImagesManagerProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPaths: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const folder = `instagram-sync/${clientId}`;
        const { path, error } = await uploadToClientFiles(file, folder);
        if (error) {
          console.warn(`Error uploading ${file.name}:`, error);
          continue;
        }
        newPaths.push(path);
      }

      if (newPaths.length > 0) {
        onChange([...images, ...newPaths]);
        toast.success(`${newPaths.length} imagem(ns) adicionada(s)`);
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Erro ao fazer upload das imagens");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
    toast.success("Imagem removida");
  };

  const handleTranscribe = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para transcrever");
      return;
    }

    setIsTranscribing(true);
    try {
      // Convert storage paths to full URLs
      const imageUrls = images.map((path) => getStorageUrl(path));

      const transcription = await transcribeImagesChunked(imageUrls, {
        clientId,
      });

      if (transcription && onTranscribe) {
        onTranscribe(transcription);
        toast.success("Imagens transcritas com sucesso!");
      } else {
        toast.info("Nenhum texto encontrado nas imagens");
      }
    } catch (error) {
      console.error("Error transcribing images:", error);
      toast.error("Erro ao transcrever imagens");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Imagens do Post ({images.length})
        </h4>
        <div className="flex items-center gap-2">
          {images.length > 0 && onTranscribe && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="h-7 text-xs gap-1"
            >
              {isTranscribing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileText className="h-3 w-3" />
              )}
              Transcrever
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-7 text-xs gap-1"
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Adicionar
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {images.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {images.map((path, index) => (
            <div
              key={path}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer"
              onClick={() => setSelectedImage(getStorageUrl(path))}
            >
              <img
                src={getStorageUrl(path)}
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(index);
                }}
                className="absolute top-1 right-1 p-1 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Clique para adicionar imagens
          </p>
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
