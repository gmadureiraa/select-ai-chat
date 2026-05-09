// MetricoolInboxPanel — caixa unificada de DMs + comments + reviews.
import { useState } from 'react';
import { useMetricoolInbox, useMetricoolInboxActions } from '@/hooks/useMetricoolInbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, MessagesSquare, Star, Send, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
}

type InboxMode = 'list-conversations' | 'list-comments' | 'list-reviews';

const PROVIDERS: Array<{ value: string; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'threads', label: 'Threads' },
];

export function MetricoolInboxPanel({ clientId }: Props) {
  const [mode, setMode] = useState<InboxMode>('list-conversations');
  const [provider, setProvider] = useState<string>('instagram');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const { data, isLoading } = useMetricoolInbox(clientId, mode, provider);
  const { sendMessage, replyComment, replyReview, setStatus } = useMetricoolInboxActions(clientId);

  const items: any[] = (data?.conversations || data?.comments || data?.reviews || []) as any[];

  const handleSend = async (item: any) => {
    const text = replyText[item.id]?.trim();
    if (!text) return;
    if (mode === 'list-conversations') {
      await sendMessage.mutateAsync({ conversationId: item.id, text });
    } else if (mode === 'list-comments') {
      await replyComment.mutateAsync({ commentId: item.id, text, network: item.network });
    } else if (mode === 'list-reviews') {
      await replyReview.mutateAsync({ reviewId: item.id, text, network: item.network });
    }
    setReplyText((p) => ({ ...p, [item.id]: '' }));
    setActiveReplyId(null);
  };

  const handleClose = async (item: any) => {
    const type = mode === 'list-conversations' ? 'conversation' : 'comment';
    await setStatus.mutateAsync({ id: item.id, status: 'CLOSED', type: type as any });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5" /> Caixa unificada (Metricool)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Plataforma:</span>
          {PROVIDERS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={provider === p.value ? 'default' : 'outline'}
              onClick={() => setProvider(p.value)}
              className="h-7 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as InboxMode)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="list-conversations" className="gap-1">
              <MessageCircle className="h-3 w-3" /> DMs
            </TabsTrigger>
            <TabsTrigger value="list-comments" className="gap-1">
              <MessagesSquare className="h-3 w-3" /> Comentários
            </TabsTrigger>
            <TabsTrigger value="list-reviews" className="gap-1">
              <Star className="h-3 w-3" /> Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value={mode} className="mt-4 space-y-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            )}
            {!isLoading && items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center p-8">
                Nenhum item. Inbox vazio ou plataformas ainda sincronizando.
              </div>
            )}
            {items.map((item) => {
              const id = String(item.id);
              const date =
                item.lastMessageDate ?? item.createdAt ?? item.date ?? item.timestamp ?? null;
              const network = item.network || item.platform || '';
              const text =
                item.lastMessage ?? item.text ?? item.content ?? item.message ?? '(sem texto)';
              const author = item.participantName ?? item.authorName ?? item.author ?? 'Anônimo';
              const isReplying = activeReplyId === id;
              const unread = item.unreadCount ?? 0;

              return (
                <div key={id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{author}</span>
                        {network && <Badge variant="outline" className="text-xs">{network}</Badge>}
                        {unread > 0 && <Badge variant="destructive" className="text-xs">{unread} novas</Badge>}
                        {date && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="text-sm mt-1 line-clamp-2">{text}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveReplyId(isReplying ? null : id)}
                      >
                        {isReplying ? 'Cancelar' : 'Responder'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleClose(item)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {isReplying && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Sua resposta..."
                        value={replyText[id] || ''}
                        onChange={(e) => setReplyText((p) => ({ ...p, [id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSend(item);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSend(item)}
                        disabled={!replyText[id]?.trim() || sendMessage.isPending || replyComment.isPending || replyReview.isPending}
                      >
                        {sendMessage.isPending || replyComment.isPending || replyReview.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
