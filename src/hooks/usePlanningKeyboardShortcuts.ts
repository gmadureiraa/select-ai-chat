import { useEffect, useCallback } from 'react';

/**
 * Hook de atalhos de teclado do Planejamento.
 *
 * Atalhos suportados (todos no escopo global do board, exceto quando o
 * usuário está digitando em input/textarea):
 *
 *   n         → novo card
 *   /         → focar busca
 *   ⌘/Ctrl+F  → focar busca
 *   ⌘/Ctrl+N  → novo card
 *   j         → navegar pro próximo card (vim-style)
 *   k         → navegar pro card anterior
 *   Enter     → abrir card focado
 *   e         → editar card focado (alias do Enter, semântico)
 *   ?         → abrir modal de ajuda dos atalhos
 *   Esc       → fechar dialog (quando aberto)
 *   ⌘/Ctrl+S  → salvar (quando dialog aberto)
 */
interface UsePlanningKeyboardShortcutsProps {
  onNewItem?: () => void;
  onCloseDialog?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  onOpenFocused?: () => void;
  onShowHelp?: () => void;
  isDialogOpen?: boolean;
}

export function usePlanningKeyboardShortcuts({
  onNewItem,
  onCloseDialog,
  onSave,
  onSearch,
  onNavigate,
  onOpenFocused,
  onShowHelp,
  isDialogOpen = false,
}: UsePlanningKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Não dispara atalhos enquanto o usuário digita
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

    // Esc — fecha dialog
    if (e.key === 'Escape' && isDialogOpen && onCloseDialog) {
      e.preventDefault();
      onCloseDialog();
      return;
    }

    // ⌘/Ctrl+S — salvar
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && isDialogOpen && onSave) {
      e.preventDefault();
      onSave();
      return;
    }

    // ⌘/Ctrl+N — novo
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isTyping) {
      e.preventDefault();
      onNewItem?.();
      return;
    }

    // ⌘/Ctrl+F ou / — busca
    if (((e.metaKey || e.ctrlKey) && e.key === 'f') || (e.key === '/' && !isTyping)) {
      if (onSearch) {
        e.preventDefault();
        onSearch();
      }
      return;
    }

    // Atalhos sem modificador — só funcionam fora de inputs
    if (isTyping || isDialogOpen) return;

    // n — novo (sem modificador)
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNewItem?.();
      return;
    }

    // j/k — navegar entre cards
    if (e.key === 'j' && onNavigate) {
      e.preventDefault();
      onNavigate('next');
      return;
    }
    if (e.key === 'k' && onNavigate) {
      e.preventDefault();
      onNavigate('prev');
      return;
    }

    // Enter ou e — abrir card focado
    if ((e.key === 'Enter' || e.key === 'e') && onOpenFocused) {
      e.preventDefault();
      onOpenFocused();
      return;
    }

    // ? (Shift+/) — ajuda
    if (e.key === '?' && onShowHelp) {
      e.preventDefault();
      onShowHelp();
      return;
    }
  }, [onNewItem, onCloseDialog, onSave, onSearch, onNavigate, onOpenFocused, onShowHelp, isDialogOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Helper to show keyboard shortcut hints
export function getShortcutHint(key: string, isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')) {
  const modKey = isMac ? '⌘' : 'Ctrl';
  return `${modKey}+${key.toUpperCase()}`;
}

/** Lista canônica usada no modal "?". */
export const PLANNING_SHORTCUTS: Array<{ keys: string[]; label: string; group: string }> = [
  { keys: ['n'], label: 'Novo card', group: 'Geral' },
  { keys: ['/'], label: 'Focar busca', group: 'Geral' },
  { keys: ['?'], label: 'Mostrar atalhos', group: 'Geral' },
  { keys: ['j'], label: 'Próximo card', group: 'Navegação' },
  { keys: ['k'], label: 'Card anterior', group: 'Navegação' },
  { keys: ['Enter'], label: 'Abrir card focado', group: 'Navegação' },
  { keys: ['e'], label: 'Editar card focado', group: 'Navegação' },
  { keys: ['Esc'], label: 'Fechar dialog', group: 'Diálogo' },
  { keys: ['⌘', 'S'], label: 'Salvar', group: 'Diálogo' },
];
