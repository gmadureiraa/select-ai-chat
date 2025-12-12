import { useState } from "react";
import { 
  FileText, 
  Download, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Presentation, 
  Code, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Table
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

export type ArtifactType = "document" | "spreadsheet" | "presentation" | "code" | "table";

interface ArtifactCardProps {
  type: ArtifactType;
  title: string;
  content: string;
  language?: string; // For code artifacts
  tableData?: { headers: string[]; rows: string[][] }; // For table/spreadsheet
  slides?: { title: string; content: string }[]; // For presentations
}

const artifactConfig: Record<ArtifactType, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: "Documento", color: "text-blue-500" },
  spreadsheet: { icon: FileSpreadsheet, label: "Planilha", color: "text-green-500" },
  presentation: { icon: Presentation, label: "Apresentação", color: "text-orange-500" },
  code: { icon: Code, label: "Código", color: "text-purple-500" },
  table: { icon: Table, label: "Tabela", color: "text-cyan-500" },
};

export const ArtifactCard = ({ 
  type, 
  title, 
  content, 
  language = "typescript",
  tableData,
  slides 
}: ArtifactCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);
  const { toast } = useToast();

  const config = artifactConfig[type];
  const Icon = config.icon;

  const handleCopy = async () => {
    let textToCopy = content;
    if (type === "table" && tableData) {
      const headers = tableData.headers.join("\t");
      const rows = tableData.rows.map(row => row.join("\t")).join("\n");
      textToCopy = `${headers}\n${rows}`;
    }
    await copyToClipboard(textToCopy);
    toast({ description: "Copiado para a área de transferência!" });
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const pdf = new jsPDF();
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const maxWidth = pageWidth - margin * 2;
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, margin, margin + 10);
      
      // Content
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      
      const lines = pdf.splitTextToSize(content, maxWidth);
      let y = margin + 25;
      
      for (const line of lines) {
        if (y > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 6;
      }
      
      pdf.save(`${title.replace(/\s+/g, "_")}.pdf`);
      toast({ description: "PDF baixado com sucesso!" });
    } catch (error) {
      toast({ description: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!tableData) return;
    
    const headers = tableData.headers.join(",");
    const rows = tableData.rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, "_")}.csv`;
    link.click();
    
    toast({ description: "CSV baixado com sucesso!" });
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, "_")}.md`;
    link.click();
    
    toast({ description: "Markdown baixado com sucesso!" });
  };

  const renderPreview = () => {
    switch (type) {
      case "table":
        if (!tableData) return null;
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {tableData.headers.map((h, i) => (
                    <th key={i} className="text-left p-2 font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.slice(0, isExpanded ? undefined : 5).map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {row.map((cell, j) => (
                      <td key={j} className="p-2">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isExpanded && tableData.rows.length > 5 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{tableData.rows.length - 5} linhas...
              </p>
            )}
          </div>
        );
      
      case "presentation":
        if (!slides) return null;
        return (
          <div className="space-y-2">
            {slides.slice(0, isExpanded ? undefined : 3).map((slide, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">Slide {i + 1}</Badge>
                  <span className="text-sm font-medium">{slide.title}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{slide.content}</p>
              </div>
            ))}
            {!isExpanded && slides.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{slides.length - 3} slides...
              </p>
            )}
          </div>
        );
      
      case "code":
        return (
          <pre className={cn(
            "p-3 bg-zinc-950 rounded-lg text-xs overflow-x-auto font-mono",
            !isExpanded && "max-h-32"
          )}>
            <code className="text-green-400">{content}</code>
          </pre>
        );
      
      default:
        return (
          <div className={cn(
            "text-sm text-foreground/80 whitespace-pre-wrap",
            !isExpanded && "line-clamp-6"
          )}>
            {content}
          </div>
        );
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-card/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md bg-background", config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5">
              {config.label}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          
          {type === "document" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownloadMarkdown}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          
          {(type === "table" || type === "spreadsheet") && tableData && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownloadCSV}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Content Preview */}
      <div className="p-3">
        <ScrollArea className={cn(isExpanded ? "max-h-96" : "max-h-48")}>
          {renderPreview()}
        </ScrollArea>
      </div>
      
      {/* Expand/Collapse */}
      <Button
        variant="ghost"
        className="w-full h-8 rounded-none border-t border-border/50 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Recolher
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Expandir
          </>
        )}
      </Button>
    </Card>
  );
};

// Utility function to detect and parse artifacts from AI response
export const parseArtifacts = (content: string): { 
  textContent: string; 
  artifacts: Array<{ type: ArtifactType; title: string; content: string; tableData?: any; slides?: any }> 
} => {
  const artifacts: Array<{ type: ArtifactType; title: string; content: string; tableData?: any; slides?: any }> = [];
  let textContent = content;
  
  // Detect document artifacts (marked with special syntax)
  const docRegex = /```document:([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = docRegex.exec(content)) !== null) {
    artifacts.push({
      type: "document",
      title: match[1].trim(),
      content: match[2].trim()
    });
    textContent = textContent.replace(match[0], "");
  }
  
  // Detect code blocks
  const codeRegex = /```(\w+)\n([\s\S]*?)```/g;
  while ((match = codeRegex.exec(content)) !== null) {
    if (match[1] !== "document" && match[1] !== "table" && match[1] !== "slides") {
      artifacts.push({
        type: "code",
        title: `Código ${match[1]}`,
        content: match[2].trim()
      });
    }
  }
  
  // Detect table artifacts
  const tableRegex = /```table:([^\n]+)\n([\s\S]*?)```/g;
  while ((match = tableRegex.exec(content)) !== null) {
    const lines = match[2].trim().split("\n");
    const headers = lines[0].split("|").map(h => h.trim()).filter(Boolean);
    const rows = lines.slice(2).map(line => 
      line.split("|").map(cell => cell.trim()).filter(Boolean)
    );
    
    artifacts.push({
      type: "table",
      title: match[1].trim(),
      content: match[2].trim(),
      tableData: { headers, rows }
    });
    textContent = textContent.replace(match[0], "");
  }
  
  // Detect presentation artifacts
  const slidesRegex = /```slides:([^\n]+)\n([\s\S]*?)```/g;
  while ((match = slidesRegex.exec(content)) !== null) {
    const slidesContent = match[2].trim();
    const slideBlocks = slidesContent.split(/---SLIDE \d+---/).filter(Boolean);
    const slides = slideBlocks.map((block) => {
      const lines = block.trim().split("\n");
      const title = lines[0].replace(/^#+\s*/, "");
      const slideContent = lines.slice(1).join("\n").trim();
      return { title, content: slideContent };
    });
    
    artifacts.push({
      type: "presentation",
      title: match[1].trim(),
      content: match[2].trim(),
      slides
    });
    textContent = textContent.replace(match[0], "");
  }
  
  return { textContent: textContent.trim(), artifacts };
};
