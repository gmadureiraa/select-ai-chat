import { useState } from "react";
import { FileText, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useContentLibrary, ContentItem } from "@/hooks/useContentLibrary";
import { cn } from "@/lib/utils";

interface NewsletterPickerProps {
  clientId: string;
  onSelect: (content: ContentItem) => void;
  trigger?: React.ReactNode;
}

export function NewsletterPicker({ clientId, onSelect, trigger }: NewsletterPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { contents } = useContentLibrary(clientId);

  // Filter only newsletters
  const newsletters = contents?.filter(c => c.content_type === "newsletter") || [];

  // Apply search
  const filtered = newsletters.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (newsletter: ContentItem) => {
    onSelect(newsletter);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Puxar Newsletter</span>
            <span className="sm:hidden">Newsletter</span>
            {newsletters.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {newsletters.length}
              </Badge>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar newsletter..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma newsletter encontrada</p>
                {newsletters.length === 0 && (
                  <p className="text-xs mt-1">Adicione newsletters à biblioteca</p>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup heading={`Newsletters (${filtered.length})`}>
              {filtered.map((newsletter) => (
                <CommandItem
                  key={newsletter.id}
                  value={newsletter.id}
                  onSelect={() => handleSelect(newsletter)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-3 w-full py-1">
                    <div className="shrink-0 mt-0.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{newsletter.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {newsletter.content.substring(0, 120)}...
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {(newsletter.content.length / 1000).toFixed(1)}k
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(newsletter.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
