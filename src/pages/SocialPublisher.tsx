import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClients } from "@/hooks/useClients";
import { useScheduledPosts, useCreateScheduledPost, useDeleteScheduledPost, useUpdateScheduledPost } from "@/hooks/useScheduledPosts";
import { useLinkedInConnection } from "@/hooks/useLinkedInConnection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Twitter, Linkedin, Send, Loader2, CheckCircle, AlertCircle, Image, Calendar, Clock, Trash2, Link2, Link2Off, FileText, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

const SocialPublisher = () => {
  const [searchParams] = useSearchParams();
  const { clients, isLoading: clientsLoading } = useClients();
  const { data: drafts, isLoading: draftsLoading } = useScheduledPosts('draft');
  const { data: scheduled, isLoading: scheduledLoading } = useScheduledPosts('scheduled');
  const createPost = useCreateScheduledPost();
  const deletePost = useDeleteScheduledPost();
  const updatePost = useUpdateScheduledPost();
  const { isConnected: linkedInConnected, isLoading: linkedInLoading, initiateOAuth, disconnect, refetch: refetchLinkedIn } = useLinkedInConnection();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [activeTab, setActiveTab] = useState("publish");
  const [editingDraft, setEditingDraft] = useState<string | null>(null);

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  // Handle LinkedIn OAuth callbacks
  useEffect(() => {
    const linkedinConnected = searchParams.get("linkedin_connected");
    const linkedinError = searchParams.get("linkedin_error");

    if (linkedinConnected) {
      toast.success("LinkedIn conectado com sucesso!");
      refetchLinkedIn();
      window.history.replaceState({}, "", "/social-publisher");
    }

    if (linkedinError) {
      toast.error(`Erro ao conectar LinkedIn: ${linkedinError}`);
      window.history.replaceState({}, "", "/social-publisher");
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
        console.error(`Error publishing to ${platform}:`, error);
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
      toast.success("Conteúdo publicado com sucesso em todas as plataformas!");
      setContent("");
      setImageUrl("");
    } else if (successCount > 0) {
      toast.warning(`Publicado em ${successCount}/${results.length} plataformas`);
    } else {
      toast.error("Erro ao publicar em todas as plataformas");
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
      setImageUrl("");
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
      setImageUrl("");
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
    setEditingDraft(draft.id);
    setActiveTab("publish");
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <PageHeader
        title="Publicador Social"
        subtitle="Publique, agende e gerencie conteúdo no Twitter e LinkedIn"
        backTo="/agents"
      />

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
                        {content.length}/280 (Twitter)
                      </span>
                    </div>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Digite o conteúdo para publicar..."
                      className="min-h-[150px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      URL da Imagem (opcional)
                    </label>
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Agendar (opcional)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handlePublish}
                      disabled={isPublishing || !content.trim() || selectedPlatforms.length === 0}
                      className="flex-1 gap-2"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Publicando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Publicar Agora
                        </>
                      )}
                    </Button>
                    {(scheduleDate && scheduleTime) && (
                      <Button
                        onClick={handleSchedule}
                        variant="secondary"
                        disabled={!content.trim() || selectedPlatforms.length === 0}
                        className="gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Agendar
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveDraft}
                      variant="outline"
                      disabled={!content.trim()}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      {editingDraft ? "Atualizar" : "Salvar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg">Conexões</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Twitter className="h-5 w-5" />
                      <span className="text-sm">Twitter/X</span>
                    </div>
                    <Badge variant="default" className="bg-green-500/20 text-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-5 w-5" />
                      <span className="text-sm">LinkedIn</span>
                    </div>
                    {linkedInLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : linkedInConnected ? (
                      <Button size="sm" variant="ghost" onClick={disconnect} className="gap-1 text-destructive">
                        <Link2Off className="h-3 w-3" />
                        Desconectar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={initiateOAuth} className="gap-1">
                        <Link2 className="h-3 w-3" />
                        Conectar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {publishResults.length > 0 && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {publishResults.map((result, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            result.success
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-destructive/30 bg-destructive/10'
                          }`}
                        >
                          {result.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{result.platform}</p>
                            {result.success ? (
                              <p className="text-xs text-muted-foreground truncate">
                                ID: {result.postId}
                              </p>
                            ) : (
                              <p className="text-xs text-destructive truncate">
                                {result.error}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="mt-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Rascunhos</CardTitle>
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : drafts && drafts.length > 0 ? (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="p-4 rounded-lg border border-border/50 space-y-2">
                      <p className="text-sm line-clamp-3">{draft.content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {draft.platforms?.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p === 'twitter' ? 'Twitter' : 'LinkedIn'}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEditDraft(draft)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteDraft(draft.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum rascunho salvo
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Posts Agendados</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : scheduled && scheduled.length > 0 ? (
                <div className="space-y-3">
                  {scheduled.map((post) => (
                    <div key={post.id} className="p-4 rounded-lg border border-border/50 space-y-2">
                      <p className="text-sm line-clamp-3">{post.content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {post.scheduled_at && format(new Date(post.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {post.platforms?.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p === 'twitter' ? 'Twitter' : 'LinkedIn'}
                            </Badge>
                          ))}
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteDraft(post.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum post agendado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialPublisher;
