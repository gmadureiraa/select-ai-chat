import { ReactNode } from 'react';
import { CalendarDays, FileText, Inbox, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  type: 'calendar' | 'kanban' | 'list' | 'search' | 'column';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  compact?: boolean;
}

const defaultConfig = {
  calendar: {
    icon: <CalendarDays className="h-8 w-8" />,
    title: 'Nenhum item agendado',
    description: 'Clique em um dia para criar um novo conteúdo',
  },
  kanban: {
    icon: <Inbox className="h-8 w-8" />,
    title: 'Board vazio',
    description: 'Crie seu primeiro item para começar a organizar',
  },
  list: {
    icon: <FileText className="h-8 w-8" />,
    title: 'Nenhum item encontrado',
    description: 'Crie um novo item ou ajuste os filtros',
  },
  search: {
    icon: <Search className="h-8 w-8" />,
    title: 'Nenhum resultado',
    description: 'Tente outros termos ou remova filtros',
  },
  column: {
    icon: null,
    title: 'Coluna vazia',
    description: 'Arraste itens aqui ou crie um novo',
  },
};

export function EmptyState({
  type,
  title,
  description,
  action,
  icon,
  compact = false,
}: EmptyStateProps) {
  const config = defaultConfig[type];
  const displayIcon = icon !== undefined ? icon : config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
        {displayIcon && (
          <div className="text-muted-foreground/40 mb-2">
            {displayIcon}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{displayDescription}</p>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="mt-2 text-xs h-7 gap-1"
          >
            <Plus className="h-3 w-3" />
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {displayIcon && (
        <div className="text-muted-foreground/30 mb-4">
          {displayIcon}
        </div>
      )}
      <h3 className="text-sm font-medium text-foreground mb-1">{displayTitle}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{displayDescription}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
