import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { cn } from '@/lib/utils';
import type { PlanningItem, CreatePlanningItemInput, PlanningPlatform, PlanningPriority, KanbanColumn } from '@/hooks/usePlanningItems';

interface PlanningItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PlanningItem | null;
  columns: KanbanColumn[];
  defaultColumnId?: string;
  defaultDate?: Date;
  onSave: (data: CreatePlanningItemInput) => Promise<void>;
  onUpdate?: (id: string, data: Partial<PlanningItem>) => Promise<void>;
}

const platforms: { value: PlanningPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Outro' },
];

const priorities: { value: PlanningPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function PlanningItemDialog({
  open,
  onOpenChange,
  item,
  columns,
  defaultColumnId,
  defaultDate,
  onSave,
  onUpdate
}: PlanningItemDialogProps) {
  const { clients } = useClients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [platform, setPlatform] = useState<PlanningPlatform | ''>('');
  const [priority, setPriority] = useState<PlanningPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setContent(item.content || '');
      setClientId(item.client_id || '');
      setColumnId(item.column_id || '');
      setPlatform(item.platform || '');
      setPriority(item.priority);
      // Use parseISO to correctly parse date strings without timezone shift
      setDueDate(item.due_date ? parseISO(item.due_date) : undefined);
      setScheduledAt(item.scheduled_at ? parseISO(item.scheduled_at) : undefined);
    } else {
      setTitle('');
      setDescription('');
      setContent('');
      setClientId('');
      setColumnId(defaultColumnId || columns[0]?.id || '');
      setPlatform('');
      setPriority('medium');
      setDueDate(defaultDate);
      setScheduledAt(undefined);
    }
  }, [item, defaultColumnId, defaultDate, columns, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const data: CreatePlanningItemInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        content: content.trim() || undefined,
        client_id: clientId || undefined,
        column_id: columnId || undefined,
        platform: platform || undefined,
        priority,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
      };

      if (item && onUpdate) {
        await onUpdate(item.id, data);
      } else {
        await onSave(data);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Card' : 'Novo Card'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do conteúdo"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Coluna</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as PlanningPlatform)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as PlanningPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texto completo do conteúdo"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Prevista</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Agendar Para</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledAt ? format(scheduledAt, 'dd/MM HH:mm') : 'Agendar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
