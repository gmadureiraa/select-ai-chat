import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { useImportInstagramPostsCSV } from "@/hooks/useInstagramPosts";

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

  const parseCSV = (text: string): ParsedPost[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
    const posts: ParsedPost[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/['"]/g, ""));
      if (values.length < 2) continue;

      const post: ParsedPost = { post_id: "" };

      headers.forEach((header, idx) => {
        const value = values[idx];
        if (!value) return;

        switch (header) {
          case "post_id":
          case "id":
            post.post_id = value;
            break;
          case "post_type":
          case "type":
          case "tipo":
            post.post_type = value.toLowerCase();
            break;
          case "caption":
          case "legenda":
          case "texto":
            post.caption = value;
            break;
          case "posted_at":
          case "data":
          case "date":
          case "published_at":
            post.posted_at = value;
            break;
          case "likes":
          case "curtidas":
            post.likes = parseInt(value) || 0;
            break;
          case "comments":
          case "comentarios":
          case "comentários":
            post.comments = parseInt(value) || 0;
            break;
          case "shares":
          case "compartilhamentos":
            post.shares = parseInt(value) || 0;
            break;
          case "saves":
          case "salvos":
            post.saves = parseInt(value) || 0;
            break;
          case "reach":
          case "alcance":
            post.reach = parseInt(value) || 0;
            break;
          case "impressions":
          case "impressoes":
          case "impressões":
            post.impressions = parseInt(value) || 0;
            break;
          case "engagement_rate":
          case "engajamento":
          case "eng":
            post.engagement_rate = parseFloat(value) || 0;
            break;
          case "thumbnail_url":
          case "thumbnail":
          case "imagem":
            post.thumbnail_url = value;
            break;
          case "permalink":
          case "link":
          case "url":
            post.permalink = value;
            break;
        }
      });

      // Generate post_id if not provided
      if (!post.post_id) {
        post.post_id = `post_${i}_${Date.now()}`;
      }

      posts.push(post);
    }

    return posts;
  };

  const handleFile = useCallback(async (file: File) => {
    setParseResult(null);

    try {
      const text = await file.text();
      const posts = parseCSV(text);

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
