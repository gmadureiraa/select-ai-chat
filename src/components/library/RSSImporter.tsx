import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Rss, 
  Search, 
  Calendar, 
  ExternalLink,
  FileText,
  CheckCircle2,
  Image as ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
  imageUrl?: string;
  allImages?: string[];
}

interface RSSImporterProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: Array<{
    title: string;
    content: string;
    content_url: string;
    thumbnail_url?: string;
  }>) => void;
}

export function RSSImporter({ open, onClose, onImport }: RSSImporterProps) {
  const { toast } = useToast();
  const [rssUrl, setRssUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedTitle, setFeedTitle] = useState("");
  const [items, setItems] = useState<RSSItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const handleFetchFeed = async () => {
    if (!rssUrl.trim()) {
      toast({ title: "Digite a URL do RSS feed", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setItems([]);
    setSelectedItems(new Set());
    setFeedTitle("");

    try {
      const { data, error } = await supabase.functions.invoke("fetch-rss-feed", {
        body: { rssUrl: rssUrl.trim(), limit: 50 }
      });

      if (error) throw error;

      if (data?.items?.length > 0) {
        setFeedTitle(data.feedTitle || "RSS Feed");
        setItems(data.items);
        toast({ 
          title: "Feed carregado!", 
          description: `${data.items.length} itens encontrados` 
        });
      } else {
        toast({ 
          title: "Nenhum item encontrado", 
          description: "Verifique se a URL do RSS está correta",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("Error fetching RSS:", error);
      toast({ 
        title: "Erro ao carregar feed", 
        description: error instanceof Error ? error.message : "Verifique a URL do RSS",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (guid: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(guid)) {
        next.delete(guid);
      } else {
        next.add(guid);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.guid)));
    }
  };

  const handleImport = () => {
    const itemsToImport = items
      .filter(item => selectedItems.has(item.guid))
      .map(item => ({
        title: item.title,
        content: item.content || item.description,
        content_url: item.link,
        thumbnail_url: item.imageUrl
      }));

    onImport(itemsToImport);
    toast({ 
      title: "Importação iniciada!", 
      description: `${itemsToImport.length} item(s) selecionado(s)` 
    });
    handleClose();
  };

  const handleClose = () => {
    setRssUrl("");
    setItems([]);
    setSelectedItems(new Set());
    setFeedTitle("");
    setSearchQuery("");
    onClose();
  };

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd MMM yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5 text-orange-500" />
            Importar do RSS Feed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* URL Input */}
          <div className="space-y-2">
            <Label>URL do Feed RSS</Label>
            <div className="flex gap-2">
              <Input
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
                placeholder="https://sua-newsletter.com/feed ou /rss"
                onKeyDown={(e) => e.key === 'Enter' && handleFetchFeed()}
                disabled={isLoading}
              />
              <Button onClick={handleFetchFeed} disabled={isLoading || !rssUrl.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buscar"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: https://newsletter.beehiiv.com/feed ou https://substack.com/feed
            </p>
          </div>

          {/* Feed Title & Search */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{feedTitle}</h3>
                  <p className="text-sm text-muted-foreground">
                    {items.length} itens • {selectedItems.size} selecionados
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedItems.size === filteredItems.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar itens..."
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Items List */}
          {items.length > 0 && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.guid}
                    onClick={() => toggleItem(item.guid)}
                    className={`
                      flex gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedItems.has(item.guid) 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <div className="flex items-start pt-0.5">
                      <Checkbox 
                        checked={selectedItems.has(item.guid)}
                        onCheckedChange={() => toggleItem(item.guid)}
                      />
                    </div>
                    
                    {/* Thumbnail */}
                    {item.imageUrl ? (
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                        <img 
                          src={item.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm line-clamp-2">
                          {item.title}
                        </h4>
                        {selectedItems.has(item.guid) && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {item.pubDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(item.pubDate)}
                          </span>
                        )}
                        {item.content && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            {item.content.length.toLocaleString()} chars
                          </Badge>
                        )}
                        {item.allImages && item.allImages.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {item.allImages.length} {item.allImages.length === 1 ? 'imagem' : 'imagens'}
                          </span>
                        )}
                      </div>
                      
                      {/* Preview of all images */}
                      {item.allImages && item.allImages.length > 1 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {item.allImages.slice(0, 5).map((img, idx) => (
                            <div 
                              key={idx} 
                              className="w-8 h-8 rounded overflow-hidden bg-muted border border-border"
                            >
                              <img 
                                src={img} 
                                alt="" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.parentElement!.style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                          {item.allImages.length > 5 && (
                            <div className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-[10px] text-muted-foreground">
                              +{item.allImages.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* External Link */}
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Empty State */}
          {!isLoading && items.length === 0 && rssUrl && (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground py-12">
              <div className="space-y-2">
                <Rss className="h-12 w-12 mx-auto opacity-20" />
                <p>Cole a URL do RSS e clique em "Buscar"</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={selectedItems.size === 0}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Importar {selectedItems.size > 0 && `(${selectedItems.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
