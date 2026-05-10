/**
 * PlanningItemReferencesPanel — pílulas das referências linkadas ao card.
 *
 * Lê IDs de `metadata.related_references: string[]` e busca títulos em
 * `client_reference_library` (1 query batch). Mostra como pills clicáveis
 * que abrem `ReferencePopup` (já existente).
 *
 * Botão "+ Adicionar referência" abre um dropdown com a biblioteca do cliente
 * (filtra texto). Adicionar persiste no `metadata.related_references` do
 * `planning_items`.
 *
 * Por que não no card (`PlanningItemCard`): ficaria poluído. Só faz sentido
 * dentro do dialog onde user já tá editando.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReferencePopup } from './ReferencePopup';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface Props {
  planningItemId: string;
  clientId: string | null;
  metadata: Record<string, unknown>;
  /** Permite atualização local sem aguardar refetch */
  onMetadataUpdate?: (next: Record<string, unknown>) => void;
}

interface RefRow {
  id: string;
  title: string;
  reference_type: string;
}

export function PlanningItemReferencesPanel({
  planningItemId,
  clientId,
  metadata,
  onMetadataUpdate,
}: Props) {
  const queryClient = useQueryClient();
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Lê IDs do metadata
  const refIds = useMemo<string[]>(() => {
    const raw = (metadata as any)?.related_references;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  }, [metadata]);

  // Fetch títulos das refs linkadas (só roda se houver IDs)
  const { data: linkedRefs = [] } = useQuery({
    queryKey: ['planning-related-refs', planningItemId, refIds.join(',')],
    queryFn: async () => {
      if (refIds.length === 0) return [] as RefRow[];
      const { data, error } = await supabase
        .from('client_reference_library')
        .select('id, title, reference_type')
        .in('id', refIds);
      if (error) {
        console.warn('[PlanningItemReferencesPanel] refs fetch failed:', error);
        return [] as RefRow[];
      }
      return (data || []) as RefRow[];
    },
    enabled: refIds.length > 0,
    staleTime: 30_000,
  });

  // Fetch biblioteca completa do cliente pra picker (só quando popover abre)
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: allRefs = [], isLoading: loadingPicker } = useQuery({
    queryKey: ['client-reference-library', clientId],
    queryFn: async () => {
      if (!clientId) return [] as RefRow[];
      const { data, error } = await supabase
        .from('client_reference_library')
        .select('id, title, reference_type')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as RefRow[];
    },
    enabled: !!clientId && pickerOpen,
    staleTime: 60_000,
  });

  const availableRefs = useMemo(() => {
    const linked = new Set(refIds);
    const filtered = allRefs.filter((r) => !linked.has(r.id));
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.reference_type.toLowerCase().includes(q)
    );
  }, [allRefs, refIds, search]);

  const updateMetadata = async (nextRelatedRefs: string[]) => {
    const next = { ...metadata, related_references: nextRelatedRefs };
    const { error } = await supabase
      .from('planning_items')
      .update({ metadata: next as unknown as Json })
      .eq('id', planningItemId);
    if (error) {
      toast.error('Erro ao atualizar referências: ' + error.message);
      return;
    }
    onMetadataUpdate?.(next);
    queryClient.invalidateQueries({ queryKey: ['planning-items'] });
    queryClient.invalidateQueries({ queryKey: ['planning-related-refs', planningItemId] });
  };

  const addRef = async (refId: string) => {
    if (refIds.includes(refId)) return;
    await updateMetadata([...refIds, refId]);
    setSearch('');
    setPickerOpen(false);
    toast.success('Referência adicionada');
  };

  const removeRef = async (refId: string) => {
    await updateMetadata(refIds.filter((id) => id !== refId));
  };

  // Clear search ao fechar popover
  useEffect(() => {
    if (!pickerOpen) setSearch('');
  }, [pickerOpen]);

  if (!clientId) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3 w-3" />
          Inspirado em ({linkedRefs.length})
        </span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] gap-1 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar referência..."
                  className="h-7 text-xs pl-7"
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="max-h-64">
              <div className="py-1">
                {loadingPicker ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    Carregando biblioteca...
                  </div>
                ) : availableRefs.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    {allRefs.length === 0
                      ? 'Cliente ainda não tem referências.'
                      : 'Nenhuma referência encontrada.'}
                  </div>
                ) : (
                  availableRefs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2 focus-visible:bg-accent focus-visible:outline-none"
                      onClick={() => addRef(r.id)}
                    >
                      <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{r.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {r.reference_type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {linkedRefs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhuma referência linkada ainda.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {linkedRefs.map((r) => (
            <Badge
              key={r.id}
              variant="secondary"
              className="text-[10px] gap-1 pl-1.5 pr-0.5 py-0.5 group"
            >
              <button
                type="button"
                className="cursor-pointer hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={() => setOpenPopupId(r.id)}
                title={r.title}
              >
                {r.title.length > 24 ? r.title.slice(0, 24) + '...' : r.title}
              </button>
              <button
                type="button"
                className="ml-0.5 rounded hover:bg-destructive/20 p-0.5 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRef(r.id);
                }}
                aria-label={`Remover ${r.title}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {openPopupId && (
        <ReferencePopup
          open={!!openPopupId}
          onClose={() => setOpenPopupId(null)}
          type="reference"
          id={openPopupId}
        />
      )}
    </div>
  );
}
