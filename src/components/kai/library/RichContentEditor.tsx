import { useState, useRef, useCallback } from "react";
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Image, Link, Eye, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RichContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  clientId?: string;
}

export function RichContentEditor({ 
  value, 
  onChange, 
  placeholder = "Escreva seu conteúdo...",
  minHeight = "300px",
  clientId
}: RichContentEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insert markdown at cursor position
  const insertMarkdown = useCallback((before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = 
      value.substring(0, start) + 
      before + 
      (selectedText || "texto") + 
      after + 
      value.substring(end);
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + (selectedText || "texto").length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }, [value, onChange]);

  // Handle image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${clientId || 'content'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client-files')
        .getPublicUrl(filePath);

      // Insert image markdown at cursor
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const imageMarkdown = `\n![${file.name}](${data.publicUrl})\n`;
        const newText = value.substring(0, start) + imageMarkdown + value.substring(start);
        onChange(newText);
      }

      toast.success('Imagem inserida!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [value, onChange, clientId]);

  const toolbarActions = [
    { icon: Bold, action: () => insertMarkdown('**', '**'), label: 'Negrito' },
    { icon: Italic, action: () => insertMarkdown('_', '_'), label: 'Itálico' },
    { icon: Heading1, action: () => insertMarkdown('# ', ''), label: 'Título 1' },
    { icon: Heading2, action: () => insertMarkdown('## ', ''), label: 'Título 2' },
    { icon: List, action: () => insertMarkdown('- ', ''), label: 'Lista' },
    { icon: ListOrdered, action: () => insertMarkdown('1. ', ''), label: 'Lista numerada' },
    { icon: Quote, action: () => insertMarkdown('> ', ''), label: 'Citação' },
    { icon: Link, action: () => insertMarkdown('[', '](url)'), label: 'Link' },
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "write" | "preview")}>
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/30">
          {/* Toolbar */}
          <div className="flex items-center gap-1">
            {toolbarActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={action.action}
                title={action.label}
                disabled={activeTab === 'preview'}
              >
                <action.icon className="h-4 w-4" />
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => fileInputRef.current?.click()}
              title="Inserir imagem"
              disabled={activeTab === 'preview'}
            >
              <Image className="h-4 w-4" />
            </Button>
          </div>

          {/* View toggle */}
          <TabsList className="h-7">
            <TabsTrigger value="write" className="h-6 px-2 text-xs gap-1">
              <Edit className="h-3 w-3" />
              Escrever
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-6 px-2 text-xs gap-1">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="write" className="m-0">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "border-0 rounded-none focus-visible:ring-0 font-mono text-sm resize-none",
            )}
            style={{ minHeight }}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div 
            className={cn(
              "p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none",
              "prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2",
              "prose-p:my-2 prose-ul:my-2 prose-ol:my-2",
              "prose-img:rounded-lg prose-img:my-3 prose-img:max-w-full",
              "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-3"
            )}
            style={{ minHeight }}
          >
            {value ? (
              <ReactMarkdown
                components={{
                  img: ({ src, alt }) => (
                    <img 
                      src={src} 
                      alt={alt || ''} 
                      className="rounded-lg max-w-full h-auto"
                      loading="lazy"
                    />
                  ),
                }}
              >
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">{placeholder}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
