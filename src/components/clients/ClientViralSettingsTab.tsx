/**
 * ClientViralSettingsTab — agrega TODAS as configs/análises per-client
 * dentro do Perfil do Cliente.
 *
 * Reorganização UX 2026-05-09:
 *   - Antes: hashtags/concorrentes/relatórios eram tabs globais na sidebar.
 *   - Depois: tudo per-client mora aqui (faz mais sentido por cliente).
 *
 * Sub-tabs:
 *   - Radar       — fontes RSS/IG/YT/etc per-client (ClientSourcesManager)
 *   - Carrossel   — pontero pros campos de marca (Contexto IA + Referências)
 *   - Reels       — idem (carrossel/reels usam brand voice/refs do cliente)
 *   - Hashtags    — tracking Metricool por cliente
 *   - Concorrentes — análise Metricool por cliente
 *   - Relatórios  — relatórios Metricool por cliente
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutGrid,
  Info,
  Check,
  X as XIcon,
  Hash,
  Target,
  FileText,
} from "lucide-react";
import { useClientContext } from "@/hooks/useClientContext";
// 2026-05-18 rev2 — Metricool removido. Hashtags/Competitors/Reports panels
// virão via Late/Zernio quando integrarmos (Late tem `late-analytics`).
// Stubs pra não quebrar UI:
const MetricoolPlaceholder = ({ feature }: { feature: string }) => (
  <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-lg">
    <div className="text-sm font-medium text-foreground">{feature} em migração</div>
    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
      Estamos migrando do Metricool pro Late/Zernio. Esse painel volta em breve com features equivalentes.
    </p>
  </div>
);
const MetricoolHashtagsTracker = (_p: { clientId: string }) => <MetricoolPlaceholder feature="Tracker de hashtags" />;
const MetricoolCompetitorsPanel = (_p: { clientId: string }) => <MetricoolPlaceholder feature="Análise de concorrentes" />;
const MetricoolReportsManager = (_p: { clientId: string }) => <MetricoolPlaceholder feature="Relatórios" />;
// 2026-05-16 — Radar Viral e Reels Viral removidos do KAI por completo.

interface ClientViralSettingsTabProps {
  clientId: string;
  clientName: string | null;
}

export function ClientViralSettingsTab({ clientId, clientName }: ClientViralSettingsTabProps) {
  // Status sources — usa o useClientContext (já carregado em outras tabs do
  // perfil, então normalmente vem instantâneo do cache TanStack).
  // Cada bool dá um ✓/✗ + detalhe pro user saber o que falta antes de gerar.
  const { data: ctx } = useClientContext(clientId);
  const social = (ctx?.client?.social_media || {}) as Record<string, unknown>;
  const igHandle = typeof social.instagram === 'string' ? social.instagram.trim() : '';
  const hasInstagramConnected = igHandle.length > 0;
  const hasVoiceProfile = !!ctx?.tone || !!ctx?.client?.voice_profile;
  const refsCount = ctx?.referenceLibrary?.length ?? 0;
  const hasIdentityGuide = !!(ctx?.client?.identity_guide && ctx.client.identity_guide.trim());
  const personaSet = !!(ctx?.persona?.pain || ctx?.persona?.goal);
  const visualRefsCount = ctx?.visualReferences?.length ?? 0;

  return (
    <Tabs defaultValue="carousel" className="w-full">
      {/* Mobile: scroll horizontal · Desktop: 4 colunas grid (Radar+Reels
          removidos 2026-05-16, viraram apps standalone fora do KAI). */}
      <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 scrollbar-hide">
        <TabsList className="inline-flex w-max min-w-full sm:grid sm:grid-cols-4">
          <TabsTrigger value="carousel" className="text-xs gap-1 whitespace-nowrap">
            <LayoutGrid className="h-3.5 w-3.5" />
            Carrossel
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="text-xs gap-1 whitespace-nowrap">
            <Hash className="h-3.5 w-3.5" />
            Hashtags
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs gap-1 whitespace-nowrap">
            <Target className="h-3.5 w-3.5" />
            Concorrentes
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs gap-1 whitespace-nowrap">
            <FileText className="h-3.5 w-3.5" />
            Relatórios
          </TabsTrigger>
        </TabsList>
      </div>

      {/* 2026-05-16: tab Radar removida (Radar Viral saiu do KAI; vive como
          app standalone em radar.kaleidos.com.br). */}

      {/* Carrossel — sem settings exclusivos; mostra status do que tá pronto + aponta pra brand */}
      <TabsContent value="carousel" className="mt-4 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Sequência Viral (Carrossel)
            </CardTitle>
            <CardDescription>
              O Carrossel usa o tom de voz, identidade visual e referências do
              cliente. Não há configs exclusivas do app — status atual:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <StatusItem
              ok={hasVoiceProfile}
              label="Tom de voz configurado"
              detail={hasVoiceProfile ? 'OK' : 'Faltando'}
            />
            <StatusItem
              ok={hasIdentityGuide}
              label="Guia de identidade IA"
              detail={hasIdentityGuide ? 'OK' : 'Gerar em Contexto IA'}
            />
            <StatusItem
              ok={refsCount > 0}
              label="Referências de conteúdo"
              detail={`${refsCount} salvas`}
            />
            <StatusItem
              ok={visualRefsCount > 0}
              label="Referências visuais"
              detail={`${visualRefsCount} salvas`}
            />
            <StatusItem
              ok={hasInstagramConnected}
              label="Conta IG configurada"
              detail={hasInstagramConnected ? `@${igHandle.replace(/^@/, '')}` : 'Faltando'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Onde ajustar cada item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <BulletPoint
              label="Tom de voz e personalidade"
              hint="Identidade → Sobre (Tom de Voz) · Identidade → Contexto IA (guia de identidade)"
            />
            <BulletPoint
              label="Referências de conteúdo (texto/links)"
              hint="Conteúdo → Referências → Referências de Conteúdo"
            />
            <BulletPoint
              label="Referências visuais (imagens, paleta)"
              hint="Conteúdo → Referências → Referências Visuais"
            />
            <BulletPoint
              label="Redes sociais e handles"
              hint="Identidade → Redes"
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Reels — idem */}
      {/* 2026-05-16: tab Reels removida (Reels Viral saiu do KAI; vive como
          app standalone em reels.kaleidos.com.br). */}

      {/* Hashtags — tracking Metricool por cliente.
          Antes era tab global; agora vive aqui pra ficar acoplado ao perfil. */}
      <TabsContent value="hashtags" className="mt-4">
        <MetricoolHashtagsTracker clientId={clientId} />
      </TabsContent>

      {/* Concorrentes — análise Metricool por cliente. */}
      <TabsContent value="competitors" className="mt-4">
        <MetricoolCompetitorsPanel clientId={clientId} />
      </TabsContent>

      {/* Relatórios — Metricool reports por cliente. */}
      <TabsContent value="reports" className="mt-4">
        <MetricoolReportsManager clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}

function BulletPoint({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

/**
 * StatusItem — linha visual ✓/✗ + label + detalhe. Usado nos sub-tabs
 * Carrossel/Reels pra mostrar o que tá configurado per-client antes do user
 * tentar gerar conteúdo.
 */
function StatusItem({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span
        className={
          'flex h-5 w-5 items-center justify-center rounded-full shrink-0 ' +
          (ok
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')
        }
      >
        {ok ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
      </span>
      <span className="flex-1 text-foreground">{label}</span>
      {detail && (
        <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>
      )}
    </div>
  );
}
