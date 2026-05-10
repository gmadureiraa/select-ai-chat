import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PLANNING_SHORTCUTS } from '@/hooks/usePlanningKeyboardShortcuts';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de atalhos de teclado do planejamento.
 * Disparado pelo atalho `?` ou pelo botão de ajuda no header.
 */
export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  // Agrupa atalhos por categoria (Geral, Navegação, Diálogo)
  const groups = PLANNING_SHORTCUTS.reduce<Record<string, typeof PLANNING_SHORTCUTS>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Atalhos do teclado
          </DialogTitle>
          <DialogDescription>
            Acelera tua produção. Aperta <kbd className="px-1 py-0.5 text-[10px] rounded bg-muted border">?</kbd> a qualquer momento pra reabrir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                {group}
              </h4>
              <div className="space-y-1.5">
                {shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 py-0.5 text-[11px] font-medium rounded border border-border bg-muted/60 text-foreground tabular-nums shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
