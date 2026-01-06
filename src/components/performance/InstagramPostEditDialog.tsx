import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calendar, Image as ImageIcon, Upload, Loader2, Save, Link, Users, MousePointer, Eye, ExternalLink } from "lucide-react";
import { InstagramPost, useUpdateInstagramPost } from "@/hooks/useInstagramPosts";
import { uploadToClientFiles, getPublicUrl } from "@/lib/storage";
import { format } from "date-fns";

interface InstagramPostEditDialogProps {
  post: InstagramPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

const CONTENT_OBJECTIVES = [
  { value: "educational", label: "Educacional" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "sales", label: "Vendas" },
  { value: "institutional", label: "Institucional" },
  { value: "trend", label: "Trend" },
  { value: "engagement", label: "Engajamento" },
  { value: "awareness", label: "Awareness" },
  { value: "other", label: "Outro" },
];

const POST_TYPES = [
  { value: "image", label: "Imagem" },
  { value: "carousel", label: "Carrossel" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "video", label: "Vídeo" },
];

export function InstagramPostEditDialog({ post, open, onOpenChange, clientId }: InstagramPostEditDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const updatePost = useUpdateInstagramPost();

  // Form state
  const [formData, setFormData] = useState({
    caption: post?.caption || "",
    post_type: post?.post_type || "image",
    posted_at: post?.posted_at ? format(new Date(post.posted_at), "yyyy-MM-dd") : "",
    permalink: post?.permalink || "",
    thumbnail_url: post?.thumbnail_url || "",
    // Engagement metrics
    likes: post?.likes || 0,
    comments: post?.comments || 0,
    shares: post?.shares || 0,
    saves: post?.saves || 0,
    reach: post?.reach || 0,
    impressions: post?.impressions || 0,
    engagement_rate: post?.engagement_rate || 0,
    // Conversion metrics (from new columns)
    link_clicks: (post as any)?.link_clicks || 0,
    profile_visits: (post as any)?.profile_visits || 0,
    website_taps: (post as any)?.website_taps || 0,
    // Classification
    content_objective: (post as any)?.content_objective || "",
    is_collab: (post as any)?.is_collab || false,
    // From metadata
    follows_from_post: (post?.metadata as any)?.follows_from_post || 0,
  });

  // Update form when post changes
  useState(() => {
    if (post) {
      setFormData({
        caption: post.caption || "",
        post_type: post.post_type || "image",
        posted_at: post.posted_at ? format(new Date(post.posted_at), "yyyy-MM-dd") : "",
        permalink: post.permalink || "",
        thumbnail_url: post.thumbnail_url || "",
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves || 0,
        reach: post.reach || 0,
        impressions: post.impressions || 0,
        engagement_rate: post.engagement_rate || 0,
        link_clicks: (post as any)?.link_clicks || 0,
        profile_visits: (post as any)?.profile_visits || 0,
        website_taps: (post as any)?.website_taps || 0,
        content_objective: (post as any)?.content_objective || "",
        is_collab: (post as any)?.is_collab || false,
        follows_from_post: (post?.metadata as any)?.follows_from_post || 0,
      });
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;

    setIsUploading(true);
    try {
      const folder = `${clientId}/instagram-covers`;
      const { path, error } = await uploadToClientFiles(file, folder);
      
      if (error) throw error;
      
      const publicUrl = getPublicUrl(path);
      setFormData(prev => ({ ...prev, thumbnail_url: publicUrl }));
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!post) return;

    const updates = {
      caption: formData.caption,
      post_type: formData.post_type,
      posted_at: formData.posted_at ? new Date(formData.posted_at).toISOString() : null,
      permalink: formData.permalink,
      thumbnail_url: formData.thumbnail_url,
      likes: Number(formData.likes),
      comments: Number(formData.comments),
      shares: Number(formData.shares),
      saves: Number(formData.saves),
      reach: Number(formData.reach),
      impressions: Number(formData.impressions),
      engagement_rate: Number(formData.engagement_rate),
      link_clicks: Number(formData.link_clicks),
      profile_visits: Number(formData.profile_visits),
      website_taps: Number(formData.website_taps),
      content_objective: formData.content_objective || null,
      is_collab: formData.is_collab,
      metadata: {
        ...(post.metadata as object || {}),
        follows_from_post: Number(formData.follows_from_post),
      },
    };

    updatePost.mutate(
      { postId: post.id, updates },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-pink-500" />
            Editar Post do Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cover Image Section */}
          <div className="flex gap-4">
            <div 
              className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 flex-shrink-0 cursor-pointer relative group"
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.thumbnail_url ? (
                <img 
                  src={formData.thumbnail_url} 
                  alt="Capa" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-white" />
                )}
              </div>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
            />
            <div className="flex-1 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Link do Post</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.permalink}
                    onChange={(e) => updateField("permalink", e.target.value)}
                    placeholder="https://instagram.com/p/..."
                    className="h-8 text-sm"
                  />
                  {formData.permalink && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      asChild
                    >
                      <a href={formData.permalink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Data</Label>
                  <Input
                    type="date"
                    value={formData.posted_at}
                    onChange={(e) => updateField("posted_at", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={formData.post_type} onValueChange={(v) => updateField("post_type", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Caption */}
          <div>
            <Label className="text-xs text-muted-foreground">Legenda</Label>
            <Textarea
              value={formData.caption}
              onChange={(e) => updateField("caption", e.target.value)}
              placeholder="Legenda do post..."
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          <Separator />

          {/* Engagement Metrics */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              Métricas de Engajamento
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[
                { key: "likes", label: "Curtidas" },
                { key: "comments", label: "Comentários" },
                { key: "shares", label: "Compartilhamentos" },
                { key: "saves", label: "Salvamentos" },
                { key: "reach", label: "Alcance" },
                { key: "impressions", label: "Impressões" },
                { key: "engagement_rate", label: "Tx. Engajamento (%)" },
              ].map(metric => (
                <div key={metric.key}>
                  <Label className="text-[10px] text-muted-foreground">{metric.label}</Label>
                  <Input
                    type="number"
                    value={formData[metric.key as keyof typeof formData] as number}
                    onChange={(e) => updateField(metric.key, e.target.value)}
                    className="h-8 text-sm"
                    min={0}
                    step={metric.key === "engagement_rate" ? "0.01" : "1"}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Conversion Metrics */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-green-500" />
              Métricas de Conversão
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Link className="h-3 w-3" /> Cliques no Link
                </Label>
                <Input
                  type="number"
                  value={formData.link_clicks}
                  onChange={(e) => updateField("link_clicks", e.target.value)}
                  className="h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Visitas no Perfil
                </Label>
                <Input
                  type="number"
                  value={formData.profile_visits}
                  onChange={(e) => updateField("profile_visits", e.target.value)}
                  className="h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Toques no Site
                </Label>
                <Input
                  type="number"
                  value={formData.website_taps}
                  onChange={(e) => updateField("website_taps", e.target.value)}
                  className="h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Novos Seguidores
                </Label>
                <Input
                  type="number"
                  value={formData.follows_from_post}
                  onChange={(e) => updateField("follows_from_post", e.target.value)}
                  className="h-8 text-sm"
                  min={0}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Classification */}
          <div>
            <h4 className="text-sm font-medium mb-3">Classificação</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Objetivo do Conteúdo</Label>
                <Select 
                  value={formData.content_objective} 
                  onValueChange={(v) => updateField("content_objective", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_OBJECTIVES.map(obj => (
                      <SelectItem key={obj.value} value={obj.value}>{obj.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Post Colaborativo</Label>
                  <p className="text-[10px] text-muted-foreground">Feito em parceria</p>
                </div>
                <Switch
                  checked={formData.is_collab}
                  onCheckedChange={(checked) => updateField("is_collab", checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updatePost.isPending}>
            {updatePost.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
