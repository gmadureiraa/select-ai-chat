import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderPlus, Loader2, Image as ImageIcon, ExternalLink, CheckCircle } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { useContentLibrary, ContentType } from "@/hooks/useContentLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncToLibraryDialogProps {
  post: InstagramPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

interface AttachedItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
}

export function SyncToLibraryDialog({ post, open, onOpenChange, clientId }: SyncToLibraryDialogProps) {
  const [title, setTitle] = useState("");
  const [downloadImages, setDownloadImages] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const { createContent } = useContentLibrary(clientId);
  const { toast } = useToast();

  // Reset state when post changes
  useEffect(() => {
    if (post) {
      // Generate title from caption (first 60 chars) or fallback
      const captionTitle = post.caption?.split('\n')[0]?.slice(0, 60) || "";
      setTitle(captionTitle || `Post ${post.post_type || 'Instagram'}`);
      setSyncSuccess(false);
    }
  }, [post]);

  const handleSync = async () => {
    if (!post) return;
    setIsSyncing(true);

    try {
      let attachments: AttachedItem[] = [];

      // If we have a permalink and user wants to download images, try to extract them
      if (post.permalink && downloadImages) {
        try {
          const { data, error } = await supabase.functions.invoke('extract-instagram', {
            body: { url: post.permalink }
          });

          if (!error && data?.images && Array.isArray(data.images)) {
            attachments = data.images.map((url: string, idx: number) => ({
              id: `img-${idx + 1}`,
              name: `Imagem ${idx + 1}`,
              url,
              type: 'image' as const,
            }));
          }
        } catch (extractError) {
          console.warn('Could not extract images from permalink:', extractError);
          // Continue without extracted images
        }
      }

      // If no images extracted but has thumbnail, use it
      if (attachments.length === 0 && post.thumbnail_url) {
        attachments = [{
          id: 'thumb-1',
          name: 'Thumbnail',
          url: post.thumbnail_url,
          type: 'image' as const,
        }];
      }

      // Map post_type to content_type
      let contentType: ContentType = 'instagram_post';
      if (post.post_type === 'carousel') {
        contentType = 'carousel';
      } else if (post.post_type === 'reel') {
        contentType = 'short_video';
      } else if (post.post_type === 'story') {
        contentType = 'stories';
      } else if (post.post_type === 'image') {
        contentType = 'static_image';
      }

      // Create the content in library
      await createContent.mutateAsync({
        title: title.trim() || `Post Instagram ${post.post_type || ''}`,
        content_type: contentType,
        content: post.caption || '',
        content_url: post.permalink || '',
        thumbnail_url: post.thumbnail_url || attachments[0]?.url || '',
        metadata: {
          attachments,
          image_urls: attachments.map(a => a.url),
          source: 'performance_sync',
          original_post_id: post.id,
          post_type: post.post_type,
          posted_at: post.posted_at,
          metrics: {
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            saves: post.saves,
            reach: post.reach,
            impressions: post.impressions,
            engagement_rate: post.engagement_rate,
          }
        }
      });

      setSyncSuccess(true);
      
      // Close after brief delay to show success state
      setTimeout(() => {
        onOpenChange(false);
        setSyncSuccess(false);
      }, 1500);

    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível salvar o post na biblioteca.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Salvar na Biblioteca
          </DialogTitle>
          <DialogDescription>
            Adicione este post à biblioteca de conteúdo do cliente.
          </DialogDescription>
        </DialogHeader>

        {syncSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Sincronizado com sucesso!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg border">
              {post.thumbnail_url ? (
                <img 
                  src={post.thumbnail_url} 
                  alt="Post preview" 
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 leading-snug">
                  {post.caption || 'Sem legenda'}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">{post.post_type || 'image'}</span>
                  <span>•</span>
                  <span>{post.likes?.toLocaleString() || 0} curtidas</span>
                  {post.posted_at && (
                    <>
                      <span>•</span>
                      <span>{format(new Date(post.posted_at), "dd MMM yyyy", { locale: ptBR })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Title field */}
            <div className="space-y-2">
              <Label htmlFor="sync-title">Título na biblioteca</Label>
              <Input 
                id="sync-title"
                value={title} 
                onChange={e => setTitle(e.target.value)}
                placeholder="Título do conteúdo"
              />
            </div>

            {/* Download images option */}
            {post.permalink && (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <Checkbox 
                  id="download-images"
                  checked={downloadImages} 
                  onCheckedChange={(checked) => setDownloadImages(!!checked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="download-images" className="text-sm font-medium cursor-pointer">
                    Baixar imagens do carrossel
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Extrai todas as imagens do post original para anexar na biblioteca
                  </p>
                </div>
              </div>
            )}

            {/* Link to original */}
            {post.permalink && (
              <a 
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver post original no Instagram
              </a>
            )}
          </div>
        )}

        {!syncSuccess && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSync} disabled={isSyncing || !title.trim()}>
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Salvar na Biblioteca
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
