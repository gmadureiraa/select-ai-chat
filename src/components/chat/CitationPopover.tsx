import { useCallback, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileText, BookOpen } from "lucide-react";

export interface CitationItem {
  id: string;
  title: string;
  type: "content" | "reference" | "format";
  content?: string;
}

interface CitationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CitationItem) => void;
  contentLibrary?: Array<{ id: string; title: string; content_type: string; content: string }>;
  referenceLibrary?: Array<{ id: string; title: string; reference_type: string; content: string }>;
  searchQuery?: string;
  children?: React.ReactNode;
}

export const CitationPopover = ({
  open,
  onOpenChange,
  onSelect,
  contentLibrary = [],
  referenceLibrary = [],
  searchQuery = "",
  children,
}: CitationPopoverProps) => {
  const items = useMemo(() => {
    const all: CitationItem[] = [
      ...contentLibrary.map((c) => ({
        id: c.id,
        title: c.title,
        type: "content" as const,
        content: c.content,
      })),
      ...referenceLibrary.map((r) => ({
        id: r.id,
        title: r.title,
        type: "reference" as const,
        content: r.content,
      })),
    ];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((item) => item.title.toLowerCase().includes(q));
  }, [contentLibrary, referenceLibrary, searchQuery]);

  const handleSelect = useCallback(
    (item: CitationItem) => {
      onSelect(item);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children && <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent className="w-72 p-0" align="start" side="top">
        <Command>
          <CommandInput placeholder="Buscar conteúdo..." value={searchQuery} />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado</CommandEmpty>
            {contentLibrary.length > 0 && (
              <CommandGroup heading="Biblioteca de Conteúdo">
                {items
                  .filter((i) => i.type === "content")
                  .map((item) => (
                    <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
                      <FileText className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
            {referenceLibrary.length > 0 && (
              <CommandGroup heading="Referências">
                {items
                  .filter((i) => i.type === "reference")
                  .map((item) => (
                    <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
                      <BookOpen className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{item.title}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
