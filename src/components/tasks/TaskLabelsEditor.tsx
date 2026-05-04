import { useState, KeyboardEvent } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskLabel } from "@/hooks/useTeamTasks";
import { cn } from "@/lib/utils";

interface TaskLabelsEditorProps {
  value: TaskLabel[];
  onChange: (next: TaskLabel[]) => void;
  readOnly?: boolean;
}

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6",
  "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

export function TaskLabelsEditor({ value, onChange, readOnly }: TaskLabelsEditorProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[7]);
  const [open, setOpen] = useState(false);

  const add = () => {
    const v = name.trim();
    if (!v) return;
    if (value.some((l) => l.name.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, { name: v, color }]);
    setName("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {value.map((l, i) => (
        <span
          key={i}
          className="text-[11px] inline-flex items-center gap-1 px-1.5 h-5 rounded border"
          style={{ background: `${l.color}1f`, color: l.color, borderColor: `${l.color}55` }}
        >
          {l.name}
          {!readOnly && (
            <button onClick={() => remove(i)} className="hover:opacity-70" aria-label="Remover">
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-5 px-1.5 text-[11px] gap-1">
              <Tag className="h-3 w-3" />
              Etiqueta
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onKey}
                placeholder="Nome da etiqueta"
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex flex-wrap gap-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full border",
                      color === c ? "ring-2 ring-offset-1 ring-offset-background ring-foreground" : "",
                    )}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full gap-1" onClick={add} disabled={!name.trim()}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
