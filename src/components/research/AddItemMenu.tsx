import { useState } from "react";
import { Youtube, FileText, Link as LinkIcon, Sparkles, StickyNote, Mic, Image, BookOpen, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useResearchItems } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddItemMenuProps {
  projectId: string;
  onClose: () => void;
}

type ItemType = "ai_chat" | "note" | "youtube" | "text" | "link" | "audio" | "image" | "content_library" | "reference_library" | null;

export const AddItemMenu = ({ projectId, onClose }: AddItemMenuProps) => {
  const [selectedType, setSelectedType] = useState<ItemType>(null);
  const { createItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  const handleSelectType = (type: ItemType) => {
    setSelectedType(type);
  };

  const handleAddItem = async () => {
    try {
      setIsProcessing(true);

      switch (selectedType) {
        case "ai_chat":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "ai_chat",
            title: title || "Chat com IA",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Chat IA adicionado" });
          break;

        case "note":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "note",
            title: "Nova Nota",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Nota criada - clique para editar" });
          break;

        case "youtube":
          if (!url.trim()) return;
          const { data, error } = await supabase.functions.invoke("extract-youtube", {
            body: { url },
          });
          if (error) throw error;
          
          await createItem.mutateAsync({
            project_id: projectId,
            type: "youtube",
            title: data.title,
            content: data.content,
            source_url: url,
            thumbnail_url: data.thumbnail,
            metadata: data.metadata,
            processed: true,
          });
          toast({ title: "Vídeo adicionado", description: "Transcrição extraída com sucesso." });
          break;

        case "text":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "text",
            title: "Novo Texto",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Texto criado - clique para editar" });
          break;

        case "link":
          if (!url.trim()) return;
          toast({ title: "Extraindo conteúdo do link...", description: "Isso pode levar alguns segundos." });
          
          const { data: linkData, error: linkError } = await supabase.functions.invoke("scrape-research-link", {
            body: { url },
          });
          
          if (linkError) throw linkError;
          
          await createItem.mutateAsync({
            project_id: projectId,
            type: "link",
            title: linkData.data.title || url,
            content: linkData.data.content,
            source_url: url,
            thumbnail_url: linkData.data.thumbnail,
            metadata: {
              description: linkData.data.description,
              images: linkData.data.images,
              textLength: linkData.data.textLength,
              imagesTranscribed: linkData.data.imagesTranscribed
            },
            processed: true,
          });
          toast({ title: "Link extraído", description: "Texto e imagens foram processados." });
          break;

        case "audio":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "audio",
            title: "Novo Áudio",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Áudio criado - clique para gravar" });
          break;

        case "image":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "image",
            title: url || "Nova Imagem",
            source_url: url || undefined,
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Imagem adicionada" });
          break;

        case "content_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "content_library",
            title: "Biblioteca de Conteúdo",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Biblioteca de Conteúdo adicionada" });
          break;

        case "reference_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "reference_library",
            title: "Biblioteca de Referências",
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Biblioteca de Referências adicionada" });
          break;

      }

      // Reset and close
      setTitle("");
      setContent("");
      setUrl("");
      setSelectedType(null);
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!selectedType) {
    return (
      <div className="absolute bottom-20 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-3 min-w-[300px] z-50">
        <h3 className="text-sm font-semibold text-foreground mb-3 px-1">Adicionar ao mapa</h3>
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("ai_chat")}
          >
            <div className="p-1.5 bg-purple-500/10 rounded-md">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Chat IA</div>
              <div className="text-xs text-muted-foreground">Análise inteligente</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("note")}
          >
            <div className="p-1.5 bg-yellow-500/10 rounded-md">
              <StickyNote className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Nota</div>
              <div className="text-xs text-muted-foreground">Anotação rápida</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("youtube")}
          >
            <div className="p-1.5 bg-red-500/10 rounded-md">
              <Youtube className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Vídeo YouTube</div>
              <div className="text-xs text-muted-foreground">Com transcrição automática</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("text")}
          >
            <div className="p-1.5 bg-blue-500/10 rounded-md">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Texto</div>
              <div className="text-xs text-muted-foreground">Cole ou escreva</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("link")}
          >
            <div className="p-1.5 bg-green-500/10 rounded-md">
              <LinkIcon className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Link / Website</div>
              <div className="text-xs text-muted-foreground">Extrai texto e imagens automaticamente</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("audio")}
          >
            <div className="p-1.5 bg-pink-500/10 rounded-md">
              <Mic className="h-4 w-4 text-pink-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Áudio</div>
              <div className="text-xs text-muted-foreground">Gravar ou fazer upload</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("image")}
          >
            <div className="p-1.5 bg-orange-500/10 rounded-md">
              <Image className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Imagem</div>
              <div className="text-xs text-muted-foreground">Adicionar ou gerar imagem</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("content_library")}
          >
            <div className="p-1.5 bg-cyan-500/10 rounded-md">
              <BookOpen className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Biblioteca de Conteúdo</div>
              <div className="text-xs text-muted-foreground">Conteúdos dos clientes</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2.5 hover:bg-accent/50"
            onClick={() => handleSelectType("reference_library")}
          >
            <div className="p-1.5 bg-indigo-500/10 rounded-md">
              <Library className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-medium text-sm">Biblioteca de Referências</div>
              <div className="text-xs text-muted-foreground">Referências dos clientes</div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-20 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-4 min-w-[360px] z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {selectedType === "ai_chat" && "Chat IA"}
          {selectedType === "note" && "Nova Nota"}
          {selectedType === "youtube" && "Adicionar Vídeo"}
          {selectedType === "text" && "Adicionar Texto"}
          {selectedType === "link" && "Adicionar Link"}
          {selectedType === "audio" && "Adicionar Áudio"}
          {selectedType === "image" && "Adicionar Imagem"}
          {selectedType === "content_library" && "Biblioteca de Conteúdo"}
          {selectedType === "reference_library" && "Biblioteca de Referências"}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
          Voltar
        </Button>
      </div>

      <div className="space-y-3">
        {selectedType === "ai_chat" && (
          <>
            <div>
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Ex: Análise de Vídeos..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              Adicionar Chat
            </Button>
          </>
        )}

        {selectedType === "note" && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Um card de nota será criado. Clique nele para editar o conteúdo.
            </p>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              Criar Nota
            </Button>
          </div>
        )}

        {selectedType === "youtube" && (
          <>
            <div>
              <Label>URL do YouTube</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!url.trim() || isProcessing}>
              {isProcessing ? "Extraindo transcrição..." : "Adicionar Vídeo"}
            </Button>
          </>
        )}

        {selectedType === "text" && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Um card de texto será criado. Clique nele para editar o conteúdo.
            </p>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              Criar Texto
            </Button>
          </div>
        )}

        {selectedType === "link" && (
          <>
            <div>
              <Label>URL do site ou artigo</Label>
              <Input
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O conteúdo e as imagens serão extraídos automaticamente
              </p>
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!url.trim() || isProcessing}>
              {isProcessing ? "Extraindo conteúdo..." : "Extrair e Adicionar"}
            </Button>
          </>
        )}

        {selectedType === "audio" && (
          <div className="text-center py-4">
            <Mic className="h-12 w-12 mx-auto mb-3 text-pink-600" />
            <p className="text-sm text-muted-foreground mb-4">
              Um card de áudio será criado. Clique nele para iniciar a gravação.
            </p>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              Criar Áudio
            </Button>
          </div>
        )}

        {selectedType === "image" && (
          <>
            <div>
              <Label>URL da Imagem (opcional)</Label>
              <Input
                placeholder="https://... ou deixe vazio para gerar"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Após criar, você pode gerar novas imagens com IA
              </p>
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              {isProcessing ? "Adicionando..." : "Adicionar Imagem"}
            </Button>
          </>
        )}

        {(selectedType === "content_library" || selectedType === "reference_library") && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {selectedType === "content_library" 
                ? "Um card de biblioteca será criado. Selecione conteúdos específicos dos clientes."
                : "Um card de biblioteca será criado. Selecione referências específicas dos clientes."}
            </p>
            <Button onClick={handleAddItem} className="w-full" disabled={isProcessing}>
              Criar Biblioteca
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
