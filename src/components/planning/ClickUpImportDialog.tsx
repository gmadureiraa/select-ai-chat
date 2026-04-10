import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertTriangle, Upload, Search, ArrowRight, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useClickUpImport, type ClickUpTeam, type ListMapping } from '@/hooks/useClickUpImport';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ClickUpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type Step = 'connect' | 'map' | 'confirm' | 'importing' | 'done';

export function ClickUpImportDialog({ open, onOpenChange, onImportComplete }: ClickUpImportDialogProps) {
  const [step, setStep] = useState<Step>('connect');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedLists, setSelectedLists] = useState<Map<string, ListMapping>>(new Map());
  const { teams, isDiscovering, isImporting, result, discover, importTasks } = useClickUpImport();
  const { workspace } = useWorkspaceContext();

  useEffect(() => {
    if (open) {
      setStep('connect');
      setSelectedLists(new Map());
      // Load clients
      if (workspace?.id) {
        supabase
          .from('clients')
          .select('id, name')
          .eq('workspace_id', workspace.id)
          .order('name')
          .then(({ data }) => setClients(data || []));
      }
    }
  }, [open, workspace?.id]);

  const handleDiscover = async () => {
    try {
      await discover();
      setStep('map');
    } catch {
      // Error already toasted
    }
  };

  const toggleList = (listId: string, listName: string, spaceName: string, folderName: string | null) => {
    const newMap = new Map(selectedLists);
    if (newMap.has(listId)) {
      newMap.delete(listId);
    } else {
      newMap.set(listId, {
        list_id: listId,
        list_name: listName,
        space_name: spaceName,
        folder_name: folderName || '',
        client_id: '',
      });
    }
    setSelectedLists(newMap);
  };

  const setListClient = (listId: string, clientId: string) => {
    const newMap = new Map(selectedLists);
    const entry = newMap.get(listId);
    if (entry) {
      newMap.set(listId, { ...entry, client_id: clientId });
    }
    setSelectedLists(newMap);
  };

  const allMapped = Array.from(selectedLists.values()).every(m => m.client_id);
  const selectedCount = selectedLists.size;

  const handleImport = async () => {
    if (!workspace?.id) return;
    setStep('importing');
    try {
      await importTasks(workspace.id, Array.from(selectedLists.values()));
      setStep('done');
    } catch {
      setStep('confirm');
    }
  };

  const handleClose = () => {
    if (step === 'done' && onImportComplete) {
      onImportComplete();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar do ClickUp
          </DialogTitle>
        </DialogHeader>

        {/* Step: Connect */}
        {step === 'connect' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Conecte ao ClickUp para importar suas tarefas como itens de planejamento.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Serão importadas tarefas de abril/2026 em diante, com descrição, tags e imagens.
              </p>
            </div>
            <Button onClick={handleDiscover} disabled={isDiscovering} size="lg" className="gap-2">
              {isDiscovering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando estrutura...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Conectar e Descobrir Spaces
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <p className="text-sm text-muted-foreground">
              Selecione as listas e mapeie cada uma para um cliente do Kai.
            </p>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-4 pr-4">
                {teams.map(team => (
                  <div key={team.team_id}>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{team.team_name}</h4>
                    {team.spaces.map(space => (
                      <div key={space.id} className="mb-3">
                        <h5 className="text-sm font-medium mb-1.5 text-foreground">{space.name}</h5>
                        <div className="space-y-1.5 pl-3">
                          {space.lists.map(list => {
                            const isSelected = selectedLists.has(list.id);
                            const mapping = selectedLists.get(list.id);
                            return (
                              <div key={list.id} className={cn(
                                "flex items-center gap-3 p-2 rounded-md border transition-colors",
                                isSelected ? "border-primary/30 bg-primary/5" : "border-border/50"
                              )}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleList(list.id, list.name, space.name, list.folder)}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm truncate block">{list.name}</span>
                                  {list.folder && (
                                    <span className="text-[10px] text-muted-foreground">📁 {list.folder}</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <Select value={mapping?.client_id || ''} onValueChange={(v) => setListClient(list.id, v)}>
                                    <SelectTrigger className="w-[160px] h-8 text-xs">
                                      <SelectValue placeholder="Cliente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">{selectedCount} listas selecionadas</span>
              <Button onClick={() => setStep('confirm')} disabled={!selectedCount || !allMapped} className="gap-1.5">
                Próximo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Confirme o mapeamento antes de importar:</p>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold uppercase text-muted-foreground">
                <span>Lista ClickUp</span>
                <span>Space/Pasta</span>
                <span>Cliente Kai</span>
              </div>
              {Array.from(selectedLists.values()).map(m => (
                <div key={m.list_id} className="grid grid-cols-3 gap-2 px-3 py-2 border-t text-sm">
                  <span className="truncate">{m.list_name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {m.space_name}{m.folder_name ? ` / ${m.folder_name}` : ''}
                  </span>
                  <span className="truncate">
                    <Badge variant="secondary" className="text-[10px]">
                      {clients.find(c => c.id === m.client_id)?.name || '—'}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={handleImport} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Importar {selectedCount} listas
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">Importando tarefas...</p>
              <p className="text-xs text-muted-foreground">Isso pode demorar alguns minutos para 200+ tarefas</p>
            </div>
            <Progress value={undefined} className="w-64" />
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center space-y-1">
              <p className="font-medium text-lg">Importação concluída!</p>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="text-green-600">{result.imported} importados</span>
                {result.skipped > 0 && <span className="text-yellow-600">{result.skipped} ignorados</span>}
                {result.errors.length > 0 && <span className="text-red-500">{result.errors.length} erros</span>}
              </div>
            </div>
            {result.errors.length > 0 && (
              <ScrollArea className="max-h-32 w-full">
                <div className="space-y-1 px-4">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {err}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
