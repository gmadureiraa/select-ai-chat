import { Bot, Hand, AlertCircle, Check, Loader2, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PublicationStatusBadgeProps {
  mode: 'auto' | 'manual';
  status?: 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';
  errorMessage?: string | null;
  retryCount?: number;
  accountName?: string | null;
  scheduledAt?: string | null;
  lateConfirmed?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}

export function PublicationStatusBadge({
  mode,
  status,
  errorMessage,
  retryCount = 0,
  accountName,
  scheduledAt,
  lateConfirmed = false,
  onRetry,
  compact = false,
}: PublicationStatusBadgeProps) {
  const isFailed = status === 'failed';
  const isPublishing = status === 'publishing';
  const isPublished = status === 'published';
  const isScheduled = status === 'scheduled';

  // Failed state - priority over others
  if (isFailed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Badge 
                variant="destructive" 
                className={cn(
                  "gap-1 animate-pulse cursor-pointer",
                  compact && "text-[10px] px-1.5 py-0"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.();
                }}
              >
                <AlertCircle className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
                {!compact && 'Falhou'}
                {retryCount > 0 && (
                  <span className="text-[10px]">({retryCount}/3)</span>
                )}
              </Badge>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium text-destructive">Falha na publicação</p>
              <p className="text-xs text-muted-foreground">
                {errorMessage || 'Erro desconhecido'}
              </p>
              {retryCount > 0 && (
                <p className="text-xs">Tentativas: {retryCount}/3</p>
              )}
              {onRetry && (
                <p className="text-xs text-primary">Clique para tentar novamente</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Publishing state
  if (isPublishing) {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "gap-1 bg-blue-100 text-blue-700 border-blue-200",
          compact && "text-[10px] px-1.5 py-0"
        )}
      >
        <Loader2 className={cn("h-3 w-3 animate-spin", compact && "h-2.5 w-2.5")} />
        {!compact && 'Publicando...'}
      </Badge>
    );
  }

  // Published state
  if (isPublished) {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "gap-1 bg-green-100 text-green-700 border-green-200",
          compact && "text-[10px] px-1.5 py-0"
        )}
      >
        <Check className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
        {!compact && 'Publicado'}
      </Badge>
    );
  }

  // Scheduled state with Late confirmation status
  if (isScheduled && scheduledAt) {
    const scheduledDate = parseISO(scheduledAt);
    const formattedTime = format(scheduledDate, "dd/MM HH:mm", { locale: ptBR });
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1",
                lateConfirmed 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" 
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
                compact && "text-[10px] px-1.5 py-0"
              )}
            >
              {lateConfirmed ? (
                <CheckCircle className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
              ) : (
                <Clock className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
              )}
              {compact ? formattedTime.split(' ')[1] : formattedTime}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="space-y-1">
              <p className="font-medium">
                {lateConfirmed ? '✓ Agendamento Confirmado' : '⏳ Agendado'}
              </p>
              <p className="text-xs text-muted-foreground">
                {lateConfirmed 
                  ? `Será publicado automaticamente em ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                  : `Publicação local agendada para ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                }
              </p>
              {accountName && (
                <p className="text-xs">Conta: {accountName}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Auto/Manual mode badge for non-scheduled items
  if (mode) {
    const isAuto = mode === 'auto';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1",
                isAuto 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" 
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
                compact && "text-[10px] px-1.5 py-0"
              )}
            >
              {isAuto ? (
                <Bot className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
              ) : (
                <Hand className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
              )}
              {!compact && (isAuto ? 'Auto' : 'Manual')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isAuto ? (
              <div className="space-y-1">
                <p className="font-medium">Publicação Automática</p>
                <p className="text-xs text-muted-foreground">
                  Será publicado automaticamente via API
                </p>
                {accountName && (
                  <p className="text-xs">Conta: {accountName}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Publicação Manual</p>
                <p className="text-xs text-muted-foreground">
                  API não configurada. Publique manualmente.
                </p>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
