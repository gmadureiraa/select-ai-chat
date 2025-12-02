import { useState } from "react";
import { 
  Download, 
  Image as ImageIcon, 
  FileJson, 
  FileText,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ResearchItem, ResearchConnection } from "@/hooks/useResearchItems";
import { toPng, toSvg } from "html-to-image";

interface ExportPanelProps {
  items: ResearchItem[];
  connections: ResearchConnection[];
  projectName: string;
  canvasRef?: React.RefObject<HTMLDivElement>;
}

export const ExportPanel = ({ 
  items, 
  connections, 
  projectName,
  canvasRef 
}: ExportPanelProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportAsJSON = () => {
    const data = {
      projectName,
      exportedAt: new Date().toISOString(),
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        source_url: item.source_url,
        metadata: item.metadata,
        position: { x: item.position_x, y: item.position_y },
      })),
      connections: connections.map(conn => ({
        id: conn.id,
        source: conn.source_id,
        target: conn.target_id,
        label: conn.label,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Exportado como JSON", description: "Arquivo salvo com sucesso." });
  };

  const exportAsMarkdown = () => {
    let markdown = `# ${projectName}\n\n`;
    markdown += `Exportado em: ${new Date().toLocaleString("pt-BR")}\n\n`;
    markdown += `---\n\n`;

    const typeLabels: Record<string, string> = {
      ai_chat: "Chat IA",
      comparison: "Comparação",
      note: "Nota",
      text: "Texto",
      youtube: "YouTube",
      link: "Link",
      pdf: "PDF",
      embed: "Embed",
      spreadsheet: "Planilha",
      audio: "Áudio",
      image: "Imagem",
      content_library: "Biblioteca de Conteúdo",
      reference_library: "Biblioteca de Referências",
    };

    // Group items by type
    const groupedItems = items.reduce((acc, item) => {
      const type = item.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {} as Record<string, ResearchItem[]>);

    Object.entries(groupedItems).forEach(([type, typeItems]) => {
      markdown += `## ${typeLabels[type] || type}\n\n`;
      
      typeItems.forEach(item => {
        markdown += `### ${item.title || "Sem título"}\n\n`;
        
        if (item.source_url) {
          markdown += `**Fonte:** ${item.source_url}\n\n`;
        }
        
        if (item.content) {
          markdown += `${item.content}\n\n`;
        }
        
        markdown += `---\n\n`;
      });
    });

    // Add connections info
    if (connections.length > 0) {
      markdown += `## Conexões\n\n`;
      connections.forEach(conn => {
        const source = items.find(i => i.id === conn.source_id);
        const target = items.find(i => i.id === conn.target_id);
        markdown += `- ${source?.title || "?"} → ${target?.title || "?"}\n`;
      });
    }

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}-export.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Exportado como Markdown", description: "Arquivo salvo com sucesso." });
  };

  const exportAsImage = async (format: "png" | "svg") => {
    if (!canvasRef?.current) {
      toast({ 
        title: "Erro ao exportar", 
        description: "Canvas não encontrado.", 
        variant: "destructive" 
      });
      return;
    }

    setIsExporting(true);
    try {
      const reactFlowElement = canvasRef.current.querySelector(".react-flow") as HTMLElement;
      if (!reactFlowElement) throw new Error("React Flow element not found");

      const dataUrl = format === "png" 
        ? await toPng(reactFlowElement, { 
            backgroundColor: "#1a1a1a",
            pixelRatio: 2,
          })
        : await toSvg(reactFlowElement, {
            backgroundColor: "#1a1a1a",
          });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}-canvas.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({ 
        title: `Exportado como ${format.toUpperCase()}`, 
        description: "Imagem salva com sucesso." 
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({ 
        title: "Erro ao exportar", 
        description: "Não foi possível gerar a imagem.", 
        variant: "destructive" 
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async () => {
    const summary = items.map(item => 
      `- [${item.type}] ${item.title || "Sem título"}: ${item.content?.substring(0, 100) || ""}...`
    ).join("\n");

    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência." });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 gap-2 bg-card/95 backdrop-blur-sm"
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportAsImage("png")}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Exportar como PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsImage("svg")}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Exportar como SVG
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportAsJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          Exportar como JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsMarkdown}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar como Markdown
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard}>
          {copied ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copiar Resumo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
