import { useState, useEffect, useMemo, useCallback } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, BookOpen, ScrollText, Video, Image, Mic, Mail, Sparkles, PenTool, MessageSquare, Send, Wand2, Newspaper, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id: string;
  title: string;
  type: "content_library" | "reference_library" | "format" | "assignee" | "client" | "performance";
  category: string;
  preview: string;
  avatar_url?: string;
  thumbnail_url?: string;
  engagement_rate?: number;
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
  performancePosts?: Array<{
    id: string;
    caption: string | null;
    post_type: string | null;
    engagement_rate: number | null;
    likes: number | null;
    thumbnail_url: string | null;
    posted_at: string | null;
  }>;
  assignees?: Array<{
    id: string;
    name: string;
    email?: string;
    avatar_url?: string;
  }>;
  clients?: Array<{
    id: string;
    name: string;
    avatar_url?: string;
  }>;
  anchorRef: React.RefObject<HTMLElement>;
  searchQuery?: string;
  showFormats?: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  // Social - Twitter/X
  tweet: MessageSquare,
  thread: ScrollText,
  x_article: Newspaper,
  // Social - LinkedIn
  linkedin_post: FileText,
  // Social - Instagram
  carousel: Image,
  stories: Sparkles,
  instagram_post: Send,
  static_image: Image,
  // Video
  short_video: Video,
  long_video: PenTool,
  reel_script: Video,
  video_script: Video,
  // Long-form
  newsletter: Mail,
  blog_post: BookOpen,
  article: BookOpen,
  // References
  podcast: Mic,
  reference: BookOpen,
  format: Wand2,
};

const categoryColors: Record<string, string> = {
  // Social - Twitter/X
  tweet: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  thread: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  x_article: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  // Social - LinkedIn
  linkedin_post: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  // Social - Instagram
  carousel: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  stories: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  instagram_post: "bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-pink-600 border-pink-500/20",
  static_image: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  // Video
  short_video: "bg-red-500/10 text-red-600 border-red-500/20",
  long_video: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  reel_script: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  video_script: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  // Long-form
  newsletter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  blog_post: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  article: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  // References
  podcast: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  reference: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  format: "bg-primary/10 text-primary border-primary/20",
  // People and Clients
  assignee: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  client: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  // Performance
  performance: "bg-green-500/10 text-green-600 border-green-500/20",
};

// Pre-defined content formats - synchronized with FormatItem.tsx
const contentFormats: CitationItem[] = [
  // Social - Twitter/X
  { id: "format_tweet", title: "Tweet", type: "format", category: "tweet", preview: "Post curto para Twitter/X (280 caracteres)" },
  { id: "format_thread", title: "Thread", type: "format", category: "thread", preview: "Série de tweets conectados" },
  { id: "format_artigo_x", title: "Artigo no X", type: "format", category: "x_article", preview: "Artigo longo publicado no Twitter/X" },
  // Social - LinkedIn
  { id: "format_post_linkedin", title: "Post LinkedIn", type: "format", category: "linkedin_post", preview: "Post profissional otimizado para LinkedIn" },
  // Social - Instagram
  { id: "format_carrossel", title: "Carrossel", type: "format", category: "carousel", preview: "Slides visuais para Instagram/LinkedIn" },
  { id: "format_stories", title: "Stories", type: "format", category: "stories", preview: "Sequência de stories para Instagram" },
  { id: "format_post_instagram", title: "Post Instagram", type: "format", category: "instagram_post", preview: "Legenda para estático único com hashtags" },
  // Video
  { id: "format_reels", title: "Reels/Shorts", type: "format", category: "short_video", preview: "Roteiro para vídeo vertical curto" },
  { id: "format_video_longo", title: "Vídeo Longo", type: "format", category: "long_video", preview: "Roteiro para vídeo longo (YouTube, etc)" },
  // Long-form
  { id: "format_newsletter", title: "Newsletter", type: "format", category: "newsletter", preview: "E-mail editorial com seções e CTAs" },
  { id: "format_blog", title: "Blog Post", type: "format", category: "blog_post", preview: "Artigo longo otimizado para SEO" },
];

export const CitationPopover = ({
  open,
  onOpenChange,
  onSelect,
  contentLibrary,
  referenceLibrary,
  performancePosts = [],
  assignees = [],
  clients = [],
  anchorRef,
  searchQuery = "",
  showFormats = true,
}: CitationPopoverProps) => {
  const [internalSearch, setInternalSearch] = useState(searchQuery);

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  // Convert assignees to CitationItems
  const assigneeItems = useMemo((): CitationItem[] => {
    return assignees.map((a) => ({
      id: a.id,
      title: a.name,
      type: "assignee" as const,
      category: "assignee",
      preview: a.email || "Membro da equipe",
      avatar_url: a.avatar_url,
    }));
  }, [assignees]);

  // Convert clients to CitationItems
  const clientItems = useMemo((): CitationItem[] => {
    return clients.map((c) => ({
      id: c.id,
      title: c.name,
      type: "client" as const,
      category: "client",
      preview: "Cliente",
      avatar_url: c.avatar_url,
    }));
  }, [clients]);

  // Convert performance posts to CitationItems
  const performanceItems = useMemo((): CitationItem[] => {
    return performancePosts.map((p) => ({
      id: p.id,
      title: p.caption?.substring(0, 50) || `Post de ${p.posted_at || 'Instagram'}`,
      type: "performance" as const,
      category: p.post_type || "post",
      preview: `${p.likes || 0} likes • ${p.engagement_rate?.toFixed(1) || 0}% engajamento`,
      thumbnail_url: p.thumbnail_url || undefined,
      engagement_rate: p.engagement_rate || undefined,
    }));
  }, [performancePosts]);

  // Combinar e formatar itens
  const allItems = useMemo((): CitationItem[] => {
    const formatItems: CitationItem[] = showFormats ? contentFormats : [];

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

    return [...formatItems, ...contentItems, ...referenceItems, ...assigneeItems, ...clientItems, ...performanceItems];
  }, [contentLibrary, referenceLibrary, showFormats, assigneeItems, clientItems, performanceItems]);


  // Filtrar por busca
  const filteredFormats = useMemo(() => {
    if (!internalSearch.trim()) return showFormats ? contentFormats : [];
    const query = internalSearch.toLowerCase();
    return contentFormats.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [internalSearch, showFormats]);

  const filteredAssignees = useMemo(() => {
    if (!internalSearch.trim()) return assigneeItems.slice(0, 10);
    const query = internalSearch.toLowerCase();
    return assigneeItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.preview.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [assigneeItems, internalSearch]);

  const filteredClients = useMemo(() => {
    if (!internalSearch.trim()) return clientItems.slice(0, 10);
    const query = internalSearch.toLowerCase();
    return clientItems
      .filter((item) => item.title.toLowerCase().includes(query))
      .slice(0, 10);
  }, [clientItems, internalSearch]);

  const filteredPerformance = useMemo(() => {
    if (!internalSearch.trim()) return performanceItems.slice(0, 5);
    const query = internalSearch.toLowerCase();
    return performanceItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [performanceItems, internalSearch]);

  const filteredLibrary = useMemo(() => {
    const libraryItems = allItems.filter((item) => 
      item.type !== "format" && item.type !== "assignee" && item.type !== "client" && item.type !== "performance"
    );
    if (!internalSearch.trim()) return libraryItems.slice(0, 15);

    const query = internalSearch.toLowerCase();
    return libraryItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.preview.toLowerCase().includes(query)
      )
      .slice(0, 15);
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
            placeholder="Buscar formatos ou biblioteca..."
            value={internalSearch}
            onValueChange={setInternalSearch}
            className="border-0"
          />
          <CommandList className="max-h-[350px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum item encontrado.
            </CommandEmpty>
            
            
            {/* Formats Group */}
            {filteredFormats.length > 0 && (
              <CommandGroup heading="📝 Formatos de Conteúdo">
                {filteredFormats.map((item) => {
                  const Icon = getIcon(item.category);
                  const colorClass = getColorClass(item.category);
                  
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.title}-${item.id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center gap-3 py-2.5 cursor-pointer"
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.title}</span>
                        <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            
            {/* People Group */}
            {filteredAssignees.length > 0 && (
              <CommandGroup heading="👤 Pessoas">
                {filteredAssignees.map((item) => (
                  <CommandItem
                    key={`assignee-${item.id}`}
                    value={`${item.title}-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.avatar_url} />
                      <AvatarFallback className="bg-indigo-500/10 text-indigo-600 text-xs">
                        {item.title.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.title}</span>
                      <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                      Pessoa
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Clients Group */}
            {filteredClients.length > 0 && (
              <CommandGroup heading="🏢 Perfis">
                {filteredClients.map((item) => (
                  <CommandItem
                    key={`client-${item.id}`}
                    value={`${item.title}-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.avatar_url} />
                      <AvatarFallback className="bg-teal-500/10 text-teal-600 text-xs">
                        <Building2 className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-teal-500/10 text-teal-600 border-teal-500/20">
                      Perfil
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Performance Group */}
            {filteredPerformance.length > 0 && (
              <CommandGroup heading="📊 Performance">
                {filteredPerformance.map((item) => {
                  const colorClass = getColorClass("performance");
                  
                  return (
                    <CommandItem
                      key={`perf-${item.id}`}
                      value={`${item.title}-${item.id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex items-center gap-3 py-2.5 cursor-pointer"
                    >
                      {item.thumbnail_url ? (
                        <img 
                          src={item.thumbnail_url} 
                          alt="" 
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-green-500/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm line-clamp-1">{item.title}</span>
                        <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", colorClass)}
                      >
                        {item.category.replace(/_/g, " ")}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Library Group */}
            {filteredLibrary.length > 0 && (
              <CommandGroup heading="📚 Biblioteca">
                {filteredLibrary.map((item) => {
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
