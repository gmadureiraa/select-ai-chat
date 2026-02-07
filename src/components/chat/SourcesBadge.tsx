import { BookOpen, FileText, Star, TrendingUp, User, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface SourcesUsed {
  identity_guide?: boolean;
  library_items_count?: number;
  top_performers_count?: number;
  format_rules?: string;
  voice_profile?: boolean;
  global_knowledge?: boolean;
}

interface SourcesBadgeProps {
  sources: SourcesUsed;
  className?: string;
  variant?: "inline" | "collapsible";
}

interface SourceItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  active?: boolean;
}

function SourceItem({ icon: Icon, label, detail, active = true }: SourceItemProps) {
  if (!active) return null;
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 text-primary/60" />
      <span>{label}</span>
      {detail && <span className="text-muted-foreground/60">({detail})</span>}
    </div>
  );
}

export function SourcesBadge({ sources, className, variant = "inline" }: SourcesBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count active sources
  const activeSourcesCount = [
    sources.identity_guide,
    (sources.library_items_count || 0) > 0,
    (sources.top_performers_count || 0) > 0,
    !!sources.format_rules,
    sources.voice_profile,
    sources.global_knowledge,
  ].filter(Boolean).length;

  if (activeSourcesCount === 0) return null;

  const sourceItems = (
    <>
      <SourceItem
        icon={User}
        label="Guia de Identidade"
        active={sources.identity_guide}
      />
      <SourceItem
        icon={FileText}
        label="Biblioteca"
        detail={sources.library_items_count ? `${sources.library_items_count} itens` : undefined}
        active={(sources.library_items_count || 0) > 0}
      />
      <SourceItem
        icon={TrendingUp}
        label="Top performers"
        detail={sources.top_performers_count ? `${sources.top_performers_count} posts` : undefined}
        active={(sources.top_performers_count || 0) > 0}
      />
      <SourceItem
        icon={BookOpen}
        label="Regras de formato"
        detail={sources.format_rules}
        active={!!sources.format_rules}
      />
      <SourceItem
        icon={Sparkles}
        label="Voice Profile"
        active={sources.voice_profile}
      />
      <SourceItem
        icon={Star}
        label="Knowledge Base"
        active={sources.global_knowledge}
      />
    </>
  );

  if (variant === "collapsible") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5",
              className
            )}
          >
            <BookOpen className="h-3 w-3" />
            <span>{activeSourcesCount} fontes usadas</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1.5"
          >
            {sourceItems}
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Inline variant
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-medium">Fontes:</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {sourceItems}
      </div>
    </motion.div>
  );
}

/**
 * Compact inline indicator for validation status
 */
interface ValidationBadgeProps {
  passed: boolean;
  repaired: boolean;
  reviewed: boolean;
  className?: string;
}

export function ValidationBadge({ 
  passed, 
  repaired, 
  reviewed,
  className 
}: ValidationBadgeProps) {
  if (!passed && !repaired && !reviewed) return null;

  const getLabel = () => {
    if (repaired) return "Ajustado automaticamente";
    if (reviewed) return "Revisado";
    if (passed) return "Validado";
    return null;
  };

  const label = getLabel();
  if (!label) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        repaired ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400",
        className
      )}
    >
      {repaired ? (
        <span className="flex items-center gap-1">
          <span className="text-[10px]">🔧</span>
          {label}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <span className="text-[10px]">✓</span>
          {label}
        </span>
      )}
    </motion.div>
  );
}
