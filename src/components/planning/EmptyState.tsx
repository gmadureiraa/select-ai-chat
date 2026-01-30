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
      <div className="flex flex-col items-center justify-center py-4 px-3 text-center">
        {displayIcon && (
          <div className="text-muted-foreground/30 mb-1.5 [&>svg]:h-6 [&>svg]:w-6">
            {displayIcon}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">{displayDescription}</p>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="mt-1.5 text-[10px] h-6 gap-1 px-2"
          >
            <Plus className="h-2.5 w-2.5" />
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {displayIcon && (
        <div className="text-muted-foreground/20 mb-3 [&>svg]:h-10 [&>svg]:w-10">
          {displayIcon}
        </div>
      )}
      <h3 className="text-xs font-medium text-foreground mb-0.5">{displayTitle}</h3>
      <p className="text-[10px] text-muted-foreground max-w-[200px]">{displayDescription}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-3 gap-1 h-7 text-xs"
        >
          <Plus className="h-3 w-3" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
