import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClients } from "@/hooks/useClients";
import { useScheduledPosts, useCreateScheduledPost, useDeleteScheduledPost, useUpdateScheduledPost } from "@/hooks/useScheduledPosts";
import { useQueryClient } from "@tanstack/react-query";
import { useLinkedInConnection } from "@/hooks/useLinkedInConnection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Twitter, Linkedin, Send, Loader2, CheckCircle, Image, Calendar, Trash2, FileText, Edit, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export const SocialPublisherTool = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { clients } = useClients();
  const { data: drafts } = useScheduledPosts('draft');
  const { data: scheduled } = useScheduledPosts('scheduled');
  const createPost = useCreateScheduledPost();
  const deletePost = useDeleteScheduledPost();
  const updatePost = useUpdateScheduledPost();
  const { isConnected: linkedInConnected, isLoading: linkedInLoading, initiateOAuth, disconnect, refetch: refetchLinkedIn } = useLinkedInConnection();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [activeTab, setActiveTab] = useState("publish");
  const [editingDraft, setEditingDraft] = useState<string | null>(null);

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  useEffect(() => {
    const linkedinConnected = searchParams.get("linkedin_connected");
    const linkedinError = searchParams.get("linkedin_error");

    if (linkedinConnected) {
      toast.success("LinkedIn conectado com sucesso!");
      refetchLinkedIn();
    }

    if (linkedinError) {
      toast.error(`Erro ao conectar LinkedIn: ${linkedinError}`);
    }
  }, [searchParams, refetchLinkedIn]);

  const togglePlatform = (platform: string) => {
    if (platform === "linkedin" && !linkedInConnected) {
      toast.error("Conecte seu LinkedIn primeiro");
      return;
    }
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      toast.error("Digite o conteúdo para publicar");
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error("Selecione pelo menos uma plataforma");
      return;
    }

    setIsPublishing(true);
    setPublishResults([]);

    const results: PublishResult[] = [];
    const session = await supabase.auth.getSession();

    for (const platform of selectedPlatforms) {
      try {
        if (platform === "twitter") {
          const { data, error } = await supabase.functions.invoke('post-twitter', {
            body: {
              content: content.trim(),
              clientId: selectedClientId,
              clientName: selectedClient?.name
            }
          });

          if (error) throw error;
          
          results.push({
            platform: "Twitter/X",
            success: data.success,
            postId: data.postId,
            error: data.error
          });
        } else if (platform === "linkedin") {
          const { data, error } = await supabase.functions.invoke('post-linkedin', {
            body: {
              content: content.trim(),
              imageUrl: imageUrl || undefined
            },
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token}`
            }
          });

          if (error) throw error;
          
          results.push({
            platform: "LinkedIn",
            success: data.success,
            postId: data.postId,
            error: data.error
          });
        }
      } catch (error: any) {
        results.push({
          platform: platform === "twitter" ? "Twitter/X" : "LinkedIn",
          success: false,
          error: error.message
        });
      }
    }

    setPublishResults(results);
    setIsPublishing(false);

    const successCount = results.filter(r => r.success).length;
    if (successCount === results.length) {
      toast.success("Publicado com sucesso!");
      setContent("");
      clearImage();
    } else if (successCount > 0) {
      toast.warning(`Publicado em ${successCount}/${results.length} plataformas`);
    } else {
      toast.error("Erro ao publicar");
    }
  };

  const handleSaveDraft = async () => {
    if (!content.trim()) {
      toast.error("Digite o conteúdo para salvar");
      return;
    }

    try {
      if (editingDraft) {
        await updatePost.mutateAsync({
          id: editingDraft,
          content: content.trim(),
          platforms: selectedPlatforms,
          client_id: selectedClientId || undefined,
          image_url: imageUrl || undefined,
        });
        toast.success("Rascunho atualizado!");
        setEditingDraft(null);
      } else {
        await createPost.mutateAsync({
          content: content.trim(),
          platforms: selectedPlatforms,
          client_id: selectedClientId || undefined,
          image_url: imageUrl || undefined,
          status: 'draft',
        });
        toast.success("Rascunho salvo!");
      }
      setContent("");
      clearImage();
      setActiveTab("drafts");
    } catch (error: any) {
      toast.error("Erro ao salvar rascunho: " + error.message);
    }
  };

  const handleSchedule = async () => {
    if (!content.trim()) {
      toast.error("Digite o conteúdo para agendar");
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error("Selecione data e hora para agendar");
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        platforms: selectedPlatforms,
        client_id: selectedClientId || undefined,
        image_url: imageUrl || undefined,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      });
      toast.success("Post agendado com sucesso!");
      setContent("");
      clearImage();
      setScheduleDate("");
      setScheduleTime("");
    } catch (error: any) {
      toast.error("Erro ao agendar: " + error.message);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await deletePost.mutateAsync(id);
      toast.success("Rascunho excluído");
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleEditDraft = (draft: any) => {
    setContent(draft.content);
    setSelectedPlatforms(draft.platforms || []);
    setSelectedClientId(draft.client_id || "");
    setImageUrl(draft.image_url || "");
    setImagePreview(draft.image_url || "");
    setImageFile(null);
    setEditingDraft(draft.id);
    setActiveTab("publish");
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setImageUrl("");
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Publicador Social</h1>
          <p className="text-muted-foreground text-sm">Publique conteúdo nas redes sociais</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="publish" className="gap-2">
              <Send className="h-4 w-4" />
              Publicar
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-2">
              <FileText className="h-4 w-4" />
              Rascunhos
              {drafts && drafts.length > 0 && (
                <Badge variant="secondary" className="ml-1">{drafts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Calendar className="h-4 w-4" />
              Agendados
              {scheduled && scheduled.length > 0 && (
                <Badge variant="secondary" className="ml-1">{scheduled.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="publish" className="mt-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingDraft ? "Editar Rascunho" : "Novo Post"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Cliente (opcional)</label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum cliente</SelectItem>
                      {clients?.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Plataformas</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={selectedPlatforms.includes("twitter") ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlatform("twitter")}
                      className="gap-2"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter/X
                    </Button>
                    <Button
                      type="button"
                      variant={selectedPlatforms.includes("linkedin") ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlatform("linkedin")}
                      className="gap-2"
                      disabled={linkedInLoading}
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                      {linkedInConnected && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">Conteúdo</label>
                    <span className={`text-xs ${content.length > 280 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {content.length}/280
                    </span>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Digite o conteúdo para publicar..."
                    className="min-h-[150px] resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Button onClick={handlePublish} disabled={isPublishing} className="gap-2">
                    {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publicar Agora
                  </Button>
                  <Button variant="outline" onClick={handleSaveDraft}>
                    Salvar Rascunho
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafts" className="mt-6">
            <div className="space-y-4">
              {!drafts || drafts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Nenhum rascunho salvo</p>
                  </CardContent>
                </Card>
              ) : (
                drafts.map((draft) => (
                  <Card key={draft.id} className="border-border/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm line-clamp-2">{draft.content}</p>
                          <div className="flex gap-2 mt-2">
                            {draft.platforms?.map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEditDraft(draft)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteDraft(draft.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6">
            <div className="space-y-4">
              {!scheduled || scheduled.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Nenhum post agendado</p>
                  </CardContent>
                </Card>
              ) : (
                scheduled.map((post) => (
                  <Card key={post.id} className="border-border/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm line-clamp-2">{post.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {post.scheduled_at && format(new Date(post.scheduled_at), "PPp", { locale: ptBR })}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteDraft(post.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};