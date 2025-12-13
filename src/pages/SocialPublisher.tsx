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
import { Twitter, Linkedin, Send, Loader2, CheckCircle, AlertCircle, Image, Calendar, Clock, Trash2, Link2, Link2Off, FileText, Edit, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SecondaryLayout } from "@/components/SecondaryLayout";

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

const SocialPublisher = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
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

  const saveToContentLibrary = async (contentText: string, platforms: string[], imageUrl?: string | null) => {
    if (!selectedClientId || selectedClientId === "none") return;
    
    try {
      const title = contentText.slice(0, 50) + (contentText.length > 50 ? '...' : '');
      const contentType = platforms.includes('linkedin') ? 'linkedin_post' : 
                          platforms.includes('twitter') ? 'tweet' : 'social_post';
      
      await supabase
        .from('client_content_library')
        .insert({
          client_id: selectedClientId,
          title: `Publicado: ${title}`,
          content: contentText,
          content_type: contentType,
          content_url: imageUrl || null,
          metadata: { 
            source: 'social_publisher', 
            platforms,
            published_at: new Date().toISOString()
          },
        });
      
      // Invalidate content library cache
      queryClient.invalidateQueries({ queryKey: ['content-library', selectedClientId] });
    } catch (error) {
      console.error('Error saving to content library:', error);
    }
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

    // Upload image if file is selected
    const finalImageUrl = await uploadImageToStorage();

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
              imageUrl: finalImageUrl || undefined
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
      // Save to content library on successful publish
      await saveToContentLibrary(content.trim(), selectedPlatforms, finalImageUrl);
      toast.success("Conteúdo publicado com sucesso em todas as plataformas!");
      setContent("");
      clearImage();
    } else if (successCount > 0) {
      // Save to content library even if partial success
      await saveToContentLibrary(content.trim(), selectedPlatforms, finalImageUrl);
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
      // Upload image if file is selected
      const finalImageUrl = await uploadImageToStorage();

      if (editingDraft) {
        await updatePost.mutateAsync({
          id: editingDraft,
          content: content.trim(),
          platforms: selectedPlatforms,
          client_id: selectedClientId || undefined,
          image_url: finalImageUrl || undefined,
        });
        toast.success("Rascunho atualizado!");
        setEditingDraft(null);
      } else {
        await createPost.mutateAsync({
          content: content.trim(),
          platforms: selectedPlatforms,
          client_id: selectedClientId || undefined,
          image_url: finalImageUrl || undefined,
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
      // Upload image if file is selected
      const finalImageUrl = await uploadImageToStorage();

      await createPost.mutateAsync({
        content: content.trim(),
        platforms: selectedPlatforms,
        client_id: selectedClientId || undefined,
        image_url: finalImageUrl || undefined,
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione apenas arquivos de imagem");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl(""); // Clear URL input when file is selected
  };

  const uploadImageToStorage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;

    setIsUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('social-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('social-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload da imagem: " + error.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setImageUrl("");
  };

  return (
    <SecondaryLayout title="Publicador Social">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

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
                      Imagem (opcional)
                    </label>
                    
                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="relative w-full max-w-[200px]">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-auto rounded-lg border border-border/50"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={clearImage}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {!imagePreview && (
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md cursor-pointer hover:bg-accent/50 transition-colors">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {isUploading ? "Enviando..." : "Upload de imagem"}
                            </span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={isUploading}
                          />
                        </label>
                        <span className="flex items-center text-xs text-muted-foreground">ou</span>
                        <Input
                          value={imageUrl}
                          onChange={(e) => {
                            setImageUrl(e.target.value);
                            setImagePreview(e.target.value);
                            setImageFile(null);
                          }}
                          placeholder="Cole URL da imagem"
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Agendar
                      <Badge variant="outline" className="text-xs">Em breve</Badge>
                    </label>
                    <div className="flex gap-2 opacity-50 pointer-events-none">
                      <Input
                        type="date"
                        disabled
                        placeholder="Data"
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        disabled
                        className="w-32"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recurso de agendamento em desenvolvimento
                    </p>
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
    </SecondaryLayout>
  );
};

export default SocialPublisher;
