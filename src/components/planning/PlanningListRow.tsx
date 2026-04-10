import { memo, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MoreHorizontal, Calendar, Flag,
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video, Facebook, AtSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { PublicationStatusBadge } from './PublicationStatusBadge';
import { useClientPlatformStatus } from '@/hooks/useClientPlatformStatus';
import { PLATFORM_COLOR_MAP } from '@/types/contentTypes';
import type { PlanningItem } from '@/hooks/usePlanningItems';

interface PlanningListRowProps {
  item: PlanningItem;
  onEdit: (item: PlanningItem) => void;
  onDelete: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry?: (id: string) => void;
  onDuplicate?: (item: PlanningItem) => void;
  canDelete?: boolean;
}

const platformIcons: Record<string, React.ElementType> = {
  twitter: Twitter, linkedin: Linkedin, instagram: Instagram, youtube: Youtube,
  newsletter: Mail, blog: FileText, tiktok: Video, facebook: Facebook, threads: AtSign, other: FileText,
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  urgent: { color: 'text-red-600', label: 'Urgente' },
  high: { color: 'text-red-500', label: 'Alta' },
  medium: { color: 'text-amber-500', label: 'Média' },
  low: { color: 'text-blue-400', label: 'Baixa' },
};

const statusLabels: Record<string, string> = {
  idea: 'Ideia', draft: 'Rascunho', review: 'Revisão', approved: 'Aprovado',
  scheduled: 'Agendado', publishing: 'Publicando', published: 'Publicado', failed: 'Falhou',
};

export const PlanningListRow = memo(function PlanningListRow({
  item, onEdit, onDelete, onMoveToLibrary, onRetry, onDuplicate, canDelete = true
}: PlanningListRowProps) {
  const { getPublicationMode, getPlatformStatus } = useClientPlatformStatus(item.client_id);
  const metadata = item.metadata as any || {};
  const targetPlatforms: string[] = metadata.target_platforms?.length > 0
    ? metadata.target_platforms : [item.platform || 'other'];
  const priority = (item as any).priority;
  const displayDate = item.scheduled_at || item.published_at || item.due_date;

  const publicationMode = useMemo(() => getPublicationMode(item.platform), [item.platform, getPublicationMode]);
  const platformStatus = useMemo(() => getPlatformStatus(item.platform), [item.platform, getPlatformStatus]);

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={() => onEdit(item)}
    >
      {/* Priority dot */}
      <div className="shrink-0 w-5">
        {priority && priorityConfig[priority] && (
          <Flag className={cn("h-3.5 w-3.5", priorityConfig[priority].color)} />
        )}
      </div>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
          {item.title}
        </h4>
        {(item.description || item.content) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.description || item.content}
          </p>
        )}
      </div>

      {/* Client */}
      <div className="shrink-0 w-[100px] hidden lg:block">
        {item.clients ? (
          <span className="text-xs text-muted-foreground truncate block">{item.clients.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Platforms */}
      <div className="shrink-0 w-[80px] hidden md:flex items-center gap-1">
        {targetPlatforms.slice(0, 3).map((tp) => {
          const Icon = platformIcons[tp] || FileText;
          const color = PLATFORM_COLOR_MAP[tp];
          return <Icon key={tp} className="h-3.5 w-3.5" style={color ? { color } : undefined} />;
        })}
        {targetPlatforms.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{targetPlatforms.length - 3}</span>
        )}
      </div>

      {/* Date */}
      <div className="shrink-0 w-[90px] hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
        {displayDate ? (
          <>
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{format(parseISO(displayDate), 'dd MMM', { locale: ptBR })}</span>
          </>
        ) : (
          <span className="text-muted-foreground/40">Sem data</span>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0 w-[90px]">
        <PublicationStatusBadge
          mode={publicationMode}
          status={item.status}
          errorMessage={item.error_message}
          retryCount={item.retry_count}
          accountName={platformStatus?.accountName}
          scheduledAt={item.scheduled_at}
          lateConfirmed={!!(item.external_post_id || (item.metadata as any)?.late_confirmed)}
          onRetry={onRetry ? () => onRetry(item.id) : undefined}
          compact
        />
      </div>

      {/* Assignee */}
      <div className="shrink-0 w-6 hidden lg:block">
        {item.assigned_to && (
          <Avatar className="h-5 w-5 border border-border">
            <AvatarFallback className="text-[9px] bg-muted">👤</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 w-7">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(item)}>Editar</DropdownMenuItem>
            {onDuplicate && <DropdownMenuItem onClick={() => onDuplicate(item)}>Duplicar</DropdownMenuItem>}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item.id)}>Excluir</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
