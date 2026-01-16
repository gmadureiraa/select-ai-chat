import { useState, memo, useMemo } from "react";
import { Copy, FileText, Table, Presentation, ChevronDown, ChevronUp, Download, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ArtifactType = "document" | "table" | "presentation" | "code";

interface Slide {
  title: string;
  content: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface Artifact {
  type: ArtifactType;
  title: string;
  content: string;
  tableData?: TableData;
  slides?: Slide[];
}

interface ArtifactCardProps {
  type: ArtifactType;
  title: string;
  content: string;
  tableData?: TableData;
  slides?: Slide[];
}

// Parse content for artifacts like documents, tables, etc.
export function parseArtifacts(content: string): { textContent: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];
  let textContent = content;

  // Parse document artifacts: ```document\n# Title\ncontent\n```
  const docPattern = /```document\n([\s\S]*?)```/g;
  let match;
  while ((match = docPattern.exec(content)) !== null) {
    const docContent = match[1];
    const titleMatch = docContent.match(/^#\s*(.+)/m);
    artifacts.push({
      type: "document",
      title: titleMatch ? titleMatch[1] : "Documento",
      content: docContent,
    });
    textContent = textContent.replace(match[0], "");
  }

  // Parse table artifacts: ```table\n| Header |\n|---|\n| Row |\n```
  const tablePattern = /```table\n([\s\S]*?)```/g;
  while ((match = tablePattern.exec(content)) !== null) {
    const tableContent = match[1];
    const lines = tableContent.trim().split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      const headers = lines[0].split("|").filter((h) => h.trim()).map((h) => h.trim());
      const rows = lines.slice(2).map((row) => 
        row.split("|").filter((c) => c.trim()).map((c) => c.trim())
      );
      artifacts.push({
        type: "table",
        title: "Tabela",
        content: tableContent,
        tableData: { headers, rows },
      });
    }
    textContent = textContent.replace(match[0], "");
  }

  return { textContent: textContent.trim(), artifacts };
}

export const ArtifactCard = memo(function ArtifactCard({
  type,
  title,
  content,
  tableData,
  slides,
}: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const Icon = type === "table" ? Table : type === "presentation" ? Presentation : FileText;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewContent = useMemo(() => {
    if (type === "table" && tableData) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {tableData.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.slice(0, isExpanded ? undefined : 3).map((row, ri) => (
                <tr key={ri} className="border-b border-border/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.rows.length > 3 && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-2">
              +{tableData.rows.length - 3} linhas
            </p>
          )}
        </div>
      );
    }

    return (
      <pre className={cn(
        "text-xs whitespace-pre-wrap font-mono",
        !isExpanded && "line-clamp-6"
      )}>
        {content}
      </pre>
    );
  }, [type, tableData, content, isExpanded]);

  return (
    <Card className="bg-muted/30 border-border/50">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {previewContent}
      </CardContent>
    </Card>
  );
});
