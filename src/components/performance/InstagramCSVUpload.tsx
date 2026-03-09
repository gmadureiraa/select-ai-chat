import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { useImportInstagramPostsCSV } from "@/hooks/useInstagramPosts";
import * as XLSX from "xlsx";

interface InstagramCSVUploadProps {
  clientId: string;
}

interface ParsedPost {
  post_id: string;
  post_type?: string;
  caption?: string;
  posted_at?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  engagement_rate?: number;
  thumbnail_url?: string;
  permalink?: string;
}

export function InstagramCSVUpload({ clientId }: InstagramCSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);
  const importMutation = useImportInstagramPostsCSV();

  function normalizeHeader(h: any): string {
    if (!h) return "";
    return String(h).trim().toLowerCase()
      .replace(/^\ufeff/, "") // Remove BOM
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['"]/g, "");
  }

  const parseCSV = (file: File): Promise<ParsedPost[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Read as text to handle BOM and encoding correctly
          let text = e.target?.result as string;
          // Strip BOM if present
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          
          const workbook = XLSX.read(text, { type: "string" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];

          if (rows.length < 2) { resolve([]); return; }

          // Find header row (scan first 5 rows)
          let headerRowIdx = 0;
          const knownHeaders = ["identificacao do post", "post_id", "curtidas", "likes", "alcance", "reach", "link permanente", "permalink"];
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const normalized = rows[i].map(normalizeHeader);
            const matches = knownHeaders.filter(kh => normalized.some(n => n.includes(kh)));
            if (matches.length >= 2) { headerRowIdx = i; break; }
          }

          const headers = rows[headerRowIdx].map(normalizeHeader);
          console.log("[InstagramCSV] Headers found:", headers);

          // Build column map
          const colMap: Record<string, number> = {};
          const mappings: Record<string, string[]> = {
            post_id: ["identificacao do post", "post_id", "id"],
            post_type: ["tipo de post", "post_type", "type", "tipo"],
            caption: ["descricao", "caption", "legenda", "texto"],
            posted_at: ["horario de publicacao", "posted_at", "date", "published_at"],
            likes: ["curtidas", "likes"],
            comments: ["comentarios", "comments"],
            shares: ["compartilhamentos", "shares"],
            saves: ["salvamentos", "salvos", "saves"],
            reach: ["alcance", "reach"],
            impressions: ["impressoes", "impressions", "visualizacoes"],
            views: ["visualizacoes", "views"],
            permalink: ["link permanente", "permalink", "link", "url"],
            data_comment: ["comentario de dados", "data_comment"],
          };

          headers.forEach((h, idx) => {
            for (const [field, aliases] of Object.entries(mappings)) {
              if (aliases.some(a => h.includes(a))) {
                if (!colMap[field]) colMap[field] = idx;
              }
            }
          });

          console.log("[InstagramCSV] Column map:", colMap);

          const posts: ParsedPost[] = [];
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2) continue;

            // Only process "Total" rows (Meta CSVs have multiple date breakdowns per post)
            // The "Data" column (index after "Comentário de dados") contains "Total" or a date
            const hasDataColumn = headers.some(h => h === "data" || h === "date");
            if (hasDataColumn) {
              // Find the "Data" column index
              const dataColIdx = headers.findIndex(h => h === "data" || h === "date");
              if (dataColIdx >= 0) {
                const dataVal = String(row[dataColIdx] || "").trim().toLowerCase();
                if (dataVal !== "total") continue;
              }
            }

            const postId = String(row[colMap.post_id] || "").trim();
            if (!postId) continue;

            const post: ParsedPost = {
              post_id: postId,
              post_type: colMap.post_type !== undefined ? String(row[colMap.post_type] || "").trim() : undefined,
              caption: colMap.caption !== undefined ? String(row[colMap.caption] || "").trim() : undefined,
              likes: colMap.likes !== undefined ? parseInt(String(row[colMap.likes])) || 0 : 0,
              comments: colMap.comments !== undefined ? parseInt(String(row[colMap.comments])) || 0 : 0,
              shares: colMap.shares !== undefined ? parseInt(String(row[colMap.shares])) || 0 : 0,
              saves: colMap.saves !== undefined ? parseInt(String(row[colMap.saves])) || 0 : 0,
              reach: colMap.reach !== undefined ? parseInt(String(row[colMap.reach])) || 0 : 0,
              impressions: colMap.impressions !== undefined ? parseInt(String(row[colMap.impressions] || row[colMap.views])) || 0 : 0,
              permalink: colMap.permalink !== undefined ? String(row[colMap.permalink] || "").trim() : undefined,
            };

            // Parse date
            if (colMap.posted_at !== undefined) {
              const rawDate = row[colMap.posted_at];
              if (rawDate) {
                try {
                  const d = new Date(String(rawDate));
                  if (!isNaN(d.getTime())) {
                    post.posted_at = d.toISOString();
                  }
                } catch {}
              }
            }

            // Use views as impressions if impressions not available
            if (!post.impressions && colMap.views !== undefined) {
              post.impressions = parseInt(String(row[colMap.views])) || 0;
            }

            posts.push(post);
          }

          // Deduplicate by post_id (keep highest views/reach)
          const deduped = new Map<string, ParsedPost>();
          for (const p of posts) {
            const existing = deduped.get(p.post_id);
            if (!existing || (p.reach || 0) > (existing.reach || 0)) {
              deduped.set(p.post_id, p);
            }
          }

          console.log(`[InstagramCSV] Parsed ${deduped.size} unique posts from ${rows.length - 1} rows`);
          resolve(Array.from(deduped.values()));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsText(file, "utf-8");
    });
  };

  const handleFile = useCallback(async (file: File) => {
    setParseResult(null);

    try {
      const posts = await parseCSV(file);

      if (posts.length === 0) {
        setParseResult({ success: false, count: 0, error: "Nenhum post encontrado no CSV" });
        return;
      }

      await importMutation.mutateAsync({ clientId, posts });
      setParseResult({ success: true, count: posts.length });
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setParseResult({ 
        success: false, 
        count: 0, 
        error: error instanceof Error ? error.message : "Erro ao processar arquivo" 
      });
    }
  }, [clientId, importMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-pink-500" />
          Importar Posts do Instagram
        </CardTitle>
        <CardDescription>
          Faça upload de um CSV com seus posts do Instagram
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            Arraste o arquivo CSV ou clique para selecionar
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            id="instagram-csv-upload"
            onChange={handleFileInput}
          />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor="instagram-csv-upload" className="cursor-pointer">
              Selecionar Arquivo
            </label>
          </Button>
        </div>

        {importMutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Importando posts...
          </div>
        )}

        {parseResult && (
          <div className={`mt-4 flex items-center gap-2 text-sm ${
            parseResult.success ? "text-green-600" : "text-destructive"
          }`}>
            {parseResult.success ? (
              <>
                <CheckCircle className="h-4 w-4" />
                {parseResult.count} posts importados com sucesso
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                {parseResult.error}
              </>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Colunas aceitas:</p>
          <p>post_id, caption, posted_at, likes, comments, shares, saves, reach, impressions, engagement_rate, thumbnail_url, permalink, post_type</p>
        </div>
      </CardContent>
    </Card>
  );
}
