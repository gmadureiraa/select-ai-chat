import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import type { PlanningFilters as FilterType, PlanningPlatform, PlanningStatus, PlanningPriority } from '@/hooks/usePlanningItems';

interface PlanningFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
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

const statuses: { value: PlanningStatus; label: string }[] = [
  { value: 'idea', label: 'Ideia' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Revisão' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'published', label: 'Publicado' },
  { value: 'failed', label: 'Falhou' },
];

const priorities: { value: PlanningPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function PlanningFilters({ filters, onChange }: PlanningFiltersProps) {
  const { clients } = useClients();

  const hasActiveFilters = filters.clientId || filters.platform || filters.status || filters.priority || filters.search;

  const clearFilters = () => {
    onChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
      <Filter className="h-4 w-4 text-muted-foreground" />
      
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Select
        value={filters.clientId === '' ? 'all' : (filters.clientId || 'all')}
        onValueChange={(v) => onChange({ ...filters, clientId: v === 'all' ? '' : v })}
      >
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos clientes</SelectItem>
          {clients?.map(client => (
            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.platform || 'all'}
        onValueChange={(v) => onChange({ ...filters, platform: v === 'all' ? undefined : v as PlanningPlatform })}
      >
        <SelectTrigger className="w-[130px] h-8 text-sm">
          <SelectValue placeholder="Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {platforms.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v as PlanningStatus })}
      >
        <SelectTrigger className="w-[120px] h-8 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {statuses.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority || 'all'}
        onValueChange={(v) => onChange({ ...filters, priority: v === 'all' ? undefined : v as PlanningPriority })}
      >
        <SelectTrigger className="w-[110px] h-8 text-sm">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {priorities.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
