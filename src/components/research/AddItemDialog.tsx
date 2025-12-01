import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResearchItems } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddItemDialogProps {
  projectId: string;
}

export const AddItemDialog = ({ projectId }: AddItemDialogProps) => {
  const { createItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // YouTube
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Text
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  // Link
  const [linkUrl, setLinkUrl] = useState("");

  const handleAddYoutube = async () => {
    if (!youtubeUrl.trim()) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-youtube", {
        body: { url: youtubeUrl },
      });

      if (error) throw error;

      await createItem.mutateAsync({
        project_id: projectId,
        type: "youtube",
        title: data.title,
        content: data.content,
        source_url: youtubeUrl,
        thumbnail_url: data.thumbnail,
        metadata: data.metadata,
        processed: true,
      });

      setYoutubeUrl("");
      setIsOpen(false);
      toast({
        title: "Vídeo adicionado",
        description: "Transcrição extraída com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao processar vídeo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddText = async () => {
    if (!textContent.trim()) return;

    await createItem.mutateAsync({
      project_id: projectId,
      type: "text",
      title: textTitle || "Texto",
      content: textContent,
      processed: true,
    });

    setTextTitle("");
    setTextContent("");
    setIsOpen(false);
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;

    await createItem.mutateAsync({
      project_id: projectId,
      type: "link",
      title: linkUrl,
      source_url: linkUrl,
      processed: false,
    });

    setLinkUrl("");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Material à Pesquisa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="youtube">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
            <TabsTrigger value="text">Texto</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="space-y-4">
            <div>
              <Label htmlFor="youtube-url">URL do Vídeo</Label>
              <Input
                id="youtube-url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <Button onClick={handleAddYoutube} disabled={!youtubeUrl.trim() || isProcessing}>
              {isProcessing ? "Extraindo transcrição..." : "Adicionar Vídeo"}
            </Button>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Label htmlFor="text-title">Título (opcional)</Label>
              <Input
                id="text-title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Título do texto"
              />
            </div>
            <div>
              <Label htmlFor="text-content">Conteúdo</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole ou escreva o texto aqui..."
                rows={8}
              />
            </div>
            <Button onClick={handleAddText} disabled={!textContent.trim()}>
              Adicionar Texto
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button onClick={handleAddLink} disabled={!linkUrl.trim()}>
              Adicionar Link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
