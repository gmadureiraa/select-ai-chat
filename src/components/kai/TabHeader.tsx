import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TabHeader — header padrão pras tabs principais do KAI.
 *
 * Padrão visual:
 *   - Ícone (opcional) à esquerda em badge primary
 *   - Título h2
 *   - Subtítulo/descrição opcional
 *   - Slot `actions` à direita (botões, search, filters)
 *
 * Uso:
 *   <TabHeader
 *     icon={Library}
 *     title="Biblioteca"
 *     description="Conteúdos, refs e visuais salvos pro cliente"
 *     actions={<Button>...</Button>}
 *   />
 */
interface TabHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Tag breadcrumb-like (ex: nome do cliente). */
  breadcrumb?: string;
  /**
   * Eyebrow mono uppercase acima do título (estilo Sequência Viral).
   * Ex: "PLANEJAMENTO DE CONTEÚDO". Renderiza com REC dot animado.
   */
  eyebrow?: string;
  className?: string;
}

export function TabHeader({
  icon: Icon,
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
  className,
}: TabHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5">
              <span className="kai-eyebrow">{eyebrow}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
              {title}
            </h2>
            {breadcrumb && (
              <>
                <span className="text-muted-foreground/40 hidden sm:inline">·</span>
                <span className="text-xs text-muted-foreground truncate">
                  {breadcrumb}
                </span>
              </>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
