// MetricoolInboxPanel — caixa unificada de DMs + comments + reviews.
// Features:
//  - polling 30s (no hook)
//  - search local
//  - stats panel (4 KPIs)
//  - bulk actions (marcar lido / fechar todos selecionados)
//  - quick replies (templates por cliente)
import { useMemo, useState } from 'react';
import { useMetricoolInbox, useMetricoolInboxActions } from '@/hooks/useMetricoolInbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  MessageCircle,
  MessagesSquare,
  Star,
  Send,
  Check,
  Search,
  CheckCheck,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InboxStats } from './InboxStats';
import { InboxQuickReplies } from './InboxQuickReplies';

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

function getItemText(item: any): string {
  return (
    item?.lastMessage ?? item?.text ?? item?.content ?? item?.message ?? ''
  ).toString();
}

function getItemAuthor(item: any): string {
  return (
    item?.participantName ?? item?.authorName ?? item?.author ?? ''
  ).toString();
}

export function MetricoolInboxPanel({ clientId }: Props) {
  const [mode, setMode] = useState<InboxMode>('list-conversations');
  const [provider, setProvider] = useState<string>('instagram');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, isLoading } = useMetricoolInbox(clientId, mode, provider);
  const { sendMessage, replyComment, replyReview, setStatus } =
    useMetricoolInboxActions(clientId);

  const items: any[] = useMemo(
    () => (data?.conversations || data?.comments || data?.reviews || []) as any[],
    [data],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const text = getItemText(item).toLowerCase();
      const author = getItemAuthor(item).toLowerCase();
      return text.includes(q) || author.includes(q);
    });
  }, [items, search]);

  // Reset seleção ao trocar de modo/provider/cliente.
  const resetSelection = () => setSelected({});

  const handleModeChange = (v: string) => {
    setMode(v as InboxMode);
    resetSelection();
    setActiveReplyId(null);
  };
  const handleProviderChange = (v: string) => {
    setProvider(v);
    resetSelection();
    setActiveReplyId(null);
  };

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );
  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selected[String(i.id)]);

  const toggleAll = () => {
    if (allFilteredSelected) {
      resetSelection();
    } else {
      const next: Record<string, boolean> = {};
      filteredItems.forEach((i) => {
        next[String(i.id)] = true;
      });
      setSelected(next);
    }
  };

  const handleSend = async (item: any) => {
    const id = String(item.id);
    const text = replyText[id]?.trim();
    if (!text) return;
    if (mode === 'list-conversations') {
      await sendMessage.mutateAsync({ conversationId: id, text });
    } else if (mode === 'list-comments') {
      await replyComment.mutateAsync({ commentId: id, text, network: item.network });
    } else if (mode === 'list-reviews') {
      await replyReview.mutateAsync({ reviewId: id, text, network: item.network });
    }
    setReplyText((p) => ({ ...p, [id]: '' }));
    setActiveReplyId(null);
  };

  const handleClose = async (item: any) => {
    if (mode === 'list-reviews') return;
    const type = mode === 'list-conversations' ? 'conversation' : 'comment';
    await setStatus.mutateAsync({
      id: String(item.id),
      status: 'CLOSED',
      type: type as 'conversation' | 'comment',
    });
  };

  const runBulk = async (
    target: { status: 'OPEN' | 'CLOSED'; type: 'conversation' | 'comment' },
  ) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          setStatus.mutateAsync({ id, status: target.status, type: target.type }),
        ),
      );
      resetSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const supportsBulk = mode !== 'list-reviews';
  const bulkType: 'conversation' | 'comment' =
    mode === 'list-conversations' ? 'conversation' : 'comment';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5" /> Caixa unificada (Metricool)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats panel */}
        <InboxStats items={items} loading={isLoading} mode={mode} />

        {/* Provider switcher */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Plataforma:</span>
          {PROVIDERS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={provider === p.value ? 'default' : 'outline'}
              onClick={() => handleProviderChange(p.value)}
              className="h-7 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversas/comentários..."
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Tabs value={mode} onValueChange={handleModeChange}>
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
            {/* Bulk action bar */}
            {supportsBulk && filteredItems.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="inbox-select-all"
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                  <label
                    htmlFor="inbox-select-all"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selecionado${selectedIds.length > 1 ? 's' : ''}`
                      : 'Selecionar todos'}
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedIds.length === 0 || bulkBusy}
                    onClick={() => runBulk({ status: 'OPEN', type: bulkType })}
                    className="h-7 text-xs"
                  >
                    {bulkBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3 w-3 mr-1" />
                    )}
                    Marcar lidos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedIds.length === 0 || bulkBusy}
                    onClick={() => runBulk({ status: 'CLOSED', type: bulkType })}
                    className="h-7 text-xs"
                  >
                    {bulkBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Fechar todos
                  </Button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            )}
            {!isLoading && filteredItems.length === 0 && (
              <div className="text-sm text-muted-foreground text-center p-8">
                {search
                  ? 'Nenhum item bate com a busca.'
                  : 'Nenhum item. Inbox vazio ou plataformas ainda sincronizando.'}
              </div>
            )}
            {filteredItems.map((item) => {
              const id = String(item.id);
              const date =
                item.lastMessageDate ?? item.createdAt ?? item.date ?? item.timestamp ?? null;
              const network = item.network || item.platform || '';
              const text = getItemText(item) || '(sem texto)';
              const author = getItemAuthor(item) || 'Anônimo';
              const isReplying = activeReplyId === id;
              const unread = item.unreadCount ?? 0;
              const isSelected = !!selected[id];
              const sending =
                sendMessage.isPending || replyComment.isPending || replyReview.isPending;

              return (
                <div key={id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    {supportsBulk && (
                      <div className="pt-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            setSelected((p) => ({ ...p, [id]: checked === true }))
                          }
                          aria-label={`Selecionar ${author}`}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{author}</span>
                        {network && (
                          <Badge variant="outline" className="text-xs">
                            {network}
                          </Badge>
                        )}
                        {unread > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {unread} novas
                          </Badge>
                        )}
                        {date && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(date), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
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
                      {supportsBulk && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClose(item)}
                          title="Fechar"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isReplying && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Sua resposta..."
                        value={replyText[id] || ''}
                        onChange={(e) =>
                          setReplyText((p) => ({ ...p, [id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSend(item);
                        }}
                      />
                      <InboxQuickReplies
                        clientId={clientId}
                        currentText={replyText[id] || ''}
                        onPick={(t) => setReplyText((p) => ({ ...p, [id]: t }))}
                        disabled={sending}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSend(item)}
                        disabled={!replyText[id]?.trim() || sending}
                      >
                        {sending ? (
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
