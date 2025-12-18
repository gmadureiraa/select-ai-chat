import { useState } from "react";
import { Palette, Image as ImageIcon, LayoutGrid, Twitter, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImageGallery } from "@/components/posts/ImageGallery";
import { CarouselEditor, CarouselSlide } from "@/components/posts/CarouselEditor";
import { PostPreviewCard } from "@/components/posts/PostPreviewCard";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { Client } from "@/hooks/useClients";

interface VisualCreatorToolProps {
  clientId: string;
  client: Client;
  onBack?: () => void;
}

export const VisualCreatorTool = ({ clientId, client, onBack }: VisualCreatorToolProps) => {
  const [activeTab, setActiveTab] = useState("images");
  const { generations } = useImageGenerations(clientId);
  
  // Demo carousel slides for the editor
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([
    { id: "1", title: "Slide 1", content: "Título impactante" },
    { id: "2", title: "Slide 2", content: "Conteúdo principal" },
    { id: "3", title: "Slide 3", content: "Call to action" },
  ]);

  // Demo post for preview
  const [demoPost, setDemoPost] = useState({
    content: "Este é um exemplo de post para visualização. Edite o texto para ver como ficará nas redes sociais! 🚀\n\n#exemplo #preview",
  });

  const handleSelectImage = (url: string) => {
    console.log("Image selected:", url);
  };

  const handleGenerateVariation = async (prompt: string, referenceUrl: string) => {
    console.log("Generate variation:", prompt, referenceUrl);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Criação Visual</h2>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Imagens IA</span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {generations?.length || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="carousel" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Carrossel</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <Twitter className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
        </TabsList>

        {/* Image Gallery */}
        <TabsContent value="images" className="mt-4">
          <ImageGallery
            clientId={clientId}
            onSelectImage={handleSelectImage}
            onGenerateVariation={handleGenerateVariation}
          />
        </TabsContent>

        {/* Carousel Editor */}
        <TabsContent value="carousel" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Editor de Carrossel</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCarouselSlides([
                      ...carouselSlides,
                      { id: Date.now().toString(), title: `Slide ${carouselSlides.length + 1}`, content: "Novo conteúdo" }
                    ])}
                  >
                    Adicionar Slide
                  </Button>
                </div>
                <CarouselEditor
                  slides={carouselSlides}
                  onSlidesChange={setCarouselSlides}
                  authorName={client.name}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Post Previews */}
        <TabsContent value="posts" className="mt-4">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-medium mb-4">Preview de Posts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Visualize como seu conteúdo ficará em diferentes plataformas. 
                  Clique no texto para editar diretamente.
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Twitter/X</h4>
                    <PostPreviewCard
                      content={demoPost.content}
                      platform="twitter"
                      authorName={client.name}
                      authorAvatar={client.avatar_url || undefined}
                      onContentChange={(content) => setDemoPost({ content })}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Instagram</h4>
                    <PostPreviewCard
                      content={demoPost.content}
                      platform="instagram"
                      authorName={client.name}
                      authorAvatar={client.avatar_url || undefined}
                      onContentChange={(content) => setDemoPost({ content })}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">LinkedIn</h4>
                    <PostPreviewCard
                      content={demoPost.content}
                      platform="linkedin"
                      authorName={client.name}
                      authorAvatar={client.avatar_url || undefined}
                      onContentChange={(content) => setDemoPost({ content })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
