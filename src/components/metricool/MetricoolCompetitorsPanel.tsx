// MetricoolCompetitorsPanel — análise de concorrentes por rede social.
import { useState } from 'react';
import {
  useMetricoolCompetitors,
  useMetricoolCompetitorPosts,
  useAddMetricoolCompetitor,
  type MetricoolCompetitor,
  type MetricoolCompetitorPost,
} from '@/hooks/useMetricoolCompetitors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Users,
  Plus,
  TrendingUp,
  TrendingDown,
  Heart,
  MessageCircle,
  Eye,
  ImageIcon,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Props {
  clientId: string;
}

const NETWORKS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'bluesky', label: 'Bluesky' },
] as const;

type NetworkValue = (typeof NETWORKS)[number]['value'];

function formatNumber(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
}

function getInitials(value?: string): string {
  if (!value) return '?';
  const trimmed = value.trim().replace(/^@/, '');
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function pickPostText(post: MetricoolCompetitorPost): string {
  return (post.caption || post.text || post.message || '').toString();
}

function pickPostThumbnail(post: MetricoolCompetitorPost): string | null {
  return (post.thumbnail || post.picture || post.imageUrl || post.mediaUrl || null) as
    | string
    | null;
}

interface CompetitorPostsDialogProps {
  clientId: string;
  network: string;
  competitor: MetricoolCompetitor | null;
  onClose: () => void;
}

function CompetitorPostsDialog({
  clientId,
  network,
  competitor,
  onClose,
}: CompetitorPostsDialogProps) {
  const { data: posts, isLoading } = useMetricoolCompetitorPosts(
    clientId,
    network,
    competitor?.id ?? null,
  );

  return (
    <Dialog open={!!competitor} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> {competitor?.name || competitor?.username || 'Concorrente'}
          </DialogTitle>
          <DialogDescription>
            Últimos 30 dias · {network}
            {competitor?.username ? ` · @${competitor.username.replace(/^@/, '')}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando posts...
          </div>
        )}

        {!isLoading && (!posts || posts.length === 0) && (
          <div className="text-sm text-muted-foreground text-center p-6">
            Sem posts recentes nessa janela.
          </div>
        )}

        {!isLoading && posts && posts.length > 0 && (
          <div className="space-y-3">
            {posts.map((post, i) => {
              const id = String(post.id ?? i);
              const text = pickPostText(post);
              const thumb = pickPostThumbnail(post);
              const truncated =
                text.length > 180 ? `${text.slice(0, 180).trim()}…` : text || '(sem legenda)';
              return (
                <div key={id} className="flex gap-3 rounded-md border p-3">
                  <div className="h-16 w-16 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm line-clamp-3 break-words">{truncated}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {post.likes != null && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {formatNumber(post.likes)}
                        </span>
                      )}
                      {post.comments != null && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments)}
                        </span>
                      )}
                      {post.views != null && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {formatNumber(post.views)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NetworkPanelProps {
  clientId: string;
  network: NetworkValue;
}

function NetworkPanel({ clientId, network }: NetworkPanelProps) {
  const { toast } = useToast();
  const { data: competitors = [], isLoading } = useMetricoolCompetitors(clientId, network);
  const addMutation = useAddMetricoolCompetitor(clientId);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<MetricoolCompetitor | null>(null);

  const handleAdd = async () => {
    const handle = username.trim().replace(/^@/, '');
    if (!handle) {
      toast({
        title: 'Username obrigatório',
        description: 'Informe o handle do concorrente.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await addMutation.mutateAsync({
        network,
        username: handle,
        name: name.trim() || undefined,
      });
      toast({
        title: 'Concorrente adicionado',
        description: `@${handle} no ${network}.`,
      });
      setUsername('');
      setName('');
    } catch (e: any) {
      toast({
        title: 'Erro ao adicionar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Form de adição */}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Plus className="h-3 w-3" /> Adicionar concorrente
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            <span className="ml-1">Add</span>
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando concorrentes...
        </div>
      )}

      {!isLoading && competitors.length === 0 && (
        <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
          Nenhum concorrente nessa rede ainda. Adicione um pra começar a comparar.
        </div>
      )}

      {!isLoading && competitors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {competitors.map((c) => {
            const id = String(c.id);
            const display = c.name || c.username || id;
            const handle = c.username ? `@${c.username.replace(/^@/, '')}` : '';
            const avatar = (c.picture || c.avatar || '') as string;
            const growth = typeof c.growth === 'number' ? c.growth : null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(c)}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/30 hover:border-foreground/20 transition text-left"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {getInitials(display)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm">{display}</div>
                  {handle && (
                    <div className="text-xs text-muted-foreground truncate">{handle}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {formatNumber(c.followers)} seguidores
                    </Badge>
                    {growth != null && (
                      <Badge
                        variant={growth >= 0 ? 'default' : 'secondary'}
                        className="text-xs gap-1"
                      >
                        {growth >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {growth >= 0 ? '+' : ''}
                        {growth.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CompetitorPostsDialog
        clientId={clientId}
        network={network}
        competitor={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export function MetricoolCompetitorsPanel({ clientId }: Props) {
  const [network, setNetwork] = useState<NetworkValue>('instagram');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Concorrentes (Metricool)
        </CardTitle>
        <CardDescription>
          Compare seguidores, crescimento e posts recentes dos concorrentes por rede.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={network} onValueChange={(v) => setNetwork(v as NetworkValue)}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
            {NETWORKS.map((n) => (
              <TabsTrigger key={n.value} value={n.value} className="text-xs">
                {n.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {NETWORKS.map((n) => (
            <TabsContent key={n.value} value={n.value} className="mt-4">
              {network === n.value && <NetworkPanel clientId={clientId} network={n.value} />}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
