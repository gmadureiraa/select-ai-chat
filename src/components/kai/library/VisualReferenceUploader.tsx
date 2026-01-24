import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientVisualReferences, CreateVisualReferenceData } from "@/hooks/useClientVisualReferences";

interface VisualReferenceUploaderProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const referenceTypes = [
  { value: "logo", label: "Logo" },
  { value: "product", label: "Produto" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "style_example", label: "Exemplo de Estilo" },
  { value: "color_palette", label: "Paleta de Cores" },
] as const;

export function VisualReferenceUploader({ clientId, open, onOpenChange }: VisualReferenceUploaderProps) {
  const { toast } = useToast();
  const { createReference } = useClientVisualReferences(clientId);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [referenceType, setReferenceType] = useState<CreateVisualReferenceData["reference_type"]>("style_example");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "Selecione uma imagem",
        description: "Por favor, selecione uma imagem para upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload to Supabase Storage
      const fileName = `visual-refs/${clientId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("client-files")
        .getPublicUrl(fileName);

      // Create the visual reference record
      await createReference.mutateAsync({
        image_url: publicUrl,
        title: title || selectedFile.name,
        description,
        reference_type: referenceType,
        is_primary: false,
      });

      toast({
        title: "Referência adicionada!",
        description: "A imagem foi salva e está sendo analisada.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setReferenceType("style_example");
      setPreviewUrl(null);
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Error uploading visual reference:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível salvar a referência.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setTitle("");
      setDescription("");
      setPreviewUrl(null);
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Adicionar Referência Visual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image upload area */}
          <div 
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="relative">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                >
                  Trocar imagem
                </Button>
              </div>
            ) : (
              <div className="py-6">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para selecionar uma imagem</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP até 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Logo principal, Produto X..."
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo de referência</Label>
            <Select value={referenceType} onValueChange={(v) => setReferenceType(v as CreateVisualReferenceData["reference_type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {referenceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre esta referência..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || !selectedFile}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}