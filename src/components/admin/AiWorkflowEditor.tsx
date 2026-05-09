// AiWorkflowEditor — Dialog admin pra editar ai_workflows existentes
// (Madureira-style: 10 workflows seedados em 0016).
//
// Permite editar: name, description, schedule_cron, is_active, config (jsonb).
// O campo `config` aceita qualquer payload que o run-madureira-workflows-daily
// entenda (client_id, format, platform, content_type, slides_min/max, etc).
//
// Auth: super_admin OR owner/admin do workspace dono. Validação no backend.
import { useEffect, useState } from 'react';
import { Pencil, Loader2, AlertCircle, Calendar, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AiWorkflow, describeCron, useAiWorkflows } from '@/hooks/useAiWorkflows';
import { cn } from '@/lib/utils';

interface AiWorkflowEditorProps {
  workflow: AiWorkflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiWorkflowEditor({ workflow, open, onOpenChange }: AiWorkflowEditorProps) {
  const { updateWorkflow } = useAiWorkflows();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleCron, setScheduleCron] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [configRaw, setConfigRaw] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);
  const [cronError, setCronError] = useState<string | null>(null);

  useEffect(() => {
    if (open && workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? '');
      setScheduleCron(workflow.schedule_cron);
      setIsActive(workflow.is_active);
      try {
        setConfigRaw(JSON.stringify(workflow.config ?? {}, null, 2));
      } catch {
        setConfigRaw('{}');
      }
      setConfigError(null);
      setCronError(null);
    }
  }, [open, workflow]);

  // Live cron validation
  useEffect(() => {
    if (!scheduleCron.trim()) {
      setCronError(null);
      return;
    }
    const parts = scheduleCron.trim().split(/\s+/);
    if (parts.length < 5) {
      setCronError('Esperado 5 segmentos (min hora dia-mes mes dia-semana)');
    } else {
      setCronError(null);
    }
  }, [scheduleCron]);

  // Live config JSON validation
  useEffect(() => {
    if (!configRaw.trim()) {
      setConfigError(null);
      return;
    }
    try {
      const parsed = JSON.parse(configRaw);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setConfigError('config deve ser um objeto JSON');
      } else {
        setConfigError(null);
      }
    } catch (e: any) {
      setConfigError(`JSON inválido: ${e.message}`);
    }
  }, [configRaw]);

  const isValid =
    !!workflow &&
    name.trim().length > 0 &&
    !cronError &&
    !configError &&
    !updateWorkflow.isPending;

  const handleSubmit = () => {
    if (!workflow || !isValid) return;
    let config: Record<string, unknown>;
    try {
      config = configRaw.trim() ? JSON.parse(configRaw) : {};
    } catch (e: any) {
      setConfigError(`JSON inválido: ${e.message}`);
      return;
    }

    const payload: Parameters<typeof updateWorkflow.mutate>[0] = {
      id: workflow.id,
      name: name.trim(),
      description: description.trim() || null,
      schedule_cron: scheduleCron.trim(),
      is_active: isActive,
      config,
    };

    updateWorkflow.mutate(payload, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-purple-500" />
            Editar Workflow AI
          </DialogTitle>
          <DialogDescription>
            Workflow Madureira (cron próprio em <code>run-madureira-workflows-daily</code>).
            Edite nome, descrição, cron, status ou config bruto (jsonb).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="wf-name">Nome</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Madureira — Carrossel diário 9h"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="wf-desc">Descrição</Label>
            <Textarea
              id="wf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pequena descrição do que o workflow faz"
              rows={2}
            />
          </div>

          {/* Cron */}
          <div className="space-y-2">
            <Label htmlFor="wf-cron" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              schedule_cron
            </Label>

            {/* Presets rápidos — clique pra preencher cron */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Diário 9h UTC', cron: '0 9 * * *' },
                { label: 'Diário 12h UTC', cron: '0 12 * * *' },
                { label: 'Seg-Sex 12h', cron: '0 12 * * 1-5' },
                { label: 'Seg, Qua, Sex', cron: '0 12 * * 1,3,5' },
                { label: 'Sex 14h', cron: '0 14 * * 5' },
                { label: 'Qui 18h', cron: '0 18 * * 4' },
                { label: 'Dia 1 do mês', cron: '0 9 1 * *' },
              ].map((p) => (
                <Button
                  key={p.cron}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setScheduleCron(p.cron)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <Input
              id="wf-cron"
              value={scheduleCron}
              onChange={(e) => setScheduleCron(e.target.value)}
              placeholder="Ex: 0 12 * * 1-5"
              className={cn('font-mono text-sm', cronError && 'border-red-500')}
            />
            {cronError ? (
              <p className="text-xs text-red-500 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {cronError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {describeCron(scheduleCron)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Cron é avaliado em UTC. Vercel cron dispara no master cron diário (7h UTC) que enfileira workflows due hoje.
            </p>
          </div>

          {/* is_active */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-base">Ativo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando desativado o cron pula este workflow.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Config jsonb */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="wf-config">config (jsonb)</Label>
              <Badge variant="outline" className="text-[10px] font-mono">
                {configRaw.length} chars
              </Badge>
            </div>
            <Textarea
              id="wf-config"
              value={configRaw}
              onChange={(e) => setConfigRaw(e.target.value)}
              rows={14}
              className={cn(
                'font-mono text-xs leading-relaxed',
                configError && 'border-red-500',
              )}
              spellCheck={false}
            />
            {configError ? (
              <p className="text-xs text-red-500 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {configError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Campos comuns: <code>client_id</code>, <code>format</code>, <code>platform</code>,
                <code> content_type</code>, <code>status_after_generation</code>,
                <code> due_date_offset_days</code>, <code>slides_min/max</code>,
                <code> rotation_by_weekday</code>.
              </p>
            )}
          </div>

          {/* Read-only meta */}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t pt-3">
            <div>
              <span className="font-medium block text-foreground">id</span>
              <code className="break-all">{workflow.id}</code>
            </div>
            <div>
              <span className="font-medium block text-foreground">agent_id</span>
              <code className="break-all">{workflow.agent_id}</code>
            </div>
            <div>
              <span className="font-medium block text-foreground">last_run_at</span>
              {workflow.last_run_at ?? '—'}
            </div>
            <div>
              <span className="font-medium block text-foreground">next_run_at</span>
              {workflow.next_run_at ?? '—'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {updateWorkflow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
