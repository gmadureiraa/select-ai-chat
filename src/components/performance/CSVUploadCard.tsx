import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CSVColumn {
  name: string;
  required: boolean;
}

interface CSVUploadCardProps {
  title: string;
  description: string;
  columns: CSVColumn[];
  templateName: string;
  onUpload: (data: Record<string, string>[]) => Promise<void>;
  isLoading?: boolean;
}

export const CSVUploadCard = ({
  title,
  description,
  columns,
  templateName,
  onUpload,
  isLoading = false,
}: CSVUploadCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [rowCount, setRowCount] = useState(0);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/['"]/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    return rows;
  };

  const validateCSV = (data: Record<string, string>[]): string | null => {
    if (data.length === 0) {
      return "Arquivo CSV vazio ou inválido";
    }

    const headers = Object.keys(data[0]);
    const requiredColumns = columns.filter((c) => c.required).map((c) => c.name.toLowerCase());
    const missingColumns = requiredColumns.filter(
      (col) => !headers.some((h) => h.includes(col) || col.includes(h))
    );

    if (missingColumns.length > 0) {
      return `Colunas obrigatórias faltando: ${missingColumns.join(", ")}`;
    }

    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setUploadStatus("error");
        setErrorMessage("Por favor, selecione um arquivo CSV");
        return;
      }

      try {
        const text = await file.text();
        const data = parseCSV(text);
        const validationError = validateCSV(data);

        if (validationError) {
          setUploadStatus("error");
          setErrorMessage(validationError);
          return;
        }

        setRowCount(data.length);
        await onUpload(data);
        setUploadStatus("success");
        setErrorMessage("");
      } catch (error) {
        setUploadStatus("error");
        setErrorMessage("Erro ao processar arquivo");
      }
    },
    [columns, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.name).join(",");
    const exampleRow = columns.map((c) => `exemplo_${c.name}`).join(",");
    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetStatus = () => {
    setUploadStatus("idle");
    setErrorMessage("");
    setRowCount(0);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
            <Download className="h-3 w-3 mr-1" />
            Template
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {uploadStatus === "idle" && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById(`csv-input-${templateName}`)?.click()}
          >
            <input
              id={`csv-input-${templateName}`}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
              disabled={isLoading}
            />
            {isLoading ? (
              <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Importando..." : "Arraste o CSV ou clique para selecionar"}
            </p>
          </div>
        )}

        {uploadStatus === "success" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-green-600 font-medium">{rowCount} registros importados</p>
            <Button variant="ghost" size="sm" onClick={resetStatus} className="mt-2 text-xs">
              Importar outro
            </Button>
          </div>
        )}

        {uploadStatus === "error" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-sm text-destructive font-medium">{errorMessage}</p>
            <Button variant="ghost" size="sm" onClick={resetStatus} className="mt-2 text-xs">
              Tentar novamente
            </Button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {columns.map((col) => (
            <span
              key={col.name}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                col.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {col.name}
              {col.required && "*"}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
