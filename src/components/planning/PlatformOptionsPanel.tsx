import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Instagram, Facebook, FlaskConical, Users, MessageSquareQuote, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IGContentType = 'feed' | 'story' | 'reel' | 'carousel';
export type FBContentType = 'feed' | 'story' | 'reel';
export type TrialReelMode = 'off' | 'manual' | 'auto';

export interface InstagramOptions {
  contentType?: IGContentType;
  shareToFeed?: boolean;
  trialReel?: TrialReelMode;
  collaborators?: string[];
  firstComment?: string;
  instagramThumbnail?: string;
  thumbOffset?: number;
  audioName?: string;
  customCaption?: string;
}

export interface FacebookOptions {
  contentType?: FBContentType;
  firstComment?: string;
  customCaption?: string;
}

export interface PlatformOptionsState {
  instagram?: InstagramOptions;
  facebook?: FacebookOptions;
}

interface Props {
  selectedPlatforms: string[];
  value: PlatformOptionsState;
  onChange: (next: PlatformOptionsState) => void;
  hasMultipleMedia: boolean;
}

const IG_TYPES: { value: IGContentType; label: string; emoji: string }[] = [
  { value: 'feed', label: 'Feed', emoji: '📷' },
  { value: 'story', label: 'Story', emoji: '⭕' },
  { value: 'reel', label: 'Reel', emoji: '🎬' },
  { value: 'carousel', label: 'Carrossel', emoji: '🎞' },
];

const FB_TYPES: { value: FBContentType; label: string; emoji: string }[] = [
  { value: 'feed', label: 'Feed', emoji: '📷' },
  { value: 'story', label: 'Story', emoji: '⭕' },
  { value: 'reel', label: 'Reel', emoji: '🎬' },
];

function buildZernioPreview(ig: InstagramOptions): Record<string, unknown> {
  const data: Record<string, unknown> = { contentType: 'reels' };
  data.shareToFeed = ig.shareToFeed !== false;
  if (ig.trialReel && ig.trialReel !== 'off') {
    data.trialParams = {
      graduationStrategy: ig.trialReel === 'auto' ? 'SS_PERFORMANCE' : 'MANUAL',
    };
  }
  if (ig.instagramThumbnail) data.instagramThumbnail = ig.instagramThumbnail;
  else if (typeof ig.thumbOffset === 'number') data.thumbOffset = ig.thumbOffset;
  if (ig.audioName) data.audioName = ig.audioName;
  if (ig.collaborators?.length) data.collaborators = ig.collaborators.slice(0, 3);
  if (ig.firstComment?.trim()) data.firstComment = ig.firstComment.trim();
  return data;
}

export function PlatformOptionsPanel({ selectedPlatforms, value, onChange, hasMultipleMedia }: Props) {
  const showIG = selectedPlatforms.includes('instagram');
  const showFB = selectedPlatforms.includes('facebook');

  const ig = value.instagram || {};
  const fb = value.facebook || {};

  // Default IG type if user didn't pick: carousel if multiple media, else feed
  const igType: IGContentType = ig.contentType || (hasMultipleMedia ? 'carousel' : 'feed');
  const fbType: FBContentType = fb.contentType || 'feed';

  const setIG = (patch: Partial<InstagramOptions>) =>
    onChange({ ...value, instagram: { ...ig, ...patch } });
  const setFB = (patch: Partial<FacebookOptions>) =>
    onChange({ ...value, facebook: { ...fb, ...patch } });

  const collaboratorsText = useMemo(
    () => (ig.collaborators || []).join(', '),
    [ig.collaborators]
  );

  if (!showIG && !showFB) return null;

  return (
    <div className="space-y-4 rounded-md border border-border/40 bg-card/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        Opções por plataforma
      </div>

      {showIG && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Instagram className="h-3.5 w-3.5 text-pink-500" />
            Instagram
          </div>

          <Tabs
            value={igType}
            onValueChange={(v) => setIG({ contentType: v as IGContentType })}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 h-8">
              {IG_TYPES.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="text-[11px] gap-1">
                  <span>{t.emoji}</span>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Reel-only options */}
          {igType === 'reel' && (
            <div className="space-y-3 rounded-md border border-dashed border-border/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" />
                  Mostrar também no Feed
                </Label>
                <Switch
                  checked={ig.shareToFeed !== false}
                  onCheckedChange={(c) => setIG({ shareToFeed: c })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3 text-amber-500" />
                  Trial Reel (teste com não-seguidores)
                </Label>
                <Select
                  value={ig.trialReel || 'off'}
                  onValueChange={(v) => setIG({ trialReel: v as TrialReelMode })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off" className="text-xs">Desligado (Reel normal)</SelectItem>
                    <SelectItem value="manual" className="text-xs">
                      Manual — você decide se vira público
                    </SelectItem>
                    <SelectItem value="auto" className="text-xs">
                      Auto-graduate — vira público se performar bem
                    </SelectItem>
                  </SelectContent>
                </Select>
                {ig.trialReel && ig.trialReel !== 'off' && (
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    O Reel só aparece para quem <strong>não te segue</strong>. Se performar bem,
                    {ig.trialReel === 'auto' ? ' é promovido automaticamente.' : ' você promove manualmente.'}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px]">Capa do Reel (URL JPEG/PNG, 1080x1920)</Label>
                <Input
                  value={ig.instagramThumbnail || ''}
                  onChange={(e) => setIG({ instagramThumbnail: e.target.value, thumbOffset: undefined })}
                  placeholder="https://…"
                  className="h-8 text-xs"
                />
              </div>

              {!ig.instagramThumbnail && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">…ou Thumb Offset (segundos do vídeo)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={ig.thumbOffset ?? ''}
                    onChange={(e) => setIG({ thumbOffset: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Ex: 1.5"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[11px]">Nome do áudio (Instagram Reels)</Label>
                <Input
                  value={ig.audioName || ''}
                  onChange={(e) => setIG({ audioName: e.target.value })}
                  placeholder="Ex: Madureira Original Sound"
                  className="h-8 text-xs"
                />
              </div>

              {/* Live preview do payload Zernio */}
              <div className="rounded-md bg-muted/40 border border-border/40 p-2 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Prévia do envio (Zernio)
                </div>
                <pre className="text-[10px] leading-snug font-mono whitespace-pre-wrap text-foreground/80">
{JSON.stringify(buildZernioPreview(ig), null, 2)}
                </pre>
                {ig.trialReel && ig.trialReel !== 'off' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight pt-1">
                    🧪 Trial Reel ativo — só será exibido para não-seguidores.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Story-specific note */}
          {igType === 'story' && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              Stories aceitam apenas 1 mídia (vertical 9:16). Comentários, collaborators e first comment
              não funcionam em Stories.
            </p>
          )}

          {/* Common (feed/reel/carousel) */}
          {igType !== 'story' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  Collaborators (até 3 @, separados por vírgula)
                </Label>
                <Input
                  value={collaboratorsText}
                  onChange={(e) =>
                    setIG({
                      collaborators: e.target.value
                        .split(',')
                        .map((s) => s.trim().replace(/^@/, ''))
                        .filter(Boolean)
                        .slice(0, 3),
                    })
                  }
                  placeholder="@usuario1, @usuario2"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5">
                  <MessageSquareQuote className="h-3 w-3" />
                  Primeiro comentário (auto-postado)
                </Label>
                <Textarea
                  value={ig.firstComment || ''}
                  onChange={(e) => setIG({ firstComment: e.target.value })}
                  placeholder="Útil para colocar links — captions não têm link clicável"
                  className="min-h-[48px] text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px]">Caption customizada (sobrescreve o conteúdo)</Label>
            <Textarea
              value={ig.customCaption || ''}
              onChange={(e) => setIG({ customCaption: e.target.value })}
              placeholder="Deixe vazio para usar o conteúdo principal"
              className="min-h-[48px] text-xs"
            />
          </div>
        </div>
      )}

      {showFB && (
        <div className={cn('space-y-3', showIG && 'pt-3 border-t border-border/30')}>
          <div className="flex items-center gap-2 text-xs font-medium">
            <Facebook className="h-3.5 w-3.5 text-blue-500" />
            Facebook
          </div>

          <Tabs
            value={fbType}
            onValueChange={(v) => setFB({ contentType: v as FBContentType })}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 h-8">
              {FB_TYPES.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="text-[11px] gap-1">
                  <span>{t.emoji}</span>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {fbType !== 'story' && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Primeiro comentário</Label>
              <Textarea
                value={fb.firstComment || ''}
                onChange={(e) => setFB({ firstComment: e.target.value })}
                className="min-h-[40px] text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
