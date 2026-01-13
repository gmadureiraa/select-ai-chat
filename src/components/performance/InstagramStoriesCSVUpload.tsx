import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useImportInstagramStoriesCSV } from "@/hooks/useImportInstagramStoriesCSV";
import { cn } from "@/lib/utils";

interface InstagramStoriesCSVUploadProps {
  clientId: string;
  onSuccess?: () => void;
}

export function InstagramStoriesCSVUpload({ clientId, onSuccess }: InstagramStoriesCSVUploadProps) {
  const [open, setOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  
  const importMutation = useImportInstagramStoriesCSV(clientId);

  const parseCSV = (text: string) => {
    // Clean the text and split into lines
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanText.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];
    
    // Find delimiter (comma or semicolon) - check first line without quotes
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";
    
    // Parse a CSV line respecting quoted fields
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      
      return result;
    };
    
    const headers = parseLine(lines[0]);
    
    return lines.slice(1).map(line => {
      const values = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        // Clean header of any remaining quotes
        const cleanHeader = header.replace(/^"|"$/g, '');
        row[cleanHeader] = values[i] || "";
      });
      return row;
    });
  };

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    const text = await selectedFile.text();
    const parsed = parseCSV(text);
    setPreview(parsed.slice(0, 3));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "text/csv" || droppedFile?.name.endsWith(".csv")) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    
    await importMutation.mutateAsync(rows);
    setOpen(false);
    setFile(null);
    setPreview([]);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Stories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Stories do Instagram</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV exportado do Reportei ou Meta Business Suite.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-border",
            file && "border-green-500 bg-green-500/5"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {preview.length > 0 ? `${preview.length}+ registros encontrados` : "Processando..."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setFile(null); setPreview([]); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste um arquivo CSV aqui ou
              </p>
              <label>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
              </label>
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Colunas aceitas:</p>
          <p>Visualizações, Alcance, Curtidas, Compartilhamentos, Respostas, Navegação, Horário de publicação</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              "Importar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
