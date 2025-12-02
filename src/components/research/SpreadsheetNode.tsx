import { memo, useState, useRef } from "react";
import { Table, Upload, Eye, Loader2, Download } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Button } from "@/components/ui/button";
import { useResearchItems, ResearchItem } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SpreadsheetNodeProps {
  id: string;
  data: {
    item: ResearchItem;
    onDelete: (id: string) => void;
    projectId: string;
    isConnected?: boolean;
  };
}

interface SpreadsheetData {
  headers: string[];
  rows: string[][];
}

export const SpreadsheetNode = memo(({ id, data }: SpreadsheetNodeProps) => {
  const { item, onDelete, projectId, isConnected } = data;
  const { updateItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showData, setShowData] = useState(false);

  const parseCSV = (text: string): SpreadsheetData => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of row) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    
    return { headers, rows };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".csv")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo CSV ou Excel.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Read file content
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      // Upload file to storage
      const fileName = `${projectId}/${id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("research-files")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("research-files")
        .getPublicUrl(fileName);

      // Create text summary for AI analysis
      const textContent = [
        `Planilha: ${file.name}`,
        `Colunas: ${parsedData.headers.join(", ")}`,
        `Total de linhas: ${parsedData.rows.length}`,
        "",
        "Primeiras 10 linhas:",
        ...parsedData.rows.slice(0, 10).map((row, i) => 
          `${i + 1}. ${parsedData.headers.map((h, j) => `${h}: ${row[j] || ""}`).join(" | ")}`
        ),
      ].join("\n");

      await updateItem.mutateAsync({
        id,
        title: file.name,
        file_path: fileName,
        source_url: urlData.publicUrl,
        content: textContent,
        metadata: {
          headers: parsedData.headers,
          rowCount: parsedData.rows.length,
          columnCount: parsedData.headers.length,
          rawData: parsedData,
          fileSize: file.size,
        },
        processed: true,
      });

      toast({ 
        title: "Planilha adicionada", 
        description: `${parsedData.rows.length} linhas, ${parsedData.headers.length} colunas` 
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao processar planilha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const spreadsheetData = item.metadata?.rawData as SpreadsheetData | undefined;
  const hasData = spreadsheetData && spreadsheetData.headers.length > 0;
  const rowCount = item.metadata?.rowCount || 0;
  const colCount = item.metadata?.columnCount || 0;

  return (
    <BaseNode
      id={id}
      onDelete={onDelete}
      icon={Table}
      iconColor="text-teal-500"
      bgColor="bg-teal-500/10"
      borderColor="border-teal-500/30"
      label="Planilha"
      title={item.title || "Planilha"}
      isConnected={isConnected}
      className="w-80"
      badge={
        hasData && (
          <span className="text-xs px-2 py-0.5 bg-teal-500/10 text-teal-500 rounded-md">
            {rowCount} × {colCount}
          </span>
        )
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {!hasData ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar CSV/Excel
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          {/* Preview table */}
          <div className="border rounded-md overflow-hidden text-xs">
            <div className="overflow-x-auto max-h-32 no-pan no-wheel">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    {spreadsheetData.headers.slice(0, 4).map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium truncate max-w-20">
                        {h}
                      </th>
                    ))}
                    {spreadsheetData.headers.length > 4 && (
                      <th className="px-2 py-1 text-muted-foreground">...</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheetData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      {row.slice(0, 4).map((cell, j) => (
                        <td key={j} className="px-2 py-1 truncate max-w-20">
                          {cell}
                        </td>
                      ))}
                      {row.length > 4 && (
                        <td className="px-2 py-1 text-muted-foreground">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowData(true)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver tudo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(item.source_url!, "_blank")}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showData} onOpenChange={setShowData}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {spreadsheetData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      {spreadsheetData.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheetData.rows.map((row, i) => (
                      <tr key={i} className="border-t hover:bg-muted/50">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
});

SpreadsheetNode.displayName = "SpreadsheetNode";
