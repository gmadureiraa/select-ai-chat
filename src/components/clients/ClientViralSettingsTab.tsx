/**
 * ClientViralSettingsTab — agrega TODAS as configs per-client dos 3 apps
 * virais (Radar, Carrossel, Reels) dentro do Perfil do Cliente.
 *
 * Reorganização UX 2026-05-09:
 *   - Antes: cada app viral tinha settings/fontes dentro do próprio app
 *   - Depois: app só renderiza dashboard, configs vivem aqui
 *
 * Sub-tabs:
 *   - Radar      — fontes RSS/IG/YT/etc per-client (ClientSourcesManager)
 *   - Carrossel  — pontero pros campos de marca (Contexto IA + Referências)
 *   - Reels      — idem (carrossel/reels usam brand voice/refs do cliente)
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar as RadarIcon, LayoutGrid, Film, Info, Check, X as XIcon } from "lucide-react";
import { ClientSourcesManager } from "@/components/kai/viral-radar-original/components/ClientSourcesManager";
import { useClientContext } from "@/hooks/useClientContext";
// 2026-05-09 — Removido `import "@/components/kai/viral-radar-original/styles/globals.css"`.
// O top-level import vazava tokens RDV (paper, REC coral) globalmente quando
// user abria Perfil do Cliente. O viral-radar-original/MainApp.tsx já importa
// esse globals.css quando o tab Radar é aberto, então não precisa duplicar
// aqui. Trade-off: ClientSourcesManager pode ficar visualmente "neutro" no
// Perfil até o user abrir Radar Viral 1x na sessão — aceitável.

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
    <Tabs defaultValue="radar" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="radar" className="text-xs gap-1">
          <RadarIcon className="h-3.5 w-3.5" />
          Radar
        </TabsTrigger>
        <TabsTrigger value="carousel" className="text-xs gap-1">
          <LayoutGrid className="h-3.5 w-3.5" />
          Carrossel
        </TabsTrigger>
        <TabsTrigger value="reels" className="text-xs gap-1">
          <Film className="h-3.5 w-3.5" />
          Reels
        </TabsTrigger>
      </TabsList>

      {/* Radar — fontes per-client */}
      <TabsContent value="radar" className="mt-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RadarIcon className="h-4 w-4" />
              Fontes do Radar Viral
            </CardTitle>
            <CardDescription>
              Cadastre RSS, perfis de Instagram, TikTok, YouTube, X, Threads e
              LinkedIn que o Radar deve monitorar pra este cliente. Os crons leem
              esta lista pra montar o brief diário.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* `.rdv-shell` ativa os tokens visuais (paper, REC coral, fontes)
                do Radar — o ClientSourcesManager usa essas custom props. */}
            <div className="rdv-shell" style={{ background: "transparent" }}>
              <ClientSourcesManager clientId={clientId} clientName={clientName} />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

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
              hint="Tab Perfil → Tom de Voz · Tab Contexto IA → guia de identidade"
            />
            <BulletPoint
              label="Referências de conteúdo (texto/links)"
              hint="Tab Referências → Referências de Conteúdo"
            />
            <BulletPoint
              label="Referências visuais (imagens, paleta)"
              hint="Tab Referências → Referências Visuais"
            />
            <BulletPoint
              label="Redes sociais e handles"
              hint="Tab Digital → Redes Sociais"
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Reels — idem */}
      <TabsContent value="reels" className="mt-4 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-4 w-4" />
              Reels Viral
            </CardTitle>
            <CardDescription>
              O Reels Viral adapta vídeos virais usando o tom, persona e refs do
              cliente. Sem configs exclusivas do app — status atual:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <StatusItem
              ok={hasVoiceProfile}
              label="Tom de voz / persona configurado"
              detail={hasVoiceProfile ? 'OK' : 'Faltando'}
            />
            <StatusItem
              ok={personaSet}
              label="Público-alvo (dores + objetivos)"
              detail={personaSet ? 'OK' : 'Faltando'}
            />
            <StatusItem
              ok={visualRefsCount > 0}
              label="Refs visuais / concorrentes"
              detail={`${visualRefsCount} salvas`}
            />
            <StatusItem
              ok={hasInstagramConnected}
              label="Conta IG conectada (adapt automático)"
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
              label="Tom de voz e persona"
              hint="Tab Perfil → Tom de Voz · Tab Contexto IA"
            />
            <BulletPoint
              label="Público-alvo (persona, dores, objetivos)"
              hint="Tab Perfil → Público-Alvo + Objetivos"
            />
            <BulletPoint
              label="Concorrentes e refs visuais"
              hint="Tab Referências → Referências Visuais"
            />
            <BulletPoint
              label="Conta IG conectada (pra adapt automático)"
              hint="Tab Integrações → Instagram"
            />
          </CardContent>
        </Card>
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
