// MetricoolInboxPanel — caixa unificada de DMs + comments + reviews.
// Layout master-detail (Gmail/Linear style):
//   - Header compacto: provider tabs + tipo (DM/Comments/Reviews) + search + toggle não-lidos + bulk
//   - LEFT (~360px): lista virtualizada-friendly de items (avatar, nome, preview, data, dot azul)
//   - RIGHT (flex 1): detalhe da conversa selecionada com header sticky + mensagens + reply box sticky
//   - Mobile: lista cheia, detalhe abre como Sheet
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMetricoolInbox, useMetricoolInboxActions } from '@/hooks/useMetricoolInbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Archive,
  MessageSquarePlus,
  MessageCircleMore,
  Filter,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  AtSign,
  Hash,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InboxQuickReplies } from './InboxQuickReplies';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
}

type InboxMode = 'list-conversations' | 'list-comments' | 'list-reviews';

const PROVIDERS: Array<{
  value: string;
  label: string;
  short: string;
  Icon: typeof Instagram;
}> = [
  { value: 'instagram', label: 'Instagram', short: 'IG', Icon: Instagram },
  { value: 'facebook', label: 'Facebook', short: 'FB', Icon: Facebook },
  { value: 'twitter', label: 'X / Twitter', short: 'X', Icon: AtSign },
  { value: 'linkedin', label: 'LinkedIn', short: 'LI', Icon: Linkedin },
  { value: 'tiktok', label: 'TikTok', short: 'TT', Icon: Hash },
  { value: 'youtube', label: 'YouTube', short: 'YT', Icon: Youtube },
  { value: 'threads', label: 'Threads', short: 'Th', Icon: AtSign },
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

function getItemAvatar(item: any): string | undefined {
  return (
    item?.participantPicture ?? item?.authorPicture ?? item?.avatar ?? undefined
  );
}

function getItemHandle(item: any): string | undefined {
  return item?.participantHandle ?? item?.authorHandle ?? undefined;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function getItemDate(item: any): Date | null {
  const v = item?.lastMessageDate ?? item?.createdAt ?? item?.date ?? item?.timestamp;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getMessages(item: any): Array<{ id?: string; text: string; from?: 'self' | 'them'; date?: Date | null }> {
  // Tenta extrair thread real se existir; senão usa o último msg como bubble único.
  const arr = item?.messages ?? item?.thread ?? item?.replies;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((m: any, i: number) => {
      const isSelf =
        m?.from === 'self' ||
        m?.fromSelf === true ||
        m?.isSelf === true ||
        (typeof m?.direction === 'string' && m.direction.toLowerCase() === 'out');
      const date = m?.date ?? m?.createdAt ?? m?.timestamp ?? null;
      return {
        id: m?.id ?? String(i),
        text: (m?.text ?? m?.content ?? m?.message ?? '').toString(),
        from: isSelf ? 'self' : 'them',
        date: date ? new Date(date) : null,
      };
    }).filter((m) => m.text);
  }
  const text = getItemText(item);
  const date = getItemDate(item);
  return text ? [{ id: 'last', text, from: 'them', date }] : [];
}

export function MetricoolInboxPanel({ clientId }: Props) {
  const [mode, setMode] = useState<InboxMode>('list-conversations');
  const [provider, setProvider] = useState<string>('instagram');
  const [search, setSearch] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  const { data, isLoading } = useMetricoolInbox(clientId, mode, provider);
  const { sendMessage, replyComment, replyReview, setStatus } =
    useMetricoolInboxActions(clientId);

  const items: any[] = useMemo(
    () => (data?.conversations || data?.comments || data?.reviews || []) as any[],
    [data],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (unreadOnly && !(Number(item?.unreadCount) > 0)) return false;
      if (!q) return true;
      const text = getItemText(item).toLowerCase();
      const author = getItemAuthor(item).toLowerCase();
      return text.includes(q) || author.includes(q);
    });
  }, [items, search, unreadOnly]);

  // Auto-seleciona primeiro item quando lista muda e nada selecionado.
  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !filteredItems.some((i) => String(i.id) === selectedItemId)) {
      // No mobile não auto-seleciona pra não abrir sheet por engano
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedItemId(String(filteredItems[0].id));
      }
    }
  }, [filteredItems, selectedItemId]);

  // Reseta draft quando muda item selecionado.
  useEffect(() => {
    setReplyDraft('');
  }, [selectedItemId]);

  // Reset ao trocar de modo/provider/cliente.
  const handleModeChange = (v: string) => {
    setMode(v as InboxMode);
    setSelectedItemId(null);
  };
  const handleProviderChange = (v: string) => {
    setProvider(v);
    setSelectedItemId(null);
  };

  const selectedItem = useMemo(
    () => filteredItems.find((i) => String(i.id) === selectedItemId) || null,
    [filteredItems, selectedItemId],
  );

  const totalUnread = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i?.unreadCount) || 0), 0),
    [items],
  );
  const openCount = useMemo(() => {
    if (mode === 'list-reviews') return items.length;
    return items.filter((i) => {
      const status = (i?.status ?? '').toString().toUpperCase();
      return status === 'OPEN' || status === '';
    }).length;
  }, [items, mode]);

  const supportsBulk = mode !== 'list-reviews';
  const bulkType: 'conversation' | 'comment' =
    mode === 'list-conversations' ? 'conversation' : 'comment';

  const sending =
    sendMessage.isPending || replyComment.isPending || replyReview.isPending;

  const handleSend = async () => {
    if (!selectedItem) return;
    const text = replyDraft.trim();
    if (!text) return;
    const id = String(selectedItem.id);
    if (mode === 'list-conversations') {
      await sendMessage.mutateAsync({ conversationId: id, text });
    } else if (mode === 'list-comments') {
      await replyComment.mutateAsync({
        commentId: id,
        text,
        network: selectedItem.network,
      });
    } else if (mode === 'list-reviews') {
      await replyReview.mutateAsync({
        reviewId: id,
        text,
        network: selectedItem.network,
      });
    }
    setReplyDraft('');
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

  const handleMarkRead = async (item: any) => {
    if (!supportsBulk) return;
    await setStatus.mutateAsync({
      id: String(item.id),
      status: 'OPEN',
      type: bulkType,
    });
  };

  const handleMarkAllRead = async () => {
    if (!supportsBulk) return;
    const unread = filteredItems.filter((i) => Number(i?.unreadCount) > 0);
    if (unread.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        unread.map((i) =>
          setStatus.mutateAsync({
            id: String(i.id),
            status: 'OPEN',
            type: bulkType,
          }),
        ),
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSelectItem = (item: any) => {
    setSelectedItemId(String(item.id));
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheet(true);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden">
        {/* Header compacto */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-1 mr-1">
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Inbox</span>
          </div>

          {/* Provider segmented control compacto */}
          <Tabs value={provider} onValueChange={handleProviderChange}>
            <TabsList className="h-8 p-0.5">
              {PROVIDERS.map((p) => (
                <Tooltip key={p.value}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={p.value}
                      className="h-7 px-2 text-[11px] font-medium gap-1 data-[state=active]:bg-background"
                    >
                      <p.Icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{p.short}</span>
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{p.label}</TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </Tabs>

          {/* Mode (DMs / Comments / Reviews) */}
          <Tabs value={mode} onValueChange={handleModeChange} className="ml-auto md:ml-0">
            <TabsList className="h-8">
              <TabsTrigger value="list-conversations" className="h-7 px-2 text-xs gap-1">
                <MessageCircle className="h-3 w-3" />
                <span className="hidden sm:inline">DMs</span>
              </TabsTrigger>
              <TabsTrigger value="list-comments" className="h-7 px-2 text-xs gap-1">
                <MessagesSquare className="h-3 w-3" />
                <span className="hidden sm:inline">Comentários</span>
              </TabsTrigger>
              <TabsTrigger value="list-reviews" className="h-7 px-2 text-xs gap-1">
                <Star className="h-3 w-3" />
                <span className="hidden sm:inline">Reviews</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative ml-auto w-full md:w-56">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 h-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter unread + bulk */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={unreadOnly ? 'default' : 'outline'}
                  onClick={() => setUnreadOnly((v) => !v)}
                  className="h-8 px-2 text-xs gap-1"
                >
                  <Filter className="h-3 w-3" />
                  <span className="hidden lg:inline">Não lidas</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {unreadOnly ? 'Mostrando só não lidas' : 'Filtrar não lidas'}
              </TooltipContent>
            </Tooltip>

            {supportsBulk && totalUnread > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarkAllRead}
                    disabled={bulkBusy}
                    className="h-8 px-2 text-xs gap-1"
                  >
                    {bulkBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3 w-3" />
                    )}
                    <span className="hidden lg:inline">Marcar lidos</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar todos como lidos</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Body — master/detail */}
        <div className="flex h-[640px]">
          {/* LEFT — lista */}
          <div
            className={cn(
              'flex flex-col border-r bg-background',
              'w-full md:w-[360px] md:shrink-0',
            )}
          >
            {/* Stats minimalistas inline */}
            <div className="px-3 py-1.5 border-b text-[11px] text-muted-foreground flex items-center justify-between">
              <span>
                {openCount} abertas · {totalUnread} não lidas
              </span>
              {filteredItems.length !== items.length && (
                <span>{filteredItems.length} filtradas</span>
              )}
            </div>

            <ScrollArea className="flex-1">
              {isLoading && (
                <div className="space-y-px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 animate-pulse"
                    >
                      <div className="h-9 w-9 rounded-full bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-2.5 w-40 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center px-6 py-12 text-sm text-muted-foreground">
                  <MessageCircleMore className="h-8 w-8 mb-2 opacity-40" />
                  {search || unreadOnly
                    ? 'Nenhum item bate com os filtros.'
                    : 'Caixa vazia. Tudo respondido.'}
                </div>
              )}
              {!isLoading &&
                filteredItems.map((item) => {
                  const id = String(item.id);
                  const isSelected = selectedItemId === id;
                  const unread = Number(item?.unreadCount) || 0;
                  const isUnread = unread > 0;
                  const date = getItemDate(item);
                  const author = getItemAuthor(item) || 'Anônimo';
                  const text = getItemText(item) || '(sem texto)';
                  const network =
                    (item?.network || item?.platform || provider) as string;
                  const networkMeta = PROVIDERS.find(
                    (p) => p.value === network.toLowerCase(),
                  );
                  const avatarUrl = getItemAvatar(item);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={cn(
                        'group relative w-full text-left px-3 py-2.5 border-b transition-colors',
                        'hover:bg-accent/60 focus:bg-accent focus:outline-none',
                        isSelected && 'bg-accent',
                      )}
                    >
                      {/* Dot azul não-lido */}
                      {isUnread && (
                        <span
                          className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500"
                          aria-label="Não lido"
                        />
                      )}

                      <div className="flex items-start gap-2.5 pl-2">
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9">
                            {avatarUrl ? <AvatarImage src={avatarUrl} alt={author} /> : null}
                            <AvatarFallback className="text-[11px]">
                              {getInitials(author)}
                            </AvatarFallback>
                          </Avatar>
                          {networkMeta && (
                            <span className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5 border">
                              <networkMeta.Icon className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'text-sm truncate flex-1',
                                isUnread ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {author}
                            </span>
                            {date && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(date, {
                                  addSuffix: false,
                                  locale: ptBR,
                                })}
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              'text-xs line-clamp-1',
                              isUnread ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {text}
                          </p>
                        </div>
                      </div>

                      {/* Hover actions */}
                      {supportsBulk && (
                        <div
                          className={cn(
                            'absolute right-2 top-2 hidden gap-0.5',
                            'group-hover:flex',
                          )}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClose(item);
                                }}
                                className="h-6 w-6 rounded inline-flex items-center justify-center bg-background/80 hover:bg-background border text-muted-foreground hover:text-foreground"
                                aria-label="Arquivar"
                              >
                                <Archive className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Arquivar</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </button>
                  );
                })}
            </ScrollArea>
          </div>

          {/* RIGHT — detalhe (desktop) */}
          <div className="hidden md:flex flex-1 flex-col bg-muted/10">
            {selectedItem ? (
              <ConversationDetail
                key={String(selectedItem.id)}
                item={selectedItem}
                mode={mode}
                clientId={clientId}
                replyDraft={replyDraft}
                setReplyDraft={setReplyDraft}
                onSend={handleSend}
                onClose={() => handleClose(selectedItem)}
                onMarkRead={() => handleMarkRead(selectedItem)}
                sending={sending}
                supportsBulk={supportsBulk}
              />
            ) : (
              <EmptyDetail loading={isLoading} />
            )}
          </div>

          {/* Mobile sheet */}
          <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
            <SheetContent side="right" className="w-full p-0 md:hidden">
              {selectedItem ? (
                <ConversationDetail
                  key={String(selectedItem.id)}
                  item={selectedItem}
                  mode={mode}
                  clientId={clientId}
                  replyDraft={replyDraft}
                  setReplyDraft={setReplyDraft}
                  onSend={handleSend}
                  onClose={() => handleClose(selectedItem)}
                  onMarkRead={() => handleMarkRead(selectedItem)}
                  sending={sending}
                  supportsBulk={supportsBulk}
                  onBack={() => setMobileSheet(false)}
                />
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </Card>
    </TooltipProvider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ConversationDetail — painel direito
// ────────────────────────────────────────────────────────────────────────────

interface DetailProps {
  item: any;
  mode: InboxMode;
  clientId: string;
  replyDraft: string;
  setReplyDraft: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  onMarkRead: () => void;
  sending: boolean;
  supportsBulk: boolean;
  onBack?: () => void;
}

function ConversationDetail({
  item,
  mode,
  clientId,
  replyDraft,
  setReplyDraft,
  onSend,
  onClose,
  onMarkRead,
  sending,
  supportsBulk,
  onBack,
}: DetailProps) {
  const author = getItemAuthor(item) || 'Anônimo';
  const handle = getItemHandle(item);
  const avatarUrl = getItemAvatar(item);
  const network = (item?.network || item?.platform || '') as string;
  const networkMeta = PROVIDERS.find((p) => p.value === network.toLowerCase());
  const lastDate = getItemDate(item);
  const messages = useMemo(() => getMessages(item), [item]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [replyDraft]);

  const isThread = mode === 'list-conversations';
  const placeholder =
    mode === 'list-conversations'
      ? 'Sua resposta...'
      : mode === 'list-comments'
      ? 'Responder ao comentário...'
      : 'Responder ao review...';

  return (
    <div className="flex flex-col h-full">
      {/* Header sticky */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-background">
        {onBack && (
          <Button size="sm" variant="ghost" onClick={onBack} className="md:hidden">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-12 w-12">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={author} /> : null}
          <AvatarFallback>{getInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{author}</span>
            {networkMeta && (
              <Badge variant="outline" className="text-[10px] gap-1 h-5">
                <networkMeta.Icon className="h-2.5 w-2.5" />
                {networkMeta.short}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {handle && <span className="truncate">@{handle}</span>}
            {lastDate && (
              <span>
                ·{' '}
                {formatDistanceToNow(lastDate, { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {supportsBulk && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onMarkRead}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como lido</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    className="h-8 w-8 p-0"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fechar conversa</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    className="h-8 w-8 p-0"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Arquivar</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Sem mensagens.
          </div>
        ) : isThread ? (
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const isSelf = m.from === 'self';
              return (
                <div
                  key={m.id ?? idx}
                  className={cn(
                    'flex',
                    isSelf ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                      isSelf
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm',
                    )}
                  >
                    {m.text}
                    {m.date && (
                      <div
                        className={cn(
                          'text-[10px] mt-1 opacity-70',
                          isSelf ? 'text-right' : 'text-left',
                        )}
                      >
                        {formatDistanceToNow(m.date, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Comments / reviews — mostra item original como card + replies
          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm whitespace-pre-wrap">
                {getItemText(item) || '(sem texto)'}
              </p>
              {mode === 'list-reviews' &&
                typeof item?.rating === 'number' && (
                  <div className="flex gap-0.5 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3.5 w-3.5',
                          i < item.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                )}
            </div>
            {messages.length > 1 &&
              messages.slice(1).map((m, idx) => (
                <div
                  key={m.id ?? idx}
                  className={cn(
                    'flex',
                    m.from === 'self' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                      m.from === 'self'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm',
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>

      {/* Reply box sticky */}
      <div className="border-t bg-background p-3">
        <div className="flex items-end gap-2">
          <InboxQuickReplies
            clientId={clientId}
            currentText={replyDraft}
            onPick={(t) => setReplyDraft(t)}
            disabled={sending}
          />
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            className="resize-none min-h-[36px] max-h-[120px] text-sm py-2"
            disabled={sending}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                onClick={onSend}
                disabled={!replyDraft.trim() || sending}
                className="h-9 px-3 gap-1"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar (⌘+Enter)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function EmptyDetail({ loading }: { loading: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8">
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin mb-3 opacity-60" />
      ) : (
        <MessageCircleMore className="h-12 w-12 mb-3 opacity-30" />
      )}
      <p className="text-sm font-medium text-foreground">
        {loading ? 'Carregando inbox...' : 'Selecione uma conversa'}
      </p>
      {!loading && (
        <p className="text-xs mt-1">
          Escolha um item da lista pra ver e responder.
        </p>
      )}
    </div>
  );
}

// Workaround: o Button do shadcn aceita MessageSquarePlus como ícone de lookup.
// Mantendo import vivo pra evitar tree-shake confuso em alguns toolings.
void MessageSquarePlus;
