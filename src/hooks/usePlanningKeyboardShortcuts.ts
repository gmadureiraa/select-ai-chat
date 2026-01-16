import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface UsePlanningKeyboardShortcutsProps {
  onNewItem?: () => void;
  onCloseDialog?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  isDialogOpen?: boolean;
}

export function usePlanningKeyboardShortcuts({
  onNewItem,
  onCloseDialog,
  onSave,
  onSearch,
  isDialogOpen = false,
}: UsePlanningKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    // Escape - close dialog
    if (e.key === 'Escape' && isDialogOpen && onCloseDialog) {
      e.preventDefault();
      onCloseDialog();
      return;
    }

    // Ctrl/Cmd + N - new item (when not typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isTyping) {
      e.preventDefault();
      onNewItem?.();
      return;
    }

    // Ctrl/Cmd + S - save (when dialog is open)
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && isDialogOpen && onSave) {
      e.preventDefault();
      onSave();
      return;
    }

    // Ctrl/Cmd + F or / - focus search (when not typing)
    if (((e.metaKey || e.ctrlKey) && e.key === 'f') || (e.key === '/' && !isTyping)) {
      if (onSearch) {
        e.preventDefault();
        onSearch();
      }
      return;
    }
  }, [onNewItem, onCloseDialog, onSave, onSearch, isDialogOpen]);

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
