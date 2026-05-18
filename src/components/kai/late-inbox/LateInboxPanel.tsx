// LateInboxPanel — Inbox unificado (DMs + comments + reviews) via Late/Zernio.
//
// Substitui o antigo MetricoolInboxPanel (arquivado em
// _TRASH-2026-05-18-metricool-removed/components/metricool-folder/).
//
// Layout master-detail (Gmail/Linear style):
//   - Header com tabs (DMs / Comments / Reviews) + platform filter + search + unread toggle
//   - LEFT (~360px): lista de conversations/comments/reviews
//   - RIGHT (flex 1): thread/detail com reply box sticky
//   - Mobile: lista cheia, detalhe abre como Sheet
//
// Graceful degradation: se Late API falhar (sem credenciais, rede, etc.),
// mostra empty state com mensagem clara em vez de quebrar a tela.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  CheckCheck,
  Filter,
  Loader2,
  MessageCircle,
  MessageCircleMore,
  MessagesSquare,
  Search,
  Send,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  getInboxItemUnreadCount,
  useLateComments,
  useLateConversationMessages,
  useLateConversations,
  useLateReviews,
  useMarkAsRead,
  useReplyComment,
  useReplyMessage,
  useReplyReview,
  type LateComment,
  type LateConversation,
  type LateReview,
} from '@/hooks/useLateInbox';
import { cn } from '@/lib/utils';
import { getNetworkBranding } from '@/lib/network-branding';

interface Props {
  clientId: string;
}

type InboxMode = 'list-conversations' | 'list-comments' | 'list-reviews';

const PROVIDER_NETWORKS = [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'tiktok',
  'youtube',
  'threads',
] as const;

const PROVIDERS: Array<{
  value: string;
  label: string;
  short: string;
  Icon: LucideIcon;
}> = PROVIDER_NETWORKS.map((id) => {
  const b = getNetworkBranding(id);
  return { value: id, label: b.label, short: b.shortLabel, Icon: b.icon };
});

// ─── shape helpers — Late expõe variações de shape entre plataformas ──────

type AnyItem = LateConversation | LateComment | LateReview;

function getItemId(item: AnyItem): string {
  return String(item.id ?? (item as any)._id ?? '');
}

function getItemPlatform(item: AnyItem, fallback: string): string {
  return (
    (item.platform as string) ||
    ((item as any).network as string) ||
    fallback
  );
}

function getItemAuthor(item: AnyItem): string {
  // Conversations: participants[].name (skip self if marcado)
  if ('participants' in item && Array.isArray(item.participants)) {
    const other = item.participants.find(
      (p) => p && !(p as any).isSelf,
    ) || item.participants[0];
    if (other?.name) return other.name;
    if (other?.username) return `@${other.username}`;
  }
  // Comments/reviews: author.name
  const author = (item as any).author;
  if (author?.name) return author.name;
  if (author?.username) return `@${author.username}`;
  if (typeof author === 'string') return author;
  // Top-level fallbacks
  return (
    (item as any).from?.name ||
    (item as any).from?.username ||
    (item as any).senderName ||
    'Anônimo'
  );
}

function getItemAvatar(item: AnyItem): string | undefined {
  if ('participants' in item && Array.isArray(item.participants)) {
    const other = item.participants.find(
      (p) => p && !(p as any).isSelf,
    ) || item.participants[0];
    if (other?.avatarUrl) return other.avatarUrl;
    if ((other as any)?.imageProfileUrl) return (other as any).imageProfileUrl;
  }
  const a = (item as any).author;
  return (
    a?.avatarUrl ||
    a?.picture ||
    (item as any).from?.profile_picture_url ||
    (item as any).profilePicture ||
    undefined
  );
}

function getItemPreview(item: AnyItem): string {
  if ('lastMessage' in item && item.lastMessage?.text) {
    return item.lastMessage.text;
  }
  if ('text' in item && typeof item.text === 'string') {
    return item.text;
  }
  return '(sem texto)';
}

function getItemDate(item: AnyItem): Date | null {
  const raw =
    (item as any).updatedAt ??
    (item as any).createdAt ??
    (item as any).lastMessage?.sentAt ??
    (item as any).date ??
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().replace(/^@/, '').split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// ─── Main panel ────────────────────────────────────────────────────────────

export function LateInboxPanel({ clientId }: Props) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<InboxMode>('list-conversations');
  const [provider, setProvider] = useState<string>('instagram');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [mobileSheet, setMobileSheet] = useState(false);

  // Queries por modo. Habilitamos só a query ativa via `enabled`.
  const convQuery = useLateConversations(
    clientId,
    { platform: provider },
    { enabled: mode === 'list-conversations' },
  );
  const commentsQuery = useLateComments(
    clientId,
    { platform: provider },
    { enabled: mode === 'list-comments' },
  );
  const reviewsQuery = useLateReviews(
    clientId,
    { platform: provider },
    { enabled: mode === 'list-reviews' },
  );

  const activeQuery =
    mode === 'list-conversations'
      ? convQuery
      : mode === 'list-comments'
        ? commentsQuery
        : reviewsQuery;

  const items: AnyItem[] = useMemo(() => {
    if (mode === 'list-conversations') return convQuery.data?.conversations ?? [];
    if (mode === 'list-comments') return commentsQuery.data?.comments ?? [];
    return reviewsQuery.data?.reviews ?? [];
  }, [mode, convQuery.data, commentsQuery.data, reviewsQuery.data]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (unreadOnly && !(getInboxItemUnreadCount(item) > 0)) return false;
      if (!q) return true;
      return (
        getItemPreview(item).toLowerCase().includes(q) ||
        getItemAuthor(item).toLowerCase().includes(q)
      );
    });
  }, [items, search, unreadOnly]);

  const totalUnread = useMemo(
    () => items.reduce((acc, i) => acc + (getInboxItemUnreadCount(i) || 0), 0),
    [items],
  );

  // Reset selection ao trocar mode/provider/cliente
  useEffect(() => {
    setSelectedItemId(null);
    setReplyDraft('');
    setMobileSheet(false);
  }, [mode, provider, clientId]);

  // Auto-seleciona primeiro item em desktop
  useEffect(() => {
    if (isMobile) return;
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (
      !selectedItemId ||
      !filteredItems.some((i) => getItemId(i) === selectedItemId)
    ) {
      setSelectedItemId(getItemId(filteredItems[0]));
    }
  }, [filteredItems, selectedItemId, isMobile]);

  const selectedItem = useMemo(
    () => filteredItems.find((i) => getItemId(i) === selectedItemId) || null,
    [filteredItems, selectedItemId],
  );

  const replyMessage = useReplyMessage(clientId);
  const replyComment = useReplyComment(clientId);
  const replyReview = useReplyReview(clientId);
  const markAsRead = useMarkAsRead(clientId);

  const sending =
    replyMessage.isPending ||
    replyComment.isPending ||
    replyReview.isPending;

  const handleSend = async () => {
    if (!selectedItem) return;
    const text = replyDraft.trim();
    if (!text) return;
    const platform = getItemPlatform(selectedItem, provider);
    const id = getItemId(selectedItem);
    setReplyDraft('');
    try {
      if (mode === 'list-conversations') {
        await replyMessage.mutateAsync({
          conversationId: id,
          text,
          platform,
        });
        toast.success('Mensagem enviada');
      } else if (mode === 'list-comments') {
        await replyComment.mutateAsync({
          commentId: id,
          text,
          platform,
        });
        toast.success('Comentário respondido');
      } else if (mode === 'list-reviews') {
        await replyReview.mutateAsync({
          reviewId: id,
          text,
          platform,
        });
        toast.success('Review respondido');
      }
    } catch {
      // Restaura draft em caso de erro
      setReplyDraft(text);
    }
  };

  const handleArchive = async (item: AnyItem) => {
    if (mode !== 'list-conversations') return;
    const platform = getItemPlatform(item, provider);
    await markAsRead.mutateAsync({
      conversationId: getItemId(item),
      platform,
      status: 'archived',
    });
  };

  const handleMarkRead = async (item: AnyItem) => {
    if (mode !== 'list-conversations') return;
    const platform = getItemPlatform(item, provider);
    await markAsRead.mutateAsync({
      conversationId: getItemId(item),
      platform,
      status: 'active',
    });
  };

  const handleSelect = (item: AnyItem) => {
    setSelectedItemId(getItemId(item));
    if (isMobile) setMobileSheet(true);
  };

  const queryError = (activeQuery as any).error?.message as string | undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden bg-card shadow-sm">
        {/* Header */}
        <div className="border-b">
          {/* Linha 1: título + counts + mode tabs */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Inbox</span>
              {totalUnread > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  <span className="text-foreground font-medium">
                    {totalUnread} não lidas
                  </span>
                </span>
              )}
            </div>

            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as InboxMode)}
              className="ml-auto"
            >
              <TabsList className="h-8">
                <TabsTrigger
                  value="list-conversations"
                  className="h-7 px-2.5 text-xs gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">DMs</span>
                </TabsTrigger>
                <TabsTrigger
                  value="list-comments"
                  className="h-7 px-2.5 text-xs gap-1.5"
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Comentários</span>
                </TabsTrigger>
                <TabsTrigger
                  value="list-reviews"
                  className="h-7 px-2.5 text-xs gap-1.5"
                >
                  <Star className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reviews</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Linha 2: provider + search + filtros */}
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5 border-t pt-2.5 bg-muted/20">
            <Tabs value={provider} onValueChange={setProvider}>
              <TabsList className="h-8 p-0.5">
                {PROVIDERS.map((p) => {
                  const branding = getNetworkBranding(p.value);
                  const isActive = provider === p.value;
                  return (
                    <Tooltip key={p.value}>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={p.value}
                          className={cn(
                            'h-7 px-2 text-[11px] font-medium gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm',
                            isActive && branding.textColor,
                          )}
                        >
                          <p.Icon className="h-3 w-3" />
                          <span className="hidden md:inline">{p.short}</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{p.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="relative ml-auto w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar autor ou texto..."
                className="pl-8 h-8 text-xs bg-background"
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={unreadOnly ? 'default' : 'outline'}
                  onClick={() => setUnreadOnly((v) => !v)}
                  className="h-8 px-2.5 text-xs gap-1.5"
                >
                  <Filter className="h-3 w-3" />
                  <span className="hidden lg:inline">Não lidas</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {unreadOnly ? 'Mostrando só não lidas' : 'Filtrar não lidas'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Body — master/detail */}
        <div className="flex h-[min(880px,max(640px,calc(100dvh-13rem)))]">
          {/* LEFT — lista */}
          <div
            className={cn(
              'flex flex-col border-r bg-background',
              'w-full md:w-[360px] md:shrink-0',
            )}
          >
            {queryError && (
              <div className="px-4 py-2 border-b text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                Erro Late API: {queryError}. Mostrando lista vazia.
              </div>
            )}

            <ScrollArea className="flex-1">
              {activeQuery.isLoading && (
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

              {!activeQuery.isLoading && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center px-6 py-12 text-sm text-muted-foreground">
                  <MessageCircleMore className="h-8 w-8 mb-2 opacity-40" />
                  {search || unreadOnly
                    ? 'Nenhum item bate com os filtros.'
                    : 'Caixa vazia. Tudo respondido.'}
                </div>
              )}

              {!activeQuery.isLoading &&
                filteredItems.map((item) => (
                  <InboxListRow
                    key={getItemId(item)}
                    item={item}
                    isSelected={selectedItemId === getItemId(item)}
                    provider={provider}
                    onSelect={() => handleSelect(item)}
                    onArchive={
                      mode === 'list-conversations'
                        ? () => handleArchive(item)
                        : undefined
                    }
                  />
                ))}
            </ScrollArea>
          </div>

          {/* RIGHT — detail desktop */}
          <div className="hidden md:flex flex-1 flex-col bg-muted/10">
            {selectedItem ? (
              <ConversationDetail
                key={getItemId(selectedItem)}
                clientId={clientId}
                item={selectedItem}
                mode={mode}
                provider={provider}
                replyDraft={replyDraft}
                setReplyDraft={setReplyDraft}
                onSend={handleSend}
                onArchive={() => handleArchive(selectedItem)}
                onMarkRead={() => handleMarkRead(selectedItem)}
                sending={sending}
              />
            ) : (
              <EmptyDetail loading={activeQuery.isLoading} />
            )}
          </div>

          {/* Mobile sheet */}
          <Sheet open={mobileSheet} onOpenChange={setMobileSheet}>
            <SheetContent side="right" className="w-full p-0 md:hidden">
              {selectedItem && (
                <ConversationDetail
                  key={getItemId(selectedItem)}
                  clientId={clientId}
                  item={selectedItem}
                  mode={mode}
                  provider={provider}
                  replyDraft={replyDraft}
                  setReplyDraft={setReplyDraft}
                  onSend={handleSend}
                  onArchive={() => handleArchive(selectedItem)}
                  onMarkRead={() => handleMarkRead(selectedItem)}
                  sending={sending}
                  onBack={() => setMobileSheet(false)}
                />
              )}
            </SheetContent>
          </Sheet>
        </div>
      </Card>
    </TooltipProvider>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────

interface RowProps {
  item: AnyItem;
  isSelected: boolean;
  provider: string;
  onSelect: () => void;
  onArchive?: () => void;
}

function InboxListRow({
  item,
  isSelected,
  provider,
  onSelect,
  onArchive,
}: RowProps) {
  const unread = getInboxItemUnreadCount(item);
  const isUnread = unread > 0;
  const author = getItemAuthor(item);
  const preview = getItemPreview(item);
  const date = getItemDate(item);
  const network = getItemPlatform(item, provider);
  const networkMeta = PROVIDERS.find((p) => p.value === network.toLowerCase());
  const branding = getNetworkBranding(network);
  const avatarUrl = getItemAvatar(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full text-left px-3.5 py-3 border-b transition-colors',
        'hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none',
        'border-l-2 border-l-transparent',
        isSelected && 'bg-accent border-l-primary',
      )}
    >
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
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 rounded-full p-0.5 border border-background',
                branding.bgSolid,
                branding.iconOnBgClass,
              )}
              title={branding.label}
            >
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
                {formatDistanceToNow(date, { addSuffix: false, locale: ptBR })}
              </span>
            )}
          </div>
          <p
            className={cn(
              'text-xs line-clamp-1',
              isUnread ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {preview}
          </p>
        </div>
      </div>

      {onArchive && (
        <div className="absolute right-2 top-2 hidden gap-0.5 group-hover:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
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
}

interface DetailProps {
  clientId: string;
  item: AnyItem;
  mode: InboxMode;
  provider: string;
  replyDraft: string;
  setReplyDraft: (v: string) => void;
  onSend: () => void;
  onArchive: () => void;
  onMarkRead: () => void;
  sending: boolean;
  onBack?: () => void;
}

function ConversationDetail({
  clientId,
  item,
  mode,
  provider,
  replyDraft,
  setReplyDraft,
  onSend,
  onArchive,
  onMarkRead,
  sending,
  onBack,
}: DetailProps) {
  const author = getItemAuthor(item);
  const avatarUrl = getItemAvatar(item);
  const network = getItemPlatform(item, provider);
  const networkMeta = PROVIDERS.find((p) => p.value === network.toLowerCase());
  const branding = getNetworkBranding(network);
  const lastDate = getItemDate(item);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Pra conversations: busca thread completa via API
  const isThread = mode === 'list-conversations';
  const threadQuery = useLateConversationMessages(
    clientId,
    isThread ? getItemId(item) : null,
    network,
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [replyDraft]);

  // Auto-scroll bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [threadQuery.data, item]);

  const placeholder =
    mode === 'list-conversations'
      ? 'Sua resposta...'
      : mode === 'list-comments'
        ? 'Responder ao comentário...'
        : 'Responder ao review...';

  const messages: Array<{
    id: string;
    text: string;
    from: 'self' | 'them';
    date: Date | null;
  }> = useMemo(() => {
    if (isThread) {
      const raw = threadQuery.data?.messages ?? [];
      return raw
        .map((m: any, i: number) => {
          const isSelf = m?.fromSelf === true || m?.direction === 'outbound';
          const dateRaw = m?.sentAt ?? m?.createdAt ?? m?.publicationDateTime;
          const date = dateRaw ? new Date(dateRaw) : null;
          const text = String(m?.text ?? m?.content ?? '').trim() || '(anexo)';
          return {
            id: String(m?.id ?? i),
            text,
            from: (isSelf ? 'self' : 'them') as 'self' | 'them',
            date,
          };
        })
        .filter((m) => m.text);
    }
    // Comments/reviews: o próprio item é a "mensagem"
    return [
      {
        id: getItemId(item),
        text: getItemPreview(item),
        from: 'them' as const,
        date: lastDate,
      },
    ];
  }, [isThread, threadQuery.data, item, lastDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-background">
        {onBack && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onBack}
            className="md:hidden"
          >
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
              <Badge
                className={cn(
                  'text-[10px] gap-1 h-5 border-transparent',
                  branding.bgSolid,
                  branding.iconOnBgClass,
                )}
              >
                <networkMeta.Icon className="h-2.5 w-2.5" />
                {networkMeta.short}
              </Badge>
            )}
          </div>
          {lastDate && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(lastDate, {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          )}
        </div>
        {mode === 'list-conversations' && (
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onMarkRead}
                  className="h-8 w-8 p-0"
                  aria-label="Marcar como lido"
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
                  onClick={onArchive}
                  className="h-8 w-8 p-0"
                  aria-label="Arquivar"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Arquivar</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {isThread && threadQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Sem mensagens.
          </div>
        ) : isThread ? (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
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
                  {m.date && (
                    <div className="text-[10px] mt-1 opacity-70">
                      {formatDistanceToNow(m.date, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} aria-hidden />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm whitespace-pre-wrap">{messages[0].text}</p>
              {mode === 'list-reviews' &&
                typeof (item as LateReview).rating === 'number' && (
                  <div className="flex gap-0.5 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3.5 w-3.5',
                          i < (item as LateReview).rating!
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Reply box */}
      <div className="border-t bg-background p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.nativeEvent as KeyboardEvent).isComposing) return;
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
            <TooltipContent>Enviar (Cmd/Ctrl+Enter)</TooltipContent>
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

// Mantém CheckCheck disponível em caso de feature future "marcar todas".
void CheckCheck;
