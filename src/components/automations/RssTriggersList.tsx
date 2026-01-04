import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Rss, Plus, Pencil, Trash2, ExternalLink, Clock, 
  CheckCircle2, AlertCircle, Loader2 
} from 'lucide-react';
import { useRssTriggers } from '@/hooks/useRssTriggers';
import { RssTriggerDialog } from './RssTriggerDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RssTrigger } from '@/types/rssTrigger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function RssTriggersList() {
  const { triggers, isLoading, toggleTrigger, deleteTrigger } = useRssTriggers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<RssTrigger | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RssTrigger | null>(null);

  const handleEdit = (trigger: RssTrigger) => {
    setSelectedTrigger(trigger);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTrigger(null);
    setDialogOpen(true);
  };

  const handleToggle = (trigger: RssTrigger) => {
    toggleTrigger.mutate({ id: trigger.id, is_active: !trigger.is_active });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteTrigger.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">RSS Triggers</h3>
            <Badge variant="secondary">{triggers?.length || 0}</Badge>
          </div>
          <Button size="sm" onClick={handleCreate} className="gap-1">
            <Plus className="h-4 w-4" />
            Novo Trigger
          </Button>
        </div>

        {triggers?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Rss className="h-10 w-10 text-muted-foreground mb-3" />
              <h4 className="font-medium mb-1">Nenhum RSS Trigger configurado</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Crie um trigger para gerar conteúdo automaticamente a partir de feeds RSS
              </p>
              <Button onClick={handleCreate} variant="outline" className="gap-1">
                <Plus className="h-4 w-4" />
                Criar Primeiro Trigger
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {triggers?.map(trigger => (
              <Card key={trigger.id} className={!trigger.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{trigger.name}</h4>
                        {trigger.auto_generate_content && (
                          <Badge variant="outline" className="text-xs">Auto IA</Badge>
                        )}
                      </div>
                      
                      <a 
                        href={trigger.rss_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                      >
                        {trigger.rss_url}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {trigger.platform && (
                          <span className="capitalize">{trigger.platform}</span>
                        )}
                        {trigger.last_checked_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Checado {formatDistanceToNow(new Date(trigger.last_checked_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {trigger.is_active ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-yellow-500" />
                          )}
                          {trigger.is_active ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={trigger.is_active}
                        onCheckedChange={() => handleToggle(trigger)}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(trigger)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeleteTarget(trigger)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RssTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trigger={selectedTrigger}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir RSS Trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o trigger "{deleteTarget?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
