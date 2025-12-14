import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { useImportTwitterCSV } from "@/hooks/useImportTwitterCSV";

interface TwitterCSVUploadProps {
  clientId: string;
}

export const TwitterCSVUpload = ({ clientId }: TwitterCSVUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  
  const importMutation = useImportTwitterCSV(clientId);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    
    return lines.slice(1).map(line => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ""));
      
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });
  };

  const handleFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setImportResult(null);
    
    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        throw new Error("CSV vazio ou formato inválido");
      }
      
      const result = await importMutation.mutateAsync(data);
      setImportResult({ success: true, count: result });
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({ success: false, count: 0 });
    }
  }, [importMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const clearFile = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV do X Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={clearFile}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {importMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </div>
              )}
              
              {importResult?.success && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {importResult.count} dias importados
                </div>
              )}
              
              {importResult && !importResult.success && (
                <div className="text-sm text-destructive">
                  Erro na importação. Verifique o formato.
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste o CSV aqui ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </>
          )}
        </div>
        
        <p className="text-[10px] text-muted-foreground mt-2">
          Exporte de X Analytics → Account overview → Download CSV
        </p>
      </CardContent>
    </Card>
  );
};