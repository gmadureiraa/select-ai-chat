import { useRef, useState, useMemo, KeyboardEvent, ChangeEvent, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface MemberOption {
  user_id: string;
  name: string;
  email?: string | null;
}

interface MentionableTextareaProps {
  value: string;
  onChange: (value: string, mentionedIds: string[]) => void;
  members: MemberOption[];
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  disabled?: boolean;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function makeHandle(name: string) {
  // first name lowercase no diacritics
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
}

/**
 * Extract mentioned user_ids from a text by matching @handle tokens against
 * the members list. Multiple members sharing a handle are all included.
 */
export function extractMentionedIds(text: string, members: MemberOption[]): string[] {
  const ids = new Set<string>();
  const handles = new Map<string, string[]>(); // handle -> [user_ids]
  members.forEach((m) => {
    const h = makeHandle(m.name);
    if (!h) return;
    const arr = handles.get(h) || [];
    arr.push(m.user_id);
    handles.set(h, arr);
  });
  const re = /@([\p{L}0-9_.-]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const h = match[1].toLowerCase();
    const matched = handles.get(h);
    if (matched) matched.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

export const MentionableTextarea = forwardRef<HTMLTextAreaElement, MentionableTextareaProps>(function MentionableTextarea(
  { value, onChange, members, placeholder, rows = 3, className, autoFocus, onSubmit, disabled },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return members
      .filter((m) => {
        if (!q) return true;
        return m.name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [members, query]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const cursor = e.target.selectionStart || 0;
    const before = next.slice(0, cursor);
    const lastAt = before.lastIndexOf("@");
    if (lastAt >= 0) {
      const fragment = before.slice(lastAt + 1);
      const isWordy = /^[\p{L}0-9_.-]*$/u.test(fragment);
      const prevChar = lastAt === 0 ? " " : before[lastAt - 1];
      const isBoundary = /\s|^$/.test(prevChar) || lastAt === 0;
      if (isWordy && isBoundary && fragment.length <= 24) {
        setMentionStart(lastAt);
        setQuery(fragment);
        setOpen(true);
        setHighlight(0);
        onChange(next, extractMentionedIds(next, members));
        return;
      }
    }
    setOpen(false);
    setMentionStart(null);
    onChange(next, extractMentionedIds(next, members));
  };

  const insertMention = (m: MemberOption) => {
    if (mentionStart === null || !innerRef.current) return;
    const cursor = innerRef.current.selectionStart || value.length;
    const handle = makeHandle(m.name);
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const inserted = `@${handle} `;
    const next = before + inserted + after;
    onChange(next, extractMentionedIds(next, members));
    setOpen(false);
    setMentionStart(null);
    setQuery("");
    setTimeout(() => {
      const pos = (before + inserted).length;
      innerRef.current?.focus();
      innerRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Textarea
          ref={innerRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={rows}
          className={cn("text-sm resize-none", className)}
          autoFocus={autoFocus}
          disabled={disabled}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-64 p-1"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-56">
          {suggestions.map((m, i) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => insertMention(m)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
                  {getInitials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-[10px] text-muted-foreground">@{makeHandle(m.name)}</div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
