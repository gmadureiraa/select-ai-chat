import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string | null) => void;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  bucket?: string;
  folder?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-28 h-28",
};

export function AvatarUpload({
  currentUrl,
  onUpload,
  fallback = "?",
  size = "md",
  bucket = "client-files",
  folder = "avatars",
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onUpload(urlData.publicUrl);
      
      toast({
        title: "Imagem atualizada",
        description: "Avatar salvo com sucesso",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar a imagem",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUpload(null);
  };

  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], "border-2 border-border")}>
          <AvatarImage src={displayUrl || undefined} alt="Avatar" />
          <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-violet-500 to-pink-500 text-white">
            {fallback.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Overlay button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-pointer"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </button>

        {/* Remove button */}
        {displayUrl && !isUploading && (
          <button
            type="button"
            onClick={handleRemove}
            className={cn(
              "absolute -top-1 -right-1 w-5 h-5 rounded-full",
              "bg-destructive text-destructive-foreground",
              "flex items-center justify-center",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-destructive/90"
            )}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-xs"
      >
        {isUploading ? "Enviando..." : "Alterar imagem"}
      </Button>
    </div>
  );
}
