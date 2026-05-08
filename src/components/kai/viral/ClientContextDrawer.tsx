/**
 * Drawer expandido de contexto do cliente — abre via botão do
 * `ClientContextHeader` e mostra todo o contexto KAI carregado pelo hook
 * `useClientWorkspaceContext` em 4 tabs:
 *  - Visão  → nome + indústria + descrição + persona resumida
 *  - Voz    → tom + 3+ pillars + brand do/dont
 *  - Refs   → grid de até 12 thumbs visuais (com lightbox via target=_blank)
 *  - Histó. → top 5 posts da content_library + concorrentes + sites + docs
 *
 * Renderiza dentro do scope dos viral apps (sv-*, rv-*, rdv-*) usando o Sheet
 * do shadcn que portaliza pro `<body>`, então o CSS isolado dos apps não
 * vaza pro drawer (nem vice-versa). Tailwind básico no conteúdo.
 *
 * Mobile: side="bottom". Desktop: side="right".
 */

import {
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  ImageOff,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

import type { ClientWorkspaceContext } from "./lib/use-client-workspace-context";

interface ClientContextDrawerProps {
  context: ClientWorkspaceContext | null | undefined;
  /** Override de side. Se omitido, escolhe automático: bottom em mobile, right em desktop. */
  side?: "right" | "bottom";
  /** Variant do trigger (mantém contraste no header light/dark). */
  triggerVariant?: "light" | "dark";
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClientContextDrawer({
  context,
  side: sideProp,
  triggerVariant = "light",
}: ClientContextDrawerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Trava o side somente ao abrir pra evitar re-mount/glitch em resize.
  const [resolvedSide, setResolvedSide] = useState<"right" | "bottom">("right");

  useEffect(() => {
    if (!open) return;
    setResolvedSide(sideProp ?? (isMobile ? "bottom" : "right"));
  }, [open, isMobile, sideProp]);

  if (!context?.client) return null;

  const { client, tone, pillars, persona, brand } = context;

  // Top 12 visuais pra grid 3x4 confortável no drawer.
  const visuals = context.visualReferences.slice(0, 12);
  const topContent = context.contentLibrary.slice(0, 5);
  const competitors = context.competitors.slice(0, 12);
  const websites = context.websites.slice(0, 8);
  const documents = context.documents.slice(0, 12);

  // Logo do cliente: tags do schema KAI guardam logo_url no jsonb (pode não
  // estar lá). Best-effort sem quebrar se ausente.
  const logoUrl =
    (client.tags as Record<string, unknown> | null)?.["logo_url"];
  const logoSrc = typeof logoUrl === "string" ? logoUrl : undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-7 text-xs"
          style={
            triggerVariant === "dark"
              ? {
                  background: "rgba(245, 241, 232, 0.06)",
                  borderColor: "rgba(245, 241, 232, 0.22)",
                  color: "rgba(245, 241, 232, 0.92)",
                }
              : undefined
          }
        >
          <Avatar className="h-4 w-4">
            {logoSrc && <AvatarImage src={logoSrc} alt={client.name} />}
            <AvatarFallback
              className="text-[8px] font-semibold"
              style={{ background: "rgba(0,0,0,0.08)" }}
            >
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">Ver contexto</span>
          <span className="sm:hidden">Ctx</span>
          <ChevronRight className="h-3 w-3 opacity-60" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side={resolvedSide}
        className={
          resolvedSide === "bottom"
            ? "h-[85vh] sm:max-w-none overflow-y-auto p-0"
            : "w-full sm:max-w-md overflow-y-auto p-0"
        }
      >
        {/* Header com avatar grande + nome + indústria + tom */}
        <SheetHeader className="px-6 pt-6 pb-4 text-left border-b">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              {logoSrc && <AvatarImage src={logoSrc} alt={client.name} />}
              <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-tight truncate">
                {client.name}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {client.industry ?? "Sem indústria definida"}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tone && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {tone}
                  </Badge>
                )}
                {pillars.slice(0, 2).map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="text-[10px] truncate max-w-[140px]"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="px-6 pt-4 pb-8">
          <TabsList className="grid grid-cols-4 w-full h-9">
            <TabsTrigger value="overview" className="text-xs">
              Visão
            </TabsTrigger>
            <TabsTrigger value="voice" className="text-xs">
              Voz
            </TabsTrigger>
            <TabsTrigger value="refs" className="text-xs">
              Refs
            </TabsTrigger>
            <TabsTrigger value="content" className="text-xs">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ── */}
          <TabsContent
            value="overview"
            className="mt-4 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1"
          >
            {client.description && (
              <div>
                <SectionLabel>Sobre</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {client.description}
                </p>
              </div>
            )}

            <div>
              <SectionLabel>Persona</SectionLabel>
              <div className="space-y-1.5 text-sm">
                <PersonaRow label="Idade" value={persona.age} />
                <PersonaRow label="Dor" value={persona.pain} />
                <PersonaRow label="Quer" value={persona.goal} />
                {!persona.age && !persona.pain && !persona.goal && (
                  <p className="text-xs text-muted-foreground italic">
                    Persona não definida.
                  </p>
                )}
              </div>
            </div>

            {pillars.length > 0 && (
              <div>
                <SectionLabel>Pilares de conteúdo</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {pillars.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── VOZ + BRAND ── */}
          <TabsContent
            value="voice"
            className="mt-4 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1"
          >
            <div>
              <SectionLabel>Tom da marca</SectionLabel>
              <p className="text-sm">
                {tone ? (
                  <span className="font-medium">{tone}</span>
                ) : (
                  <span className="text-muted-foreground italic">
                    Sem tom definido.
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <SectionLabel className="text-emerald-600">Faça</SectionLabel>
                {brand.do.length > 0 ? (
                  <ul className="space-y-1 text-xs leading-relaxed">
                    {brand.do.map((item, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-emerald-600 shrink-0">+</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">—</p>
                )}
              </div>
              <div>
                <SectionLabel className="text-red-600">Evite</SectionLabel>
                {brand.dont.length > 0 ? (
                  <ul className="space-y-1 text-xs leading-relaxed">
                    {brand.dont.map((item, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-red-600 shrink-0">−</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">—</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── REFS VISUAIS ── */}
          <TabsContent
            value="refs"
            className="mt-4 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1"
          >
            {visuals.length > 0 ? (
              <>
                <SectionLabel>
                  Refs visuais ({context.visualReferences.length})
                </SectionLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  {visuals.map((ref) => (
                    <a
                      key={ref.id}
                      href={ref.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square overflow-hidden rounded border hover:opacity-80 transition-opacity bg-muted flex items-center justify-center"
                      title={ref.title ?? "Ref"}
                    >
                      {ref.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ref.image_url}
                          alt={ref.title ?? "ref"}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-4 w-4 opacity-40" />
                      )}
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Sem refs visuais cadastrados.
              </p>
            )}

            {websites.length > 0 && (
              <div>
                <SectionLabel className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Sites
                </SectionLabel>
                <ul className="space-y-1.5">
                  {websites.map((w) => (
                    <li key={w.id} className="text-xs truncate">
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {w.url}
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {documents.length > 0 && (
              <div>
                <SectionLabel className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Documentos
                </SectionLabel>
                <ul className="space-y-1">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="text-xs truncate flex items-center gap-1.5 text-muted-foreground"
                      title={d.name}
                    >
                      <FileText className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{d.name}</span>
                      {d.file_type && (
                        <span className="text-[9px] uppercase opacity-50 shrink-0">
                          {d.file_type}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ── HISTÓRICO + CONCORRENTES ── */}
          <TabsContent
            value="content"
            className="mt-4 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1"
          >
            {topContent.length > 0 ? (
              <div>
                <SectionLabel className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Top conteúdos do cliente
                </SectionLabel>
                <ul className="space-y-2">
                  {topContent.map((item) => {
                    const rawScore = item.metrics?.["engagement_score"];
                    const score =
                      typeof rawScore === "number" ? rawScore : null;
                    return (
                      <li
                        key={item.id}
                        className="border rounded-md p-2.5 text-xs space-y-1 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium leading-snug truncate">
                            {item.title ?? "(sem título)"}
                          </span>
                          {score !== null && (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0"
                            >
                              {Math.round(score)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                          <span>{item.content_type ?? "—"}</span>
                          {item.created_at && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(item.created_at).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Sem conteúdo histórico ainda.
              </p>
            )}

            {competitors.length > 0 && (
              <div>
                <SectionLabel className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> Concorrentes
                </SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {competitors.map((comp) => (
                    <span
                      key={comp.id}
                      className="text-[10px] px-2 py-1 rounded-full border bg-muted/40"
                      title={comp.notes ?? undefined}
                    >
                      @{comp.handle ?? "—"}
                      {comp.platform && (
                        <span className="opacity-60 ml-1">
                          · {comp.platform}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 ${
        className
      }`}
    >
      {children}
    </div>
  );
}

function PersonaRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground text-xs w-12 shrink-0 mt-0.5">
        {label}
      </span>
      <span className="leading-snug">{value}</span>
    </div>
  );
}
