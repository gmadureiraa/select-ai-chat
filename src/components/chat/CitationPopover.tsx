import { useState, useEffect, useMemo, useCallback } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, ScrollText, Video, Image, Mic, Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id: string;
  title: string;
  type: "content_library" | "reference_library";
  category: string;
  preview: string;
}

interface CitationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CitationItem) => void;
  contentLibrary: Array<{
    id: string;
    title: string;
    content_type: string;
    content: string;
  }>;
  referenceLibrary: Array<{
    id: string;
    title: string;
    reference_type: string;
    content: string;
  }>;
  anchorRef: React.RefObject<HTMLElement>;
  searchQuery?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  newsletter: Mail,
  blog_post: FileText,
  linkedin_post: FileText,
  thread: ScrollText,
  carousel: Image,
  stories: Sparkles,
  short_video: Video,
  reel_script: Video,
  video_script: Video,
  tweet: FileText,
  article: BookOpen,
  podcast: Mic,
  reference: BookOpen,
};

const categoryColors: Record<string, string> = {
  newsletter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  blog_post: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  linkedin_post: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  thread: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  carousel: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  stories: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  short_video: "bg-red-500/10 text-red-600 border-red-500/20",
  reel_script: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  video_script: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  tweet: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  article: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  podcast: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  reference: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export const CitationPopover = ({
  open,
  onOpenChange,
  onSelect,
  contentLibrary,
  referenceLibrary,
  anchorRef,
  searchQuery = "",
}: CitationPopoverProps) => {
  const [internalSearch, setInternalSearch] = useState(searchQuery);

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  // Combinar e formatar itens
  const allItems = useMemo((): CitationItem[] => {
    const contentItems: CitationItem[] = contentLibrary.map((c) => ({
      id: c.id,
      title: c.title,
      type: "content_library" as const,
      category: c.content_type,
      preview: c.content.substring(0, 100) + (c.content.length > 100 ? "..." : ""),
    }));

    const referenceItems: CitationItem[] = referenceLibrary.map((r) => ({
      id: r.id,
      title: r.title,
      type: "reference_library" as const,
      category: r.reference_type,
      preview: r.content.substring(0, 100) + (r.content.length > 100 ? "..." : ""),
    }));

    return [...contentItems, ...referenceItems];
  }, [contentLibrary, referenceLibrary]);

  // Filtrar por busca
  const filteredItems = useMemo(() => {
    if (!internalSearch.trim()) return allItems.slice(0, 20);

    const query = internalSearch.toLowerCase();
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.preview.toLowerCase().includes(query)
      )
      .slice(0, 20);
  }, [allItems, internalSearch]);

  const handleSelect = useCallback(
    (item: CitationItem) => {
      onSelect(item);
      onOpenChange(false);
      setInternalSearch("");
    },
    [onSelect, onOpenChange]
  );

  const getIcon = (category: string) => {
    const Icon = categoryIcons[category] || FileText;
    return Icon;
  };

  const getColorClass = (category: string) => {
    return categoryColors[category] || "bg-muted text-muted-foreground";
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span ref={anchorRef as any} className="absolute" style={{ visibility: "hidden" }} />
      </PopoverAnchor>
      <PopoverContent
        className="w-[400px] p-0 shadow-lg"
        align="start"
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="rounded-lg border-0">
          <CommandInput
            placeholder="Buscar na biblioteca..."
            value={internalSearch}
            onValueChange={setInternalSearch}
            className="border-0"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum conteúdo encontrado.
            </CommandEmpty>
            
            {filteredItems.length > 0 && (
              <CommandGroup heading="Biblioteca">
                {filteredItems.map((item) => {
                  const Icon = getIcon(item.category);
                  const colorClass = getColorClass(item.category);
                  
                  return (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.title}-${item.id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1">{item.title}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", colorClass)}
                        >
                          {item.category.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 pl-6">
                        {item.preview}
                      </p>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
