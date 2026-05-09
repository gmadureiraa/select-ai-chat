// MetricoolInboxPanel — caixa unificada de DMs + comments + reviews.
// Layout master-detail (Gmail/Linear style):
//   - Header compacto: provider tabs + tipo (DM/Comments/Reviews) + search + toggle não-lidos + bulk
//   - LEFT (~360px): lista virtualizada-friendly de items (avatar, nome, preview, data, dot azul)
//   - RIGHT (flex 1): detalhe da conversa selecionada com header sticky + mensagens + reply box sticky
//   - Mobile: lista cheia, detalhe abre como Sheet
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getInboxItemUnreadCount,
  useMetricoolInbox,
  useMetricoolInboxActions,
} from '@/hooks/useMetricoolInbox';
import { useIsMobile } from '@/hooks/use-mobile';
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
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InboxQuickReplies } from './InboxQuickReplies';
import { cn } from '@/lib/utils';
import { getNetworkBranding } from '@/lib/network-branding';

interface Props {
  clientId: string;
}

type InboxMode = 'list-conversations' | 'list-comments' | 'list-reviews';

// Lista de providers derivada de network-branding.ts (single source of truth).
// Mantém a forma { value, label, short, Icon } pra não quebrar o resto do
// componente, mas cores/icone agora vêm via getNetworkBranding(value).
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

// Shape REAL da API Metricool (verificado via curl 2026-05-09):
//
// DM (conversation):
//   { id, self: '<ownerId>', provider, status: 'PENDING'|'READ', creationDate,
//     lastUpdateTime, lastReadTime,
//     participants: [{ id, name, imageProfileUrl? }, ...],
//     messages: [{ id, from, to, text, publicationDateTime, attachments,
//                  properties? }, ...] }
//   → "lastMessage" não existe — pegar último item de messages[].
//   → autor ≠ self: filtrar participants pelo id !== self.
//   → unreadCount não existe — derivar de status === 'PENDING'.
//
// Comment:
//   { id, self, provider, status, creationDate, lastUpdateTime,
//     participants: [{ id, name }],            // 1 entry, id = handle
//     owner: '<handle>',                       // top-level
//     text: '...',                             // top-level
//     root: { element: { id, owner, link, text, mediaUrls, ... } } }
//   → autor: participants[0].name ?? owner.
//
// Review (provider gmb/facebook):
//   shape similar a comment com `rating` numérico no top.

/** Retorna o participante "outro lado" da conversa (não o dono da conta). */
function getCounterparty(item: any): any | null {
  const self = item?.self ? String(item.self) : null;
  const participants: any[] = Array.isArray(item?.participants) ? item.participants : [];
  if (participants.length === 0) return null;
  if (self) {
    const other = participants.find((p) => String(p?.id) !== self);
    if (other) return other;
  }
  // Fallback: primeiro participante (caso self não bata, ex.: comments têm 1 só).
  return participants[0];
}

function getItemText(item: any): string {
  // 1) DM: último msg do array messages.
  const msgs: any[] = Array.isArray(item?.messages) ? item.messages : [];
  if (msgs.length > 0) {
    const last = msgs[msgs.length - 1];
    const t = (last?.text ?? '').toString();
    if (t) return t;
    // Mensagem só com share/reaction/attachment — devolve placeholder semântico.
    if (last?.properties?.shares?.length) return '🔗 compartilhou um post';
    if (last?.properties?.reactions?.length) {
      const r = last.properties.reactions[0]?.reaction;
      return r ? `${r} reagiu` : 'reagiu';
    }
    if (last?.properties?.story?.reply_to) return '📷 respondeu story';
    if (last?.properties?.is_unsupported) return '(mensagem não suportada)';
    if (Array.isArray(last?.attachments) && last.attachments.length > 0) {
      return '📎 anexo';
    }
  }
  // 2) Comment / review: text top-level.
  return (item?.text ?? item?.lastMessage ?? item?.content ?? item?.message ?? '')
    .toString();
}

function getItemAuthor(item: any): string {
  // Prioridade: counterparty.name (DM/comment/review) → owner (comment) →
  // demais fallbacks pra resiliência se Metricool mudar shape.
  const cp = getCounterparty(item);
  const cpName = cp?.name ?? cp?.username ?? cp?.id;
  const candidate =
    cpName ??
    item?.owner ??
    item?.participantName ??
    item?.authorName ??
    item?.author?.displayName ??
    item?.author?.name ??
    (typeof item?.author === 'string' ? item.author : undefined) ??
    item?.from?.name ??
    item?.from?.username ??
    item?.user?.name ??
    item?.user?.username ??
    item?.username ??
    item?.senderName ??
    '';

  const r = (candidate || '').toString().trim();
  if (!r || r === 'undefined' || r === 'null') {
    // eslint-disable-next-line no-console
    console.warn(
      '[Inbox] sem nome de autor:',
      JSON.stringify(item).slice(0, 500),
    );
    return 'Sem identificação';
  }
  return r;
}

function getItemAvatar(item: any): string | undefined {
  const cp = getCounterparty(item);
  return (
    cp?.imageProfileUrl ??
    cp?.picture ??
    cp?.profilePicture ??
    cp?.avatar ??
    cp?.avatarUrl ??
    item?.participantPicture ??
    item?.authorPicture ??
    item?.author?.picture ??
    item?.author?.avatarUrl ??
    item?.from?.profile_picture_url ??
    item?.from?.picture ??
    item?.profilePicture ??
    item?.avatar ??
    undefined
  );
}

function getItemHandle(item: any): string | undefined {
  // Em comments do IG, participants[0].id === handle (e === name).
  // Em DMs IG, participants[].id é numérico — então só vira handle quando
  // for diferente do name (caso name vire display name e id vire @).
  const cp = getCounterparty(item);
  const handle =
    cp?.username ??
    (cp?.id && cp?.name && String(cp.id) !== String(cp.name) && /^[a-z0-9._-]+$/i.test(String(cp.id))
      ? cp.id
      : undefined) ??
    item?.participantHandle ??
    item?.authorHandle ??
    item?.from?.username ??
    item?.user?.username ??
    item?.username ??
    undefined;
  return handle ? String(handle) : undefined;
}

/** Conta msgs PENDING como "não lidas" quando API não devolve unreadCount.
 *  Implementação canônica vive em `useMetricoolInbox.ts` (export
 *  `getInboxItemUnreadCount`) — re-exportada aqui só pra manter backward
 *  compat com chamadas locais. */
const getUnreadCount = getInboxItemUnreadCount;

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// Limita concorrência ao chamar APIs em batch (anti rate-limit Metricool).
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) {
        try {
          await fn(item);
        } catch (err) {
          // Não deixa um item falho derrubar o batch inteiro.
          // eslint-disable-next-line no-console
          console.error('[withConcurrency] item failed', err);
        }
      }
    }
  });
  await Promise.all(workers);
}

function getItemDate(item: any): Date | null {
  // Metricool: DM/comment usam lastUpdateTime/creationDate. Msg usa publicationDateTime.
  const v =
    item?.lastUpdateTime ??
    item?.publicationDateTime ??
    item?.creationDate ??
    item?.lastMessageDate ??
    item?.createdAt ??
    item?.date ??
    item?.timestamp;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getMessages(
  item: any,
): Array<{
  id?: string;
  text: string;
  from?: 'self' | 'them';
  date?: Date | null;
  pending?: boolean;
}> {
  // DM Metricool: messages[] com { from, to, text, publicationDateTime, properties }.
  // 'self' (top-level do thread) é o ID do dono — usado pra detectar isSelf.
  const arr = item?.messages ?? item?.thread ?? item?.replies;
  const selfId = item?.self ? String(item.self) : null;
  if (Array.isArray(arr) && arr.length > 0) {
    const mapped = arr
      .map((m: any, i: number) => {
        const fromId = m?.from != null ? String(m.from) : null;
        const isSelf =
          (selfId && fromId && fromId === selfId) ||
          m?.from === 'self' ||
          m?.fromSelf === true ||
          m?.isSelf === true ||
          (typeof m?.direction === 'string' && m.direction.toLowerCase() === 'out');
        const date =
          m?.publicationDateTime ?? m?.date ?? m?.createdAt ?? m?.timestamp ?? null;

        let text = (m?.text ?? m?.content ?? m?.message ?? '').toString();
        if (!text) {
          if (m?.properties?.shares?.length) {
            text = `🔗 ${m.properties.shares[0]?.link ?? 'compartilhou um post'}`;
          } else if (m?.properties?.reactions?.length) {
            const r = m.properties.reactions[0]?.reaction;
            text = r ? `${r} reagiu` : 'reagiu';
          } else if (m?.properties?.story?.reply_to) {
            text = '📷 respondeu story';
          } else if (m?.properties?.is_unsupported) {
            text = '(mensagem não suportada)';
          } else if (Array.isArray(m?.attachments) && m.attachments.length > 0) {
            text = '📎 anexo';
          }
        }
        return {
          id: m?.id ?? String(i),
          text,
          from: (isSelf ? 'self' : 'them') as 'self' | 'them',
          date: date ? new Date(date) : null,
          pending: m?.pending === true,
        };
      })
      .filter((m) => m.text);
    // Metricool devolve mais recente primeiro — UI espera ordem cronológica.
    return mapped.slice().reverse();
  }
  const text = getItemText(item);
  const date = getItemDate(item);
  return text ? [{ id: 'last', text, from: 'them', date }] : [];
}

// Persistência leve de UI por cliente (search + unreadOnly).
const uiStateKey = (clientId: string) => `kai-inbox-ui-${clientId}`;

function loadUiState(clientId: string): { search: string; unreadOnly: boolean } {
  if (typeof window === 'undefined') return { search: '', unreadOnly: false };
  try {
    const raw = window.localStorage.getItem(uiStateKey(clientId));
    if (!raw) return { search: '', unreadOnly: false };
    const p = JSON.parse(raw);
    return {
      search: typeof p?.search === 'string' ? p.search : '',
      unreadOnly: !!p?.unreadOnly,
    };
  } catch {
    return { search: '', unreadOnly: false };
  }
}

function saveUiState(
  clientId: string,
  state: { search: string; unreadOnly: boolean },
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(uiStateKey(clientId), JSON.stringify(state));
  } catch {
    /* quota — ignora */
  }
}

export function MetricoolInboxPanel({ clientId }: Props) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<InboxMode>('list-conversations');
  const [provider, setProvider] = useState<string>('instagram');
  const initialUi = useMemo(() => loadUiState(clientId), [clientId]);
  const [search, setSearch] = useState<string>(initialUi.search);
  const [unreadOnly, setUnreadOnly] = useState(initialUi.unreadOnly);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  // Recarrega ui state quando troca cliente.
  useEffect(() => {
    const s = loadUiState(clientId);
    setSearch(s.search);
    setUnreadOnly(s.unreadOnly);
    setSelectedItemId(null);
  }, [clientId]);

  // Persiste search + unreadOnly por cliente.
  useEffect(() => {
    saveUiState(clientId, { search, unreadOnly });
  }, [clientId, search, unreadOnly]);

  const { data, isLoading } = useMetricoolInbox(clientId, mode, provider);
  const { sendMessage, replyComment, replyReview, setStatus, invalidate } =
    useMetricoolInboxActions(clientId);

  const items: any[] = useMemo(
    () => (data?.conversations || data?.comments || data?.reviews || []) as any[],
    [data],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (unreadOnly && !(getUnreadCount(item) > 0)) return false;
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
      if (!isMobile) {
        setSelectedItemId(String(filteredItems[0].id));
      }
    }
  }, [filteredItems, selectedItemId, isMobile]);

  // Reseta draft quando muda item selecionado.
  useEffect(() => {
    setReplyDraft('');
  }, [selectedItemId]);

  // Reset ao trocar de modo/provider/cliente. Também fecha sheet mobile —
  // senão o usuário fica olhando uma conversa do provider antigo.
  const handleModeChange = (v: string) => {
    setMode(v as InboxMode);
    setSelectedItemId(null);
    setMobileSheet(false);
  };
  const handleProviderChange = (v: string) => {
    setProvider(v);
    setSelectedItemId(null);
    setMobileSheet(false);
  };

  const selectedItem = useMemo(
    () => filteredItems.find((i) => String(i.id) === selectedItemId) || null,
    [filteredItems, selectedItemId],
  );

  const totalUnread = useMemo(
    () => items.reduce((acc, i) => acc + (getUnreadCount(i) || 0), 0),
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
    // Limpa draft já — UX optimistic. Se erro, snackbar mostra (próxima
    // melhoria seria toast de erro, mas Metricool pode aceitar e demorar).
    setReplyDraft('');
    // Shape Metricool real usa `provider`, não `network`. Fallback pro
    // provider selecionado no painel.
    const network =
      (selectedItem?.provider as string | undefined) ||
      (selectedItem?.network as string | undefined) ||
      provider;
    try {
      if (mode === 'list-conversations') {
        await sendMessage.mutateAsync({ conversationId: id, text });
      } else if (mode === 'list-comments') {
        await replyComment.mutateAsync({ commentId: id, text, network });
      } else if (mode === 'list-reviews') {
        await replyReview.mutateAsync({ reviewId: id, text, network });
      }
    } catch {
      // Restaura draft se falhou — mais útil que perder o texto digitado.
      setReplyDraft(text);
    }
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
    const unread = filteredItems.filter((i) => getUnreadCount(i) > 0);
    if (unread.length === 0) return;
    setBulkBusy(true);
    try {
      // concurrency: 3 — Metricool aplica rate-limit agressivo em /inbox/*.
      // Paralelo total (Promise.all) com 50+ items causa 429 e ban temporário.
      // silent:true — invalida UMA vez no fim do batch (vs N=unread.length).
      await withConcurrency(unread, 3, (i) =>
        setStatus.mutateAsync({
          id: String(i.id),
          status: 'OPEN',
          type: bulkType,
          silent: true,
        }),
      );
    } finally {
      setBulkBusy(false);
      invalidate();
    }
  };

  const handleSelectItem = (item: any) => {
    setSelectedItemId(String(item.id));
    if (isMobile) {
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

          {/* Provider segmented control compacto.
              Quando ativa, ganha tint sutil com a textColor da rede (single
              source of truth via getNetworkBranding). */}
          <Tabs value={provider} onValueChange={handleProviderChange}>
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
                          'h-7 px-2 text-[11px] font-medium gap-1 data-[state=active]:bg-background',
                          isActive && branding.textColor,
                        )}
                      >
                        <p.Icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{p.short}</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{p.label}</TooltipContent>
                  </Tooltip>
                );
              })}
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
                  const unread = getUnreadCount(item);
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
                          {networkMeta && (() => {
                            const b = getNetworkBranding(network);
                            return (
                              <span
                                className={cn(
                                  'absolute -bottom-0.5 -right-0.5 rounded-full p-0.5 border border-background',
                                  b.bgSolid,
                                  b.iconOnBgClass,
                                )}
                                title={b.label}
                              >
                                <networkMeta.Icon className="h-2.5 w-2.5" />
                              </span>
                            );
                          })()}
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
  // Metricool real shape usa `provider`. Mantemos `network`/`platform` como
  // fallback caso o backend evolua o shape (defensivo).
  const network = (item?.provider || item?.network || item?.platform || '') as string;
  const networkMeta = PROVIDERS.find((p) => p.value === network.toLowerCase());
  const lastDate = getItemDate(item);
  const messages = useMemo(() => getMessages(item), [item]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesCountRef = useRef(messages.length);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [replyDraft]);

  // Auto-scroll bottom: quando troca conversa (jump instantâneo) E quando
  // chega msg nova na conversa atual (smooth). Compara count anterior pra
  // detectar nova msg em vez de só o length atual.
  useEffect(() => {
    const newCount = messages.length;
    const grew = newCount > messagesCountRef.current;
    messagesCountRef.current = newCount;
    if (newCount === 0) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: grew ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [messages.length, item?.id]);

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
            {networkMeta && (() => {
              const b = getNetworkBranding(network);
              return (
                <Badge
                  className={cn('text-[10px] gap-1 h-5 border-transparent', b.bgSolid, b.iconOnBgClass)}
                >
                  <networkMeta.Icon className="h-2.5 w-2.5" />
                  {networkMeta.short}
                </Badge>
              );
            })()}
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
          // Thread completa — Metricool retorna messages[] inline na conversa
          // (verificado 2026-05-09). Render como bubbles cronológicos.
          <div className="space-y-2">
            {messages.map((m, idx) => (
              <div
                key={m.id ?? idx}
                className={cn(
                  'flex',
                  m.from === 'self' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap relative',
                    m.from === 'self'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm',
                    m.pending && 'opacity-60',
                  )}
                >
                  {m.text}
                  <div
                    className={cn(
                      'text-[10px] mt-1 opacity-70 flex items-center gap-1',
                      m.from === 'self' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {m.pending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {m.date &&
                      (m.pending ? (
                        <span>enviando…</span>
                      ) : (
                        <span>
                          {formatDistanceToNow(m.date, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} aria-hidden />
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
                      m.pending && 'opacity-60',
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} aria-hidden />
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
              // Guard IME: durante composição (PT-BR acentos, CJK), não dispara.
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
