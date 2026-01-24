import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Instagram, Youtube, Mail, Linkedin, BookOpen, FileBarChart } from "lucide-react";
import { RichContentEditor } from "./RichContentEditor";

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  defaultContentType?: string;
}

import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";

const CONTENT_TYPES = CONTENT_TYPE_OPTIONS.map(opt => ({
  value: opt.value,
  label: opt.label,
  icon: opt.category === 'Instagram' ? Instagram : 
        opt.category === 'Vídeo' ? Youtube : 
        opt.category === 'Escrita' ? Mail :
        opt.category === 'LinkedIn' ? Linkedin : 
        opt.value === 'case_study' ? BookOpen :
        opt.value === 'report' ? FileBarChart : Plus
}));

export function AddContentDialog({ open, onOpenChange, clientId, defaultContentType }: AddContentDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("other");
  const [contentUrl, setContentUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const queryClient = useQueryClient();

  // Set default content type when dialog opens
  useEffect(() => {
    if (open && defaultContentType) {
      setContentType(defaultContentType);
    }
  }, [open, defaultContentType]);

  const isRichContent = contentType === 'case_study' || contentType === 'report';

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/covers/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client-files').getPublicUrl(fileName);
      setThumbnailUrl(data.publicUrl);
      toast.success("Capa carregada!");
    } catch (error) {
      console.error("Error uploading cover:", error);
      toast.error("Erro ao carregar capa");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: title.trim(),
          content: content.trim(),
          content_type: contentType as any,
          content_url: contentUrl.trim() || null,
          thumbnail_url: thumbnailUrl || null,
          metadata: {
            source: "manual",
            created_manually: true,
          },
        });

      if (error) throw error;

      toast.success("Conteúdo adicionado à biblioteca!");
      queryClient.invalidateQueries({ queryKey: ["unified-content", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      
      // Reset form
      setTitle("");
      setContent("");
      setContentType("other");
      setContentUrl("");
      setThumbnailUrl("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding content:", error);
      toast.error("Erro ao adicionar conteúdo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setTitle("");
      setContent("");
      setContentType(defaultContentType || "other");
      setContentUrl("");
      setThumbnailUrl("");
      onOpenChange(false);
    }
  };

  const dialogTitle = isRichContent 
    ? (contentType === 'case_study' ? 'Novo Estudo de Caso' : 'Novo Relatório')
    : 'Adicionar Conteúdo';

  const dialogDescription = isRichContent
    ? 'Crie um documento com texto rico, imagens e formatação.'
    : 'Adicione conteúdo manualmente à biblioteca para usar como referência.';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={isRichContent ? "sm:max-w-3xl max-h-[90vh] overflow-y-auto" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content-title">Título *</Label>
            <Input
              id="content-title"
              placeholder={isRichContent ? "Título do documento..." : "Ex: Post sobre lançamento do produto"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Only show type selector if not a fixed type */}
          {!defaultContentType && (
            <div className="space-y-2">
              <Label htmlFor="content-type">Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cover image upload for case studies, reports, and newsletters */}
          {(isRichContent || contentType === 'newsletter') && (
            <div className="space-y-2">
              <Label>Capa (opcional)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  disabled={isUploadingCover}
                  className="flex-1"
                />
                {isUploadingCover && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {thumbnailUrl && (
                <div className="mt-2">
                  <img 
                    src={thumbnailUrl} 
                    alt="Capa" 
                    className="max-h-32 rounded-lg object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {!isRichContent && (
            <div className="space-y-2">
              <Label htmlFor="content-url">URL do Conteúdo (opcional)</Label>
              <Input
                id="content-url"
                placeholder="https://..."
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
              />
            </div>
          )}

          {/* Rich content editor for case studies and reports */}
          {isRichContent ? (
            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <RichContentEditor
                value={content}
                onChange={setContent}
                placeholder="Escreva seu conteúdo aqui... Use Markdown para formatação."
                minHeight="300px"
                clientId={clientId}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content-text">Conteúdo / Texto *</Label>
              <Textarea
                id="content-text"
                placeholder="Cole o texto do conteúdo aqui..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {isRichContent ? 'Criar' : 'Adicionar'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
