import { useEffect, useCallback } from "react";
import { ToolType } from "../CanvasToolbar";

interface UseCanvasShortcutsProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  disabled?: boolean;
}

export function useCanvasShortcuts({
  activeTool,
  setActiveTool,
  onUndo,
  onRedo,
  onDelete,
  onSave,
  onCopy,
  onPaste,
  disabled = false,
}: UseCanvasShortcutsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            e.preventDefault();
            setActiveTool("cursor");
            break;
          case "t":
            e.preventDefault();
            setActiveTool("text");
            break;
          case "s":
            e.preventDefault();
            setActiveTool("sticky");
            break;
          case "r":
            e.preventDefault();
            setActiveTool("shape");
            break;
          case "p":
            e.preventDefault();
            setActiveTool("pencil");
            break;
          case "e":
            e.preventDefault();
            setActiveTool("eraser");
            break;
          case "i":
            e.preventDefault();
            setActiveTool("image");
            break;
          case "escape":
            e.preventDefault();
            setActiveTool("cursor");
            break;
          case "delete":
          case "backspace":
            if (onDelete) {
              e.preventDefault();
              onDelete();
            }
            break;
        }
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            if (e.shiftKey) {
              // Redo
              if (onRedo) {
                e.preventDefault();
                onRedo();
              }
            } else {
              // Undo
              if (onUndo) {
                e.preventDefault();
                onUndo();
              }
            }
            break;
          case "y":
            // Alternative redo
            if (onRedo) {
              e.preventDefault();
              onRedo();
            }
            break;
          case "s":
            if (onSave) {
              e.preventDefault();
              onSave();
            }
            break;
          case "c":
            if (onCopy) {
              e.preventDefault();
              onCopy();
            }
            break;
          case "v":
            // Let paste handler in ContentCanvas handle this
            break;
        }
      }
    },
    [disabled, setActiveTool, onUndo, onRedo, onDelete, onSave, onCopy]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    activeTool,
  };
}
