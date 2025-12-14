import React, { memo, useCallback, useMemo, useState } from 'react';
// @ts-ignore - react-window types
import { FixedSizeList as List } from 'react-window';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Play, Image, LayoutGrid, Copy, ExternalLink, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { InstagramPost } from '@/types/performance';

interface VirtualizedPostsTableProps {
  posts: InstagramPost[];
  isLoading?: boolean;
  height?: number;
}

const ROW_HEIGHT = 72;

const PostTypeIcon = memo(({ type }: { type: string | null | undefined }) => {
  switch (type?.toLowerCase()) {
    case 'video':
    case 'reel':
      return <Play className="h-4 w-4" />;
    case 'carousel':
      return <LayoutGrid className="h-4 w-4" />;
    default:
      return <Image className="h-4 w-4" />;
  }
});

PostTypeIcon.displayName = 'PostTypeIcon';

const PostRow = memo(({ 
  post, 
  style, 
  onCopy 
}: { 
  post: InstagramPost; 
  style: React.CSSProperties;
  onCopy: (text: string) => void;
}) => {
  const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
  
  return (
    <div 
      style={style} 
      className="flex items-center gap-4 px-4 border-b border-border/50 hover:bg-muted/30 transition-colors group"
    >
      {/* Type & Thumbnail */}
      <div className="flex items-center gap-3 w-[200px] min-w-[200px]">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
          <PostTypeIcon type={post.post_type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {post.caption?.slice(0, 40) || 'Sem legenda'}
            {(post.caption?.length || 0) > 40 && '...'}
          </p>
          <p className="text-xs text-muted-foreground">
            {post.posted_at 
              ? format(new Date(post.posted_at), 'dd MMM yyyy', { locale: ptBR })
              : '-'
            }
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Heart className="h-3.5 w-3.5 text-pink-500" />
          <span>{(post.likes || 0).toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
          <span>{(post.comments || 0).toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Share2 className="h-3.5 w-3.5 text-green-500" />
          <span>{(post.shares || 0).toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Bookmark className="h-3.5 w-3.5 text-orange-500" />
          <span>{(post.saves || 0).toLocaleString('pt-BR')}</span>
        </div>
      </div>

      {/* Engagement Badge */}
      <div className="w-[100px]">
        <Badge 
          variant="outline" 
          className={
            engagement > 1000 
              ? 'border-green-500/50 text-green-500 bg-green-500/10' 
              : engagement > 500 
                ? 'border-blue-500/50 text-blue-500 bg-blue-500/10'
                : 'border-muted-foreground/50'
          }
        >
          {engagement > 1000 ? 'Alto' : engagement > 500 ? 'Médio' : 'Normal'}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {post.permalink && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onCopy(post.permalink!)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(post.permalink!, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

PostRow.displayName = 'PostRow';

export const VirtualizedPostsTable = memo(({ 
  posts, 
  isLoading,
  height = 400 
}: VirtualizedPostsTableProps) => {
  const [search, setSearch] = useState('');

  const filteredPosts = useMemo(() => {
    if (!search) return posts;
    const searchLower = search.toLowerCase();
    return posts.filter(post => 
      post.caption?.toLowerCase().includes(searchLower) ||
      post.post_type?.toLowerCase().includes(searchLower)
    );
  }, [posts, search]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  }, []);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const post = filteredPosts[index];
    return <PostRow post={post} style={style} onCopy={handleCopy} />;
  }, [filteredPosts, handleCopy]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Image className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhum post encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar posts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-t-lg text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-[200px] min-w-[200px]">Post</div>
        <div className="flex-1">Métricas</div>
        <div className="w-[100px]">Performance</div>
        <div className="w-[72px]">Ações</div>
      </div>

      {/* Virtualized List */}
      <List
        height={height}
        itemCount={filteredPosts.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        className="rounded-b-lg border border-border/50"
      >
        {Row}
      </List>

      <p className="text-xs text-muted-foreground text-center">
        Mostrando {filteredPosts.length} de {posts.length} posts
      </p>
    </div>
  );
});

VirtualizedPostsTable.displayName = 'VirtualizedPostsTable';
