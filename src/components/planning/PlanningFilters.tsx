import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFiltersCount = [
    filters.clientId,
    filters.platform,
    filters.status,
    filters.priority,
    filters.search
  ].filter(Boolean).length;

  const hasActiveFilters = activeFiltersCount > 0;

  const clearFilters = () => {
    onChange({});
  };

  const FiltersContent = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className={cn(
      "flex items-center gap-1.5",
      inSheet && "flex-col items-stretch gap-2"
    )}>
      {/* Search */}
      <div className={cn("relative", inSheet ? "w-full" : "flex-1 min-w-[140px] max-w-[180px]")}>
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          className="pl-7 h-7 text-xs border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-border rounded-md"
        />
      </div>

      {/* Filters - inline ghost style */}
      <Select
        value={filters.clientId === '' ? 'all' : (filters.clientId || 'all')}
        onValueChange={(v) => onChange({ ...filters, clientId: v === 'all' ? '' : v })}
      >
        <SelectTrigger className={cn(
          "h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 rounded-md",
          filters.clientId && filters.clientId !== '' && "text-foreground bg-muted/50",
          inSheet ? "w-full border" : "w-[100px]"
        )}>
          <SelectValue placeholder="Perfil" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {clients?.map(client => (
            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.platform || 'all'}
        onValueChange={(v) => onChange({ ...filters, platform: v === 'all' ? undefined : v as PlanningPlatform })}
      >
        <SelectTrigger className={cn(
          "h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 rounded-md",
          filters.platform && "text-foreground bg-muted/50",
          inSheet ? "w-full border" : "w-[90px]"
        )}>
          <SelectValue placeholder="Rede" />
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
        <SelectTrigger className={cn(
          "h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 rounded-md",
          filters.status && "text-foreground bg-muted/50",
          inSheet ? "w-full border" : "w-[85px]"
        )}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {statuses.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilters} 
          className={cn("h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md", inSheet && "w-full")}
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1 text-primary font-medium">{activeFiltersCount}</span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="text-sm">Filtros</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <FiltersContent inSheet />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex items-center">
      <FiltersContent />
    </div>
  );
}
