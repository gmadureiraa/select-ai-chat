import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { useImportYouTubeCSV } from "@/hooks/useYouTubeMetrics";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface YouTubeCSVUploadProps {
  clientId: string;
}

export const YouTubeCSVUpload = ({ clientId }: YouTubeCSVUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importResult, setImportResult] = useState<{ success: boolean; videos: number; days: number } | null>(null);
  
  const importMutation = useImportYouTubeCSV();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Parse YouTube Studio "Tabular data" CSV (video list)
  const parseVideosCSV = (text: string): Array<{
    video_id: string;
    title: string;
    published_at: string | null;
    duration_seconds: number;
    total_views: number;
    watch_hours: number;
    subscribers_gained: number;
    impressions: number;
    click_rate: number;
  }> => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = lines[0].split("\t").map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split("\t").map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      
      // Extract video ID from URL or use direct ID
      let videoId = row["video id"] || row["id do vídeo"] || row["video"] || "";
      if (videoId.includes("watch?v=")) {
        videoId = videoId.split("watch?v=")[1]?.split("&")[0] || videoId;
      }
      
      return {
        video_id: videoId,
        title: row["video title"] || row["título do vídeo"] || row["title"] || row["título"] || "",
        published_at: parseDate(row["video publish time"] || row["data de publicação"] || row["published"] || ""),
        duration_seconds: parseDuration(row["duration"] || row["duração"] || "0"),
        total_views: parseNumber(row["views"] || row["visualizações"] || "0"),
        watch_hours: parseNumber(row["watch time (hours)"] || row["tempo de exibição (horas)"] || "0"),
        subscribers_gained: parseNumber(row["subscribers"] || row["inscritos"] || row["subscribers gained"] || "0"),
        impressions: parseNumber(row["impressions"] || row["impressões"] || "0"),
        click_rate: parseFloat(row["click rate"] || row["ctr"] || row["taxa de cliques"] || "0") || 0,
      };
    }).filter(v => v.video_id && v.title);
  };

  // Parse YouTube Studio daily views CSV
  const parseDailyViewsCSV = (text: string): Array<{ date: string; views: number }> => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    
    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      
      return {
        date: parseDate(row["date"] || row["data"] || "") || "",
        views: parseNumber(row["views"] || row["visualizações"] || "0"),
      };
    }).filter(v => v.date);
  };

  const parseNumber = (value: string): number => {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    return parseInt(cleaned) || 0;
  };

  const parseDate = (value: string): string | null => {
    if (!value) return null;
    
    // Try different date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
    ];
    
    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        if (format === formats[0]) {
          return value;
        } else {
          // Assume DD/MM/YYYY for Brazilian format
          return `${match[3]}-${match[2]}-${match[1]}`;
        }
      }
    }
    
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    } catch {
      // Fall through
    }
    
    return null;
  };

  const parseDuration = (value: string): number => {
    // Handle "HH:MM:SS" or "MM:SS" format
    const parts = value.split(":").map(p => parseInt(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parseInt(value) || 0;
  };

  const detectFileType = (text: string): "videos" | "daily" | "unknown" => {
    const firstLine = text.split("\n")[0].toLowerCase();
    
    if (firstLine.includes("video id") || firstLine.includes("id do vídeo") || firstLine.includes("video title")) {
      return "videos";
    }
    if (firstLine.includes("date") || firstLine.includes("data")) {
      return "daily";
    }
    return "unknown";
  };

  const handleFiles = useCallback(async (files: File[]) => {
    setSelectedFiles(files);
    setImportResult(null);
    
    try {
      let videos: any[] = [];
      let dailyViews: any[] = [];
      
      for (const file of files) {
        const text = await file.text();
        const fileType = detectFileType(text);
        
        if (fileType === "videos") {
          videos = [...videos, ...parseVideosCSV(text)];
        } else if (fileType === "daily") {
          dailyViews = [...dailyViews, ...parseDailyViewsCSV(text)];
        }
      }
      
      if (videos.length === 0 && dailyViews.length === 0) {
        throw new Error("Nenhum dado válido encontrado nos CSVs");
      }
      
      const result = await importMutation.mutateAsync({
        clientId,
        videos,
        dailyViews,
      });
      
      // Clear insights cache
      localStorage.removeItem(`insights-${clientId}`);
      
      setImportResult({ success: true, videos: result.videosImported, days: result.daysImported });
      
      toast({
        title: "Métricas importadas",
        description: `${result.videosImported} vídeos e ${result.daysImported} dias importados.`,
      });
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({ success: false, videos: 0, days: 0 });
      
      toast({
        title: "Erro na importação",
        description: "Verifique o formato dos arquivos CSV.",
        variant: "destructive",
      });
    }
  }, [clientId, importMutation, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".csv"));
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const clearFiles = () => {
    setSelectedFiles([]);
    setImportResult(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV do YouTube Studio
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
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-1">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={clearFiles}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
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
                  {importResult.videos} vídeos, {importResult.days} dias
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
                Arraste CSVs aqui ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </>
          )}
        </div>
        
        <p className="text-[10px] text-muted-foreground mt-2">
          YouTube Studio → Analytics → Advanced Mode → Export (CSV)
        </p>
      </CardContent>
    </Card>
  );
};