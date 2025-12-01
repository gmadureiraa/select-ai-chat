import { useState } from "react";
import { Youtube, FileText, Link as LinkIcon, Sparkles, StickyNote, Mic } from "lucide-react";
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

type ItemType = "ai_chat" | "note" | "youtube" | "text" | "link" | "audio" | null;

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
          if (!content.trim()) return;
          await createItem.mutateAsync({
            project_id: projectId,
            type: "note",
            title: title || "Nota",
            content,
            position_x: Math.random() * 500,
            position_y: Math.random() * 500,
          });
          toast({ title: "Nota adicionada" });
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
          if (!content.trim()) return;
          await createItem.mutateAsync({
            project_id: projectId,
            type: "text",
            title: title || "Texto",
            content,
            processed: true,
          });
          toast({ title: "Texto adicionado" });
          break;

        case "link":
          if (!url.trim()) return;
          await createItem.mutateAsync({
            project_id: projectId,
            type: "link",
            title: url,
            source_url: url,
            processed: false,
          });
          toast({ title: "Link adicionado" });
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
      <div className="absolute bottom-20 right-4 bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-4 min-w-[320px] z-50">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Adicionar ao mapa</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-purple-50 hover:border-purple-300"
            onClick={() => handleSelectType("ai_chat")}
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Chat IA</div>
              <div className="text-xs text-gray-500">Análise inteligente</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-yellow-50 hover:border-yellow-300"
            onClick={() => handleSelectType("note")}
          >
            <div className="p-2 bg-yellow-100 rounded-lg">
              <StickyNote className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Nota</div>
              <div className="text-xs text-gray-500">Anotação rápida</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-red-50 hover:border-red-300"
            onClick={() => handleSelectType("youtube")}
          >
            <div className="p-2 bg-red-100 rounded-lg">
              <Youtube className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Vídeo YouTube</div>
              <div className="text-xs text-gray-500">Com transcrição automática</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => handleSelectType("text")}
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Texto</div>
              <div className="text-xs text-gray-500">Cole ou escreva</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-green-50 hover:border-green-300"
            onClick={() => handleSelectType("link")}
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <LinkIcon className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Link</div>
              <div className="text-xs text-gray-500">URL externa</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 hover:bg-pink-50 hover:border-pink-300"
            onClick={() => handleSelectType("audio")}
          >
            <div className="p-2 bg-pink-100 rounded-lg">
              <Mic className="h-4 w-4 text-pink-600" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Áudio</div>
              <div className="text-xs text-gray-500">Gravar ou fazer upload</div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-20 right-4 bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-4 min-w-[360px] z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {selectedType === "ai_chat" && "Chat IA"}
          {selectedType === "note" && "Nova Nota"}
          {selectedType === "youtube" && "Adicionar Vídeo"}
          {selectedType === "text" && "Adicionar Texto"}
          {selectedType === "link" && "Adicionar Link"}
          {selectedType === "audio" && "Adicionar Áudio"}
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
          <>
            <div>
              <Label>Título</Label>
              <Input
                placeholder="Título da nota..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                placeholder="Digite suas anotações..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!content.trim() || isProcessing}>
              Adicionar Nota
            </Button>
          </>
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
          <>
            <div>
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Título do texto..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                placeholder="Cole ou escreva o texto..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!content.trim() || isProcessing}>
              Adicionar Texto
            </Button>
          </>
        )}

        {selectedType === "link" && (
          <>
            <div>
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!url.trim() || isProcessing}>
              Adicionar Link
            </Button>
          </>
        )}

        {selectedType === "audio" && (
          <div className="text-center py-8">
            <Mic className="h-12 w-12 mx-auto mb-3 text-pink-400" />
            <p className="text-sm text-gray-600 mb-2">Funcionalidade de áudio</p>
            <p className="text-xs text-gray-400">Em breve: gravação e upload de áudio</p>
          </div>
        )}
      </div>
    </div>
  );
};
