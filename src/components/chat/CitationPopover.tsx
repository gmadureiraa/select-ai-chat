import { useState, useMemo, RefObject } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { FileText, BookOpen, Wand2, Lightbulb, BarChart3, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id: string;
  title: string;
  type: "content_library" | "reference_library" | "format" | "assignee" | "client" | "performance";
  category: string;
}

interface CitationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CitationItem) => void;
  contentLibrary?: Array<{ id: string; title: string; content_type: string; content: string }>;
  referenceLibrary?: Array<{ id: string; title: string; reference_type: string; content: string }>;
  anchorRef: RefObject<HTMLElement>;
  searchQuery?: string;
}

// Built-in format options
const FORMAT_OPTIONS: CitationItem[] = [
  { id: "format_ideias", title: "Ideias", type: "format", category: "ideias" },
  { id: "format_carousel", title: "Carrossel", type: "format", category: "instagram" },
  { id: "format_stories", title: "Stories", type: "format", category: "instagram" },
  { id: "format_reels", title: "Reels", type: "format", category: "instagram" },
  { id: "format_post", title: "Post Estático", type: "format", category: "instagram" },
  { id: "format_thread", title: "Thread", type: "format", category: "twitter" },
  { id: "format_tweet", title: "Tweet", type: "format", category: "twitter" },
  { id: "format_linkedin", title: "LinkedIn", type: "format", category: "linkedin" },
  { id: "format_newsletter", title: "Newsletter", type: "format", category: "email" },
];

const getItemIcon = (type: CitationItem["type"], category?: string) => {
  if (category === "ideias") return Lightbulb;
  if (type === "format") return Wand2;
  if (type === "reference_library") return BookOpen;
  if (type === "performance") return BarChart3;
  if (type === "assignee") return User;
  if (type === "client") return Building2;
  return FileText;
};

const getItemColorClass = (type: CitationItem["type"], category?: string) => {
  if (category === "ideias") return "text-amber-600";
  if (type === "format") return "text-primary";
  if (type === "reference_library") return "text-slate-600";
  if (type === "performance") return "text-green-600";
  if (type === "assignee") return "text-violet-600";
  if (type === "client") return "text-blue-600";
  return "text-blue-500";
};

export function CitationPopover({
  open,
  onOpenChange,
  onSelect,
  contentLibrary = [],
  referenceLibrary = [],
  anchorRef,
  searchQuery = "",
}: CitationPopoverProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const effectiveSearch = searchQuery || internalSearch;

  // Transform library items to CitationItems
  const allItems = useMemo(() => {
    const items: CitationItem[] = [];

    // Add format options first
    items.push(...FORMAT_OPTIONS);

    // Add content library items
    contentLibrary.forEach((item) => {
      items.push({
        id: item.id,
        title: item.title,
        type: "content_library",
        category: item.content_type,
      });
    });

    // Add reference library items
    referenceLibrary.forEach((item) => {
      items.push({
        id: item.id,
        title: item.title,
        type: "reference_library",
        category: item.reference_type,
      });
    });

    return items;
  }, [contentLibrary, referenceLibrary]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!effectiveSearch) return allItems;
    const lower = effectiveSearch.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
    );
  }, [allItems, effectiveSearch]);

  // Group filtered items
  const groupedItems = useMemo(() => {
    const groups: Record<string, CitationItem[]> = {};
    filteredItems.forEach((item) => {
      const groupKey = item.type === "format" ? "Formatos" : 
                       item.type === "content_library" ? "Biblioteca" :
                       item.type === "reference_library" ? "Referências" :
                       "Outros";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span ref={anchorRef as RefObject<HTMLSpanElement>} />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-0 border-border/50 bg-popover/95 backdrop-blur-xl"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Buscar..."
            value={internalSearch}
            onValueChange={setInternalSearch}
            className="h-9 text-sm"
          />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              Nenhum resultado encontrado
            </CommandEmpty>
            {Object.entries(groupedItems).map(([group, items]) => (
              <CommandGroup key={group} heading={group} className="px-1">
                {items.slice(0, 10).map((item) => {
                  const Icon = getItemIcon(item.type, item.category);
                  const colorClass = getItemColorClass(item.type, item.category);
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.category}`}
                      onSelect={() => {
                        onSelect(item);
                        onOpenChange(false);
                      }}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      <Icon className={cn("h-3.5 w-3.5", colorClass)} />
                      <span className="truncate text-sm">{item.title}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
