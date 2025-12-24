import { useState } from 'react';
import { Plus, X, GripVertical, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ThreadTweet {
  id: string;
  text: string;
  media_urls: string[];
}

interface ThreadEditorProps {
  value: ThreadTweet[];
  onChange: (tweets: ThreadTweet[]) => void;
  clientId?: string;
  className?: string;
}

const MAX_TWEET_LENGTH = 280;

export function ThreadEditor({
  value,
  onChange,
  clientId,
  className
}: ThreadEditorProps) {
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addTweet = () => {
    const newTweet: ThreadTweet = {
      id: `tweet-${Date.now()}`,
      text: '',
      media_urls: []
    };
    onChange([...value, newTweet]);
  };

  const updateTweet = (id: string, text: string) => {
    onChange(value.map(t => t.id === id ? { ...t, text } : t));
  };

  const removeTweet = (id: string) => {
    if (value.length <= 1) {
      toast.error('Thread precisa ter pelo menos 1 tweet');
      return;
    }
    onChange(value.filter(t => t.id !== id));
  };

  const handleImageUpload = async (tweetId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploadingFor(tweetId);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = clientId 
        ? `threads/${clientId}/${fileName}` 
        : `threads/general/${fileName}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      onChange(value.map(t => {
        if (t.id === tweetId && t.media_urls.length < 4) {
          return { ...t, media_urls: [...t.media_urls, urlData.publicUrl] };
        }
        return t;
      }));
      
      toast.success('Imagem adicionada');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploadingFor(null);
    }
  };

  const removeImage = (tweetId: string, imageUrl: string) => {
    onChange(value.map(t => {
      if (t.id === tweetId) {
        return { ...t, media_urls: t.media_urls.filter(url => url !== imageUrl) };
      }
      return t;
    }));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTweets = [...value];
    const draggedItem = newTweets[draggedIndex];
    newTweets.splice(draggedIndex, 1);
    newTweets.splice(index, 0, draggedItem);
    onChange(newTweets);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Initialize with one tweet if empty
  if (value.length === 0) {
    addTweet();
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Thread ({value.length} tweets)</span>
      </div>

      <div className="space-y-2">
        {value.map((tweet, index) => (
          <div
            key={tweet.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "rounded-lg border border-border bg-card p-3 space-y-2",
              draggedIndex === index && "opacity-50"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1 pt-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <span className="text-xs font-medium text-muted-foreground w-4">
                  {index + 1}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                <div className="relative">
                  <Textarea
                    value={tweet.text}
                    onChange={(e) => updateTweet(tweet.id, e.target.value)}
                    placeholder={index === 0 ? "Primeiro tweet da thread..." : "Continuar thread..."}
                    className="resize-none min-h-[80px] pr-16"
                    maxLength={MAX_TWEET_LENGTH}
                  />
                  <span className={cn(
                    "absolute bottom-2 right-2 text-xs",
                    tweet.text.length > MAX_TWEET_LENGTH - 20 
                      ? "text-destructive" 
                      : "text-muted-foreground"
                  )}>
                    {tweet.text.length}/{MAX_TWEET_LENGTH}
                  </span>
                </div>

                {/* Tweet images */}
                {tweet.media_urls.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {tweet.media_urls.map((url, imgIndex) => (
                      <div key={imgIndex} className="relative w-16 h-16 group">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover rounded-md"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(tweet.id, url)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {tweet.media_urls.length < 4 && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(tweet.id, file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        type="button"
                        disabled={uploadingFor === tweet.id}
                        asChild
                      >
                        <span>
                          {uploadingFor === tweet.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Image className="h-3 w-3" />
                          )}
                          Imagem
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeTweet(tweet.id)}
                disabled={value.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={addTweet}
      >
        <Plus className="h-4 w-4" />
        Adicionar Tweet
      </Button>
    </div>
  );
}