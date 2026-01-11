import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useImportMetaAdsCSV } from "@/hooks/useMetaAdsData";
import { parseMetaAdsCSV, parseCSVContent, detectCSVType } from "@/utils/parseMetaAdsCSV";
import { cn } from "@/lib/utils";

interface MetaAdsCSVUploadProps {
  clientId: string;
  onComplete?: () => void;
}

interface FilePreview {
  file: File;
  type: 'campaigns' | 'adsets' | 'ads' | null;
  recordCount: number;
  content: string;
}

const typeLabels = {
  campaigns: 'Campanhas',
  adsets: 'Conjuntos de Anúncios',
  ads: 'Anúncios'
};

const typeColors = {
  campaigns: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  adsets: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ads: 'bg-green-500/10 text-green-500 border-green-500/20'
};

export function MetaAdsCSVUpload({ clientId, onComplete }: MetaAdsCSVUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ type: string; count: number; success: boolean }[]>([]);
  
  const importMutation = useImportMetaAdsCSV(clientId);
  
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);
  
  const processFile = async (file: File): Promise<FilePreview> => {
    const content = await file.text();
    const rows = parseCSVContent(content);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const type = detectCSVType(headers);
    
    return {
      file,
      type,
      recordCount: rows.length,
      content
    };
  };
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.name.endsWith('.csv') || f.type === 'text/csv'
    );
    
    const previews = await Promise.all(droppedFiles.map(processFile));
    setFiles(prev => [...prev, ...previews]);
  }, []);
  
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const previews = await Promise.all(selectedFiles.map(processFile));
      setFiles(prev => [...prev, ...previews]);
    }
    e.target.value = '';
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleImport = async () => {
    setIsImporting(true);
    setImportResults([]);
    
    const results: { type: string; count: number; success: boolean }[] = [];
    
    for (const filePreview of files) {
      if (!filePreview.type) continue;
      
      try {
        const parsed = parseMetaAdsCSV(filePreview.content);
        if (parsed) {
          await importMutation.mutateAsync(parsed);
          results.push({ type: filePreview.type, count: parsed.data.length, success: true });
        }
      } catch (error) {
        results.push({ type: filePreview.type, count: 0, success: false });
      }
    }
    
    setImportResults(results);
    setIsImporting(false);
    
    if (results.every(r => r.success)) {
      setFiles([]);
      onComplete?.();
    }
  };
  
  const validFiles = files.filter(f => f.type !== null);
  const hasValidFiles = validFiles.length > 0;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Dados do Meta Ads
        </CardTitle>
        <CardDescription>
          Exporte os relatórios do Gerenciador de Anúncios do Facebook em CSV e faça upload aqui.
          Suportamos campanhas, conjuntos de anúncios e anúncios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 transition-all text-center",
            dragActive 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
        >
          <Upload className={cn(
            "h-8 w-8 mx-auto mb-3 transition-colors",
            dragActive ? "text-primary" : "text-muted-foreground"
          )} />
          <p className="text-sm text-muted-foreground mb-2">
            Arraste arquivos CSV aqui ou
          </p>
          <label>
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Selecionar arquivos</span>
            </Button>
          </label>
        </div>
        
        {/* Files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((filePreview, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {filePreview.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filePreview.recordCount} registros
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {filePreview.type ? (
                    <Badge variant="outline" className={typeColors[filePreview.type]}>
                      {typeLabels[filePreview.type]}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Formato inválido
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Import results */}
        {importResults.length > 0 && (
          <div className="space-y-2">
            {importResults.map((result, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md text-sm",
                  result.success 
                    ? "bg-green-500/10 text-green-500" 
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>
                  {result.success 
                    ? `${result.count} ${typeLabels[result.type as keyof typeof typeLabels]} importados`
                    : `Erro ao importar ${typeLabels[result.type as keyof typeof typeLabels]}`
                  }
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Import button */}
        {hasValidFiles && (
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? "Importando..." : `Importar ${validFiles.length} arquivo(s)`}
          </Button>
        )}
        
        {/* Help text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Como exportar do Facebook:</p>
          <ol className="list-decimal list-inside space-y-0.5 pl-1">
            <li>Acesse o Gerenciador de Anúncios</li>
            <li>Selecione as campanhas, conjuntos ou anúncios</li>
            <li>Clique em "Exportar" → "Exportar dados da tabela (.csv)"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
