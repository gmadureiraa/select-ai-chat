import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Sparkles, X, ArrowLeft, Bot, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { useSmartInstagramImport } from "@/hooks/useSmartInstagramImport";
import { useCSVValidation } from "@/hooks/useCSVValidation";
import { useImportHistory } from "@/hooks/useImportHistory";
import { CSVValidationAgent } from "@/components/performance/CSVValidationAgent";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface SmartCSVUploadProps {
  clientId: string;
  platform: "instagram" | "youtube" | "twitter" | "newsletter";
  onImportComplete?: () => void;
}

type UploadStep = "upload" | "validation" | "verifying" | "complete";

interface AIVerificationResult {
  status: "success" | "warning" | "error";
  summary: string;
  details: string[];
  issues: string[];
  recommendations: string[];
  aiAnalyzed: boolean;
  stats?: {
    avgViews: number;
    avgEngagement: string;
    maxViews: number;
    minViews: number;
    hasNulls: boolean;
    uniqueDates: number;
  };
}

export function SmartCSVUpload({ clientId, platform, onImportComplete }: SmartCSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<UploadStep>("upload");
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [aiVerification, setAiVerification] = useState<AIVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const { logImport } = useImportHistory(clientId);
  
  // Callback to log imports to history
  const handleImportComplete = useCallback((importPlatform: string, count: number, fileName?: string) => {
    logImport.mutate({
      clientId,
      platform: importPlatform,
      recordsCount: count,
      fileName,
      status: "completed",
      metadata: { source: "smart_csv_upload" }
    });
  }, [clientId, logImport]);
  
  const importMutation = useSmartInstagramImport(clientId, handleImportComplete);
  const { 
    validationResults, 
    isValidating, 
    validateFiles, 
    clearValidation,
    applyFix,
    hasErrors
  } = useCSVValidation();

  const handleFiles = useCallback((files: FileList) => {
    const csvFiles = Array.from(files).filter(
      f => f.name.endsWith(".csv") || f.type === "text/csv"
    );
    setSelectedFiles(prev => [...prev, ...csvFiles]);
    setImportResult(null);
    setAiVerification(null);
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

  // Run AI verification after import
  const runAIVerification = async (importedCount: number) => {
    setIsVerifying(true);
    setCurrentStep("verifying");
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-csv-import', {
        body: {
          clientId,
          platform,
          importedCount
        }
      });

      if (error) {
        console.error('AI verification error:', error);
        setAiVerification({
          status: "warning",
          summary: "Não foi possível verificar automaticamente, mas os dados foram importados.",
          details: [`${importedCount} registros importados`],
          issues: [],
          recommendations: ["Verifique os dados manualmente nos gráficos"],
          aiAnalyzed: false
        });
      } else {
        setAiVerification(data);
      }
    } catch (err) {
      console.error('AI verification failed:', err);
      setAiVerification({
        status: "success",
        summary: `${importedCount} registros importados com sucesso`,
        details: [],
        issues: [],
        recommendations: [],
        aiAnalyzed: false
      });
    } finally {
      setIsVerifying(false);
      setCurrentStep("complete");
    }
  };

  // Step 2 → Import (or back to upload)
  const handleProceedImport = async () => {
    if (hasErrors) return;
    
    try {
      const results = await importMutation.mutateAsync(selectedFiles);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);

      setImportResult({
        success: true,
        message: `${totalCount} registros importados!`,
        count: totalCount
      });
      
      // Run AI verification
      await runAIVerification(totalCount);
      
      setSelectedFiles([]);
      clearValidation();
      onImportComplete?.();
    } catch (error) {
      setImportResult({
        success: false,
        message: "Erro ao processar arquivos"
      });
      setCurrentStep("validation");
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
    setAiVerification(null);
    clearValidation();
  };

  const platformLabels = {
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "Twitter/X"
  };

  // Step 3: Verifying state
  if (currentStep === "verifying") {
    return (
      <Card className="border-primary/30">
        <CardContent className="py-8 text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto"
          >
            <Bot className="h-8 w-8 text-primary animate-pulse" />
          </motion.div>
          <div>
            <p className="font-medium">Verificando importação com IA...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Analisando dados para garantir que tudo está correto
            </p>
          </div>
          <div className="flex justify-center">
            <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Complete state with AI verification
  if (currentStep === "complete") {
    const statusIcon = {
      success: <CheckCircle2 className="h-8 w-8 text-green-500" />,
      warning: <AlertTriangle className="h-8 w-8 text-yellow-500" />,
      error: <XCircle className="h-8 w-8 text-destructive" />
    };

    const statusBg = {
      success: "bg-green-500/20",
      warning: "bg-yellow-500/20",
      error: "bg-destructive/20"
    };

    const statusBorder = {
      success: "border-green-500/30",
      warning: "border-yellow-500/30",
      error: "border-destructive/30"
    };

    const status = aiVerification?.status || "success";

    return (
      <Card className={statusBorder[status]}>
        <CardContent className="py-6 space-y-4">
          {/* Header with status */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`h-16 w-16 rounded-full ${statusBg[status]} flex items-center justify-center mx-auto`}
            >
              {statusIcon[status]}
            </motion.div>
            <p className="font-medium mt-3">{aiVerification?.summary || importResult?.message}</p>
          </div>

          {/* AI Analysis Section */}
          {aiVerification && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              {/* Agent Badge */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-3 w-3" />
                <span>{aiVerification.aiAnalyzed ? "Verificado por IA" : "Verificação básica"}</span>
              </div>

              {/* Details */}
              {aiVerification.details.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  {aiVerification.details.map((detail, idx) => (
                    <p key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {detail}
                    </p>
                  ))}
                </div>
              )}

              {/* Issues */}
              {aiVerification.issues.length > 0 && (
                <div className="bg-yellow-500/10 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-yellow-600 mb-2">Atenção:</p>
                  {aiVerification.issues.map((issue, idx) => (
                    <p key={idx} className="flex items-start gap-2 text-yellow-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      {issue}
                    </p>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {aiVerification.recommendations.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-primary mb-2">Recomendações:</p>
                  {aiVerification.recommendations.map((rec, idx) => (
                    <p key={idx} className="text-muted-foreground">• {rec}</p>
                  ))}
                </div>
              )}

              {/* Stats Summary */}
              {aiVerification.stats && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="font-medium">{aiVerification.stats.uniqueDates}</p>
                    <p className="text-muted-foreground">dias</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="font-medium">{aiVerification.stats.avgViews.toLocaleString()}</p>
                    <p className="text-muted-foreground">média views</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="font-medium">{aiVerification.stats.avgEngagement}%</p>
                    <p className="text-muted-foreground">engajamento</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Importar mais
            </Button>
          </div>
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
