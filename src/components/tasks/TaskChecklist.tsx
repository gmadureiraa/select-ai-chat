import { useState, KeyboardEvent } from "react";
import { Check, Plus, Trash2, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTaskChecklist } from "@/hooks/useTaskChecklist";
import { cn } from "@/lib/utils";

interface TaskChecklistProps {
  taskId: string | null;
  readOnly?: boolean;
}

export function TaskChecklist({ taskId, readOnly }: TaskChecklistProps) {
  const { items, addItem, toggleItem, updateItem, removeItem, done, total } =
    useTaskChecklist(taskId);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleAdd = () => {
    const v = draft.trim();
    if (!v) return;
    addItem.mutate(v);
    setDraft("");
  };

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditValue(content);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const v = editValue.trim();
    if (v) updateItem.mutate({ id: editingId, content: v });
    setEditingId(null);
    setEditValue("");
  };

  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Subtarefas
        </span>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
            <button
              onClick={() => toggleItem.mutate({ id: item.id, is_done: !item.is_done })}
              disabled={readOnly}
              className={cn(
                "h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                item.is_done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/40 hover:border-primary",
              )}
            >
              {item.is_done && <Check className="h-3 w-3" />}
            </button>

            {editingId === item.id ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                }}
                autoFocus
                className="h-7 text-sm"
              />
            ) : (
              <span
                onClick={() => !readOnly && startEdit(item.id, item.content)}
                className={cn(
                  "flex-1 text-sm cursor-text",
                  item.is_done && "line-through text-muted-foreground",
                )}
              >
                {item.content}
              </span>
            )}

            {!readOnly && (
              <button
                onClick={() => removeItem.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleAddKey}
            placeholder="Adicionar item…"
            className="h-7 text-sm"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
