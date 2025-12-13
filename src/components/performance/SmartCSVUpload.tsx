import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Sparkles, X } from "lucide-react";
import { useSmartInstagramImport } from "@/hooks/useSmartInstagramImport";
import { Badge } from "@/components/ui/badge";

interface SmartCSVUploadProps {
  clientId: string;
  platform: "instagram" | "youtube" | "twitter";
  onImportComplete?: () => void;
}

export function SmartCSVUpload({ clientId, platform, onImportComplete }: SmartCSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const importMutation = useSmartInstagramImport(clientId);

  const handleFiles = useCallback((files: FileList) => {
    const csvFiles = Array.from(files).filter(
      f => f.name.endsWith(".csv") || f.type === "text/csv"
    );
    setSelectedFiles(prev => [...prev, ...csvFiles]);
    setImportResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;
    
    setImportResult(null);
    
    try {
      const results = await importMutation.mutateAsync(selectedFiles);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      setImportResult({
        success: true,
        message: `${totalCount} registros importados com sucesso!`
      });
      setSelectedFiles([]);
      onImportComplete?.();
    } catch (error) {
      setImportResult({
        success: false,
        message: "Erro ao processar arquivos"
      });
    }
  };

  const platformLabels = {
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "Twitter/X"
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Importação Inteligente - {platformLabels[platform]}
        </CardTitle>
        <CardDescription>
          Arraste múltiplos CSVs - o sistema detecta automaticamente o tipo de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Arraste CSVs aqui ou clique para selecionar
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            id={`smart-csv-upload-${platform}`}
            onChange={handleFileInput}
          />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor={`smart-csv-upload-${platform}`} className="cursor-pointer">
              Selecionar Arquivos
            </label>
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Arquivos selecionados:</p>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="flex items-center gap-1 py-1"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span className="max-w-32 truncate">{file.name}</span>
                  <button 
                    onClick={() => removeFile(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="w-full mt-2"
            >
              {importMutation.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Importar {selectedFiles.length} arquivo{selectedFiles.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}

        {importResult && (
          <div className={`flex items-center gap-2 text-sm ${
            importResult.success ? "text-green-600" : "text-destructive"
          }`}>
            {importResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {importResult.message}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Tipos de CSV suportados:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Posts individuais (com métricas por post)</li>
            <li>Alcance diário</li>
            <li>Seguidores</li>
            <li>Visualizações</li>
            <li>Interações</li>
            <li>Visitas ao perfil</li>
            <li>Cliques no link</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
