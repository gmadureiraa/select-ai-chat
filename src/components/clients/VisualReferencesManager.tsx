import { useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useClientVisualReferences, ClientVisualReference } from "@/hooks/useClientVisualReferences";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Upload, Trash2, Star, StarOff, Image, 
  Palette, ShoppingBag, Camera, Sparkles, Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VisualReferencesManagerProps {
  clientId: string;
  variant?: "compact" | "expanded";
  searchQuery?: string;
  typeFilter?: string;
  viewMode?: "grid" | "list";
  selectedItems?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

export const REFERENCE_TYPES = [
  { value: "logo", label: "Logo", icon: Sparkles },
  { value: "product", label: "Produto", icon: ShoppingBag },
  { value: "lifestyle", label: "Lifestyle", icon: Camera },
  { value: "style_example", label: "Exemplo de Estilo", icon: Image },
  { value: "color_palette", label: "Paleta de Cores", icon: Palette },
] as const;

export const VisualReferencesManager = ({ 
  clientId, 
  variant = "compact",
  searchQuery = "",
  typeFilter = "all",
  viewMode = "grid",
  selectedItems = new Set(),
  onToggleSelection
}: VisualReferencesManagerProps) => {
  const { toast } = useToast();
  const { 
    references, 
    isLoading, 
    createReference, 
    deleteReference, 
    setPrimaryReference 
  } = useClientVisualReferences(clientId);
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<ClientVisualReference["reference_type"]>("style_example");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(variant === "compact");

  // Filter and sort references
  const filteredReferences = useMemo(() => {
    let result = references || [];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.title?.toLowerCase().includes(query)) ||
        (r.description?.toLowerCase().includes(query))
      );
    }
    
    if (typeFilter !== "all") {
      result = result.filter(r => r.reference_type === typeFilter);
    }
    
    return result;
  }, [references, searchQuery, typeFilter]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(`visual-references/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("client-files")
        .getPublicUrl(`visual-references/${fileName}`);

      await createReference.mutateAsync({
        image_url: urlData.publicUrl,
        title: title || file.name,
        description: description || undefined,
        reference_type: selectedType,
        is_primary: false,
      });

      // Reset form
      setTitle("");
      setDescription("");
      e.target.value = "";
      if (variant === "expanded") {
        setShowUploadForm(false);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload da imagem.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [clientId, selectedType, title, description, createReference, toast, variant]);

  const handleTogglePrimary = (ref: ClientVisualReference) => {
    setPrimaryReference.mutate({ id: ref.id, isPrimary: !ref.is_primary });
  };

  const getTypeIcon = (type: ClientVisualReference["reference_type"]) => {
    const typeConfig = REFERENCE_TYPES.find(t => t.value === type);
    if (typeConfig) {
      const Icon = typeConfig.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Image className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Expanded variant for Library
  if (variant === "expanded") {
    return (
      <div className="space-y-4">
        {/* Upload Form (collapsible in expanded mode) */}
        {showUploadForm && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Nova Referência Visual</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowUploadForm(false)}>
                Cancelar
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map(type => (
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
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Título (opcional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome da referência"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição curta..."
                />
              </div>
            </div>

            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* References Grid/List */}
        {filteredReferences.length > 0 ? (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              : "space-y-2"
          )}>
            {filteredReferences.map((ref) => {
              const isSelected = selectedItems.has(ref.id);
              
              if (viewMode === "list") {
                return (
                  <div
                    key={ref.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/50"
                    )}
                  >
                    {onToggleSelection && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(ref.id)}
                      />
                    )}
                    <img 
                      src={ref.image_url} 
                      alt={ref.title || "Referência"} 
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ref.title || "Sem título"}</p>
                      <p className="text-xs text-muted-foreground truncate">{ref.description || "Sem descrição"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {REFERENCE_TYPES.find(t => t.value === ref.reference_type)?.label || ref.reference_type}
                      </Badge>
                      {ref.is_primary && (
                        <Badge className="text-[10px]">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Principal
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTogglePrimary(ref)}
                        title={ref.is_primary ? "Remover destaque" : "Marcar como principal"}
                      >
                        {ref.is_primary ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteReference.mutate(ref.id)}
                        disabled={deleteReference.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={ref.id} 
                  className={cn(
                    "relative group rounded-lg border overflow-hidden",
                    ref.is_primary && "ring-2 ring-primary",
                    isSelected && "ring-2 ring-primary/50"
                  )}
                >
                  {onToggleSelection && (
                    <div className={cn(
                      "absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
                      isSelected && "opacity-100"
                    )}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(ref.id)}
                        className="bg-background"
                      />
                    </div>
                  )}
                  
                  <img 
                    src={ref.image_url} 
                    alt={ref.title || "Referência visual"}
                    className="w-full h-40 object-cover"
                  />
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleTogglePrimary(ref)}
                      title={ref.is_primary ? "Remover destaque" : "Marcar como principal"}
                    >
                      {ref.is_primary ? (
                        <StarOff className="h-4 w-4" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => deleteReference.mutate(ref.id)}
                      disabled={deleteReference.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="flex items-center gap-1 text-white">
                      {getTypeIcon(ref.reference_type)}
                      <span className="text-xs truncate">{ref.title || "Sem título"}</span>
                    </div>
                    {ref.is_primary && (
                      <Badge variant="default" className="mt-1 text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Principal
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{searchQuery || typeFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhuma referência visual cadastrada"}</p>
            <p className="text-xs mb-4">Adicione imagens para melhorar as gerações de IA</p>
            {!showUploadForm && (
              <Button variant="outline" onClick={() => setShowUploadForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Referência
              </Button>
            )}
          </div>
        )}

        {filteredReferences.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Referências marcadas como "Principal" ⭐ serão usadas automaticamente na geração de imagens.
          </p>
        )}
      </div>
    );
  }

  // Compact variant (default - for ClientEditDialog)
  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <Label className="text-sm font-medium">Adicionar Referência Visual</Label>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_TYPES.map(type => (
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
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da referência"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o que essa referência representa..."
          />
        </div>

        <div className="relative">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="cursor-pointer"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* References List */}
      {references.length > 0 ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Referências ({references.length})</Label>
          
          <div className="grid grid-cols-2 gap-3">
            {references.map((ref) => (
              <div 
                key={ref.id} 
                className={`relative group rounded-lg border overflow-hidden ${
                  ref.is_primary ? "ring-2 ring-primary" : ""
                }`}
              >
                <img 
                  src={ref.image_url} 
                  alt={ref.title || "Referência visual"}
                  className="w-full h-32 object-cover"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => handleTogglePrimary(ref)}
                    title={ref.is_primary ? "Remover destaque" : "Marcar como principal"}
                  >
                    {ref.is_primary ? (
                      <StarOff className="h-4 w-4" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteReference.mutate(ref.id)}
                    disabled={deleteReference.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <div className="flex items-center gap-1 text-white">
                    {getTypeIcon(ref.reference_type)}
                    <span className="text-xs truncate">{ref.title || "Sem título"}</span>
                  </div>
                  {ref.is_primary && (
                    <Badge variant="default" className="mt-1 text-xs">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Principal
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Referências marcadas como "Principal" ⭐ serão usadas automaticamente na geração de imagens.
          </p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma referência visual cadastrada</p>
          <p className="text-xs">Adicione imagens para melhorar as gerações de IA</p>
        </div>
      )}
    </div>
  );
};
