import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Sparkles, X, ArrowLeft, Bot, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { useSmartInstagramImport } from "@/hooks/useSmartInstagramImport";
import { useImportYouTubeCSV } from "@/hooks/useYouTubeMetrics";
import { useSmartNewsletterImport } from "@/hooks/useSmartNewsletterImport";
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
  
  // Use appropriate import hook based on platform
  const instagramImport = useSmartInstagramImport(clientId, handleImportComplete);
  const youtubeImport = useImportYouTubeCSV();
  const newsletterImport = useSmartNewsletterImport(clientId, handleImportComplete);
  
  // Unified import pending state
  const isImporting = platform === 'youtube' 
    ? youtubeImport.isPending 
    : platform === 'newsletter'
    ? newsletterImport.isImporting
    : instagramImport.isPending;
  
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

  type ImportDateRange = { start: string; end: string };

  const normalizeDateString = (raw: string): string | null => {
    const s = (raw || "").replace(/\0/g, "").trim();
    if (!s) return null;

    const isoWithTime = s.includes("T") ? s.split("T")[0] : s;

    // DD/MM/YYYY
    const br = isoWithTime.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoWithTime)) return isoWithTime;

    return null;
  };

  const computeDateRangeFromValidation = (): ImportDateRange | undefined => {
    // Only daily metrics affect platform_metrics; posts/stories live in other tables
    const dailyTypes = new Set([
      "reach",
      "followers",
      "followers_absolute",
      "views",
      "interactions",
      "profile_visits",
      "link_clicks",
      // YouTube types
      "youtube_daily_views",
      "youtube_videos_published",
      // Newsletter types
      "newsletter_daily_performance",
      "newsletter_posts",
      "newsletter_subscribers",
      "newsletter_top_urls",
      "newsletter_web_performance",
      "newsletter_link_clicks",
    ]);

    const dates: string[] = [];
    for (const vr of validationResults) {
      if (!dailyTypes.has(vr.detectedType)) continue;

      for (const row of vr.rawData) {
        const raw = (row["data"] || row["date"] || Object.values(row)[0] || "") as string;
        const normalized = normalizeDateString(raw);
        if (normalized) dates.push(normalized);
      }
    }

    if (dates.length === 0) return undefined;
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  };

  const computeImportTypesFromValidation = (): string[] => {
    const types = validationResults
      .map((r) => r.detectedType)
      .filter((t) => t && t !== "unknown");
    return Array.from(new Set(types));
  };

  // Run AI verification after import
  const runAIVerification = async (context: {
    importedCount: number;
    dateRange?: ImportDateRange;
    importTypes?: string[];
    fileName?: string;
  }) => {
    const { importedCount, dateRange, importTypes, fileName } = context;

    setIsVerifying(true);
    setCurrentStep("verifying");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await supabase.functions.invoke("validate-csv-import", {
        body: {
          clientId,
          platform,
          importedCount,
          dateRange,
          importTypes,
          fileName,
          userId,
        },
      });

      if (error) {
        console.error("AI verification error:", error);
        setAiVerification({
          status: "warning",
          summary: "Não foi possível verificar automaticamente, mas os dados foram importados.",
          details: [`${importedCount} registros importados`],
          issues: [],
          recommendations: ["Verifique os dados manualmente nos gráficos"],
          aiAnalyzed: false,
        });
      } else {
        setAiVerification(data);
      }
    } catch (err) {
      console.error("AI verification failed:", err);
      setAiVerification({
        status: "success",
        summary: `${importedCount} registros importados com sucesso`,
        details: [],
        issues: [],
        recommendations: [],
        aiAnalyzed: false,
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
      let totalCount = 0;
      
      if (platform === 'youtube') {
        // YouTube-specific import logic
        const videos: Array<{
          video_id: string;
          title: string;
          published_at: string | null;
          duration_seconds: number;
          total_views: number;
          watch_hours: number;
          subscribers_gained: number;
          impressions: number;
          click_rate: number;
        }> = [];
        const dailyViews: Array<{ date: string; views: number; total_posts?: number }> = [];
        
        // Parse each file
        for (const file of selectedFiles) {
          const text = await file.text();
          const parsed = parseYouTubeCSV(text);
          videos.push(...parsed.videos);
          dailyViews.push(...parsed.dailyViews);
        }
        
        if (videos.length > 0 || dailyViews.length > 0) {
          const result = await youtubeImport.mutateAsync({
            clientId,
            videos,
            dailyViews
          });
          totalCount = result.videosImported + result.daysImported;
          handleImportComplete('youtube', totalCount, selectedFiles.map(f => f.name).join(', '));
        }
      } else if (platform === 'newsletter') {
        // Newsletter-specific import using smart newsletter import hook
        await newsletterImport.importMultipleFiles(selectedFiles);
        totalCount = newsletterImport.result?.count || 0;
        
        // If result is not immediately available, estimate from files
        if (totalCount === 0) {
          for (const file of selectedFiles) {
            const text = await file.text();
            const lines = text.trim().split('\n');
            totalCount += Math.max(0, lines.length - 1); // Subtract header
          }
        }
      } else {
        // Instagram import (default)
        const results = await instagramImport.mutateAsync(selectedFiles);
        totalCount = results.reduce((sum, r) => sum + r.count, 0);
      }

      setImportResult({
        success: true,
        message: `${totalCount} registros importados!`,
        count: totalCount,
      });

      // Run AI verification (with context to avoid false negatives)
      const fileName = selectedFiles.map((f) => f.name).join(", ");
      const dateRange = computeDateRangeFromValidation();
      const importTypes = computeImportTypesFromValidation();
      await runAIVerification({ importedCount: totalCount, dateRange, importTypes, fileName });

      setSelectedFiles([]);
      clearValidation();
      onImportComplete?.();
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: "Erro ao processar arquivos"
      });
      setCurrentStep("validation");
    }
  };
  
  // Parse YouTube CSV files (both videos and daily views)
  const parseYouTubeCSV = (text: string): {
    videos: Array<{
      video_id: string;
      title: string;
      published_at: string | null;
      duration_seconds: number;
      total_views: number;
      watch_hours: number;
      subscribers_gained: number;
      impressions: number;
      click_rate: number;
    }>;
    dailyViews: Array<{ date: string; views: number; total_posts?: number }>;
  } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { videos: [], dailyViews: [] };
    
    const firstLine = lines[0].toLowerCase();
    const isTabSeparated = lines[0].includes('\t');
    const delimiter = isTabSeparated ? '\t' : ',';
    
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    
    // Detect if this is a videos file or daily views file
    const isVideosFile = headers.some(h => 
      h.includes('video') || h.includes('título') || h.includes('title') || h.includes('watch time')
    );
    
    if (isVideosFile) {
      const videos = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        
        let videoId = row['video id'] || row['id do vídeo'] || row['video'] || '';
        if (videoId.includes('watch?v=')) {
          videoId = videoId.split('watch?v=')[1]?.split('&')[0] || videoId;
        }
        
        const parseNum = (v: string) => parseInt(v.replace(/[^0-9.-]/g, '')) || 0;
        const parseDuration = (v: string) => {
          if (!v) return 0;
          const parts = v.split(':').map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          return parseNum(v);
        };
        
        return {
          video_id: videoId,
          title: row['video title'] || row['título do vídeo'] || row['title'] || row['título'] || '',
          published_at: row['video publish time'] || row['data de publicação'] || row['published'] || null,
          duration_seconds: parseDuration(row['duration'] || row['duração'] || '0'),
          total_views: parseNum(row['views'] || row['visualizações'] || '0'),
          watch_hours: parseNum(row['watch time (hours)'] || row['tempo de exibição (horas)'] || '0'),
          subscribers_gained: parseNum(row['subscribers'] || row['inscritos'] || row['subscribers gained'] || '0'),
          impressions: parseNum(row['impressions'] || row['impressões'] || '0'),
          click_rate: parseFloat(row['click rate'] || row['ctr'] || row['taxa de cliques'] || '0') || 0,
        };
      }).filter(v => v.video_id && v.title);
      
      return { videos, dailyViews: [] };
    } else {
      // Daily metrics file (views or videos published)
      const isVideosPublishedFile = headers.some(h => 
        h.includes('publicado') || h.includes('published') || h.includes('vídeos publicados')
      );
      
      const dailyViews = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        
        // Get date from first column or named columns
        let dateStr = row['date'] || row['data'] || Object.values(row)[0] || '';
        
        // Try to parse date in DD/MM/YYYY format
        const ddmmyyyy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmyyyy) {
          dateStr = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
        }
        // Already in YYYY-MM-DD format - just validate
        else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          // Already valid ISO format
        }
        
        if (isVideosPublishedFile) {
          // Videos published CSV format - get value from second column
          const valueColumn = row['vídeos publicados'] || row['videos publicados'] || row['published'] || Object.values(row)[1] || '0';
          return {
            date: dateStr,
            views: 0,
            total_posts: parseInt(valueColumn.replace(/[^0-9]/g, '')) || 0,
          };
        }
        
        return {
          date: dateStr,
          views: parseInt((row['views'] || row['visualizações'] || '0').replace(/[^0-9]/g, '')) || 0,
          total_posts: 0,
        };
      }).filter(v => v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date));
      
      return { videos: [], dailyViews };
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
            isImporting={isImporting}
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
