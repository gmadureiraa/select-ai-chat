import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Sparkles, X, ArrowLeft } from "lucide-react";
import { useSmartInstagramImport } from "@/hooks/useSmartInstagramImport";
import { useCSVValidation } from "@/hooks/useCSVValidation";
import { CSVValidationAgent } from "@/components/performance/CSVValidationAgent";
import { Badge } from "@/components/ui/badge";

interface SmartCSVUploadProps {
  clientId: string;
  platform: "instagram" | "youtube" | "twitter";
  onImportComplete?: () => void;
}

type UploadStep = "upload" | "validation" | "complete";

export function SmartCSVUpload({ clientId, platform, onImportComplete }: SmartCSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<UploadStep>("upload");
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const importMutation = useSmartInstagramImport(clientId);
  const { 
    validationResults, 
    isValidating, 
    validateFiles, 
    clearValidation,
    applyFix,
    hasErrors,
    allValid 
  } = useCSVValidation();

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

  // Step 1 → Step 2: Validate files
  const handleValidate = async () => {
    if (selectedFiles.length === 0) return;
    
    await validateFiles(selectedFiles);
    setCurrentStep("validation");
  };

  // Step 2 → Import (or back to upload)
  const handleProceedImport = async () => {
    if (hasErrors) return;
    
    try {
      const results = await importMutation.mutateAsync(selectedFiles);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      setImportResult({
        success: true,
        message: `${totalCount} registros importados com sucesso!`
      });
      setCurrentStep("complete");
      setSelectedFiles([]);
      clearValidation();
      onImportComplete?.();
    } catch (error) {
      setImportResult({
        success: false,
        message: "Erro ao processar arquivos"
      });
    }
  };

  const handleCancelValidation = () => {
    setCurrentStep("upload");
    clearValidation();
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setCurrentStep("upload");
    setImportResult(null);
    clearValidation();
  };

  const platformLabels = {
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "Twitter/X"
  };

  // Step 3: Complete state
  if (currentStep === "complete" && importResult?.success) {
    return (
      <Card className="border-green-500/30">
        <CardContent className="py-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="font-medium text-green-600">{importResult.message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Os dados já estão disponíveis nos gráficos e tabelas.
            </p>
          </div>
          <Button variant="outline" onClick={handleReset}>
            Importar mais arquivos
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Validation state
  if (currentStep === "validation") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={handleCancelValidation}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Validação - {platformLabels[platform]}
              </CardTitle>
              <CardDescription>
                Revise os dados antes de importar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CSVValidationAgent
            validationResults={validationResults}
            onProceed={handleProceedImport}
            onCancel={handleCancelValidation}
            onApplyFix={applyFix}
            isImporting={importMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  // Step 1: Upload state
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Importação Inteligente - {platformLabels[platform]}
        </CardTitle>
        <CardDescription>
          Arraste múltiplos CSVs - o sistema valida automaticamente antes de importar
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
              onClick={handleValidate}
              disabled={isValidating}
              className="w-full mt-2"
            >
              {isValidating ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Validar {selectedFiles.length} arquivo{selectedFiles.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        )}

        {importResult && !importResult.success && (
          <div className="flex items-center gap-2 text-sm text-destructive">
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
            <li>Cliques no link / Cliques na bio / Toques no link</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
