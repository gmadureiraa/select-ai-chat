import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet, ChevronDown, ChevronUp, Wand2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ValidationResult } from "@/hooks/useCSVValidation";

interface KAICSVValidationCardProps {
  validationResults: ValidationResult[];
  onProceed: () => void;
  onCancel: () => void;
  onApplyFix?: (fileIndex: number, warningIndex: number) => void;
  isImporting?: boolean;
}

export function KAICSVValidationCard({
  validationResults,
  onProceed,
  onCancel,
  onApplyFix,
  isImporting = false,
}: KAICSVValidationCardProps) {
  const [expandedFile, setExpandedFile] = useState<number | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const totalErrors = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = validationResults.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalRows = validationResults.reduce((sum, r) => sum + r.validRows, 0);
  const hasErrors = totalErrors > 0;

  const handleApplyFix = (fileIndex: number, warningIndex: number) => {
    const key = `${fileIndex}-${warningIndex}`;
    setAppliedFixes(prev => new Set(prev).add(key));
    onApplyFix?.(fileIndex, warningIndex);
  };

  const getStatusIcon = () => {
    if (hasErrors) return <XCircle className="h-5 w-5 text-destructive" />;
    if (totalWarnings > 0) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  const getStatusMessage = () => {
    if (hasErrors) {
      return `${totalErrors} erro(s) crítico(s) encontrado(s). Corrija antes de importar.`;
    }
    if (totalWarnings > 0) {
      return `${validationResults.length} arquivo(s) analisado(s), ${totalWarnings} aviso(s). ${totalRows} registros válidos.`;
    }
    return `Tudo pronto! ${totalRows} registros válidos para importar.`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-lg overflow-hidden max-w-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Validação de CSV</p>
          <p className="text-xs text-muted-foreground truncate">
            {validationResults.map(r => r.fileName).join(", ")}
          </p>
        </div>
        {getStatusIcon()}
      </div>

      {/* Status Message */}
      <div className="p-3 border-b">
        <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
      </div>

      {/* File Results */}
      <ScrollArea className="max-h-48">
        {validationResults.map((result, fileIdx) => (
          <div key={fileIdx} className="border-b last:border-0">
            <button
              onClick={() => setExpandedFile(expandedFile === fileIdx ? null : fileIdx)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{result.fileName}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {result.detectedType}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {result.errors.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {result.errors.length} erros
                  </Badge>
                )}
                {result.warnings.length > 0 && (
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {result.warnings.length} avisos
                  </Badge>
                )}
                {expandedFile === fileIdx ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {expandedFile === fileIdx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2">
                    {/* Errors */}
                    {result.errors.map((error, errIdx) => (
                      <div key={errIdx} className="flex items-start gap-2 text-xs p-2 bg-destructive/10 rounded">
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <span className="text-destructive">{error.message}</span>
                      </div>
                    ))}

                    {/* Warnings with fix buttons */}
                    {result.warnings.map((warning, warnIdx) => {
                      const isFixed = appliedFixes.has(`${fileIdx}-${warnIdx}`);
                      return (
                        <div
                          key={warnIdx}
                          className={cn(
                            "flex items-start gap-2 text-xs p-2 rounded",
                            isFixed ? "bg-green-500/10" : "bg-amber-500/10"
                          )}
                        >
                          {isFixed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <span className={isFixed ? "text-green-600" : "text-amber-600"}>
                            {warning.message}
                          </span>
                          {warning.autoFixable && !isFixed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] ml-auto shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplyFix(fileIdx, warnIdx);
                              }}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              Corrigir
                            </Button>
                          )}
                        </div>
                      );
                    })}

                    {/* Preview hint */}
                    {result.previewData.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Preview: {result.previewData.length} linhas disponíveis para revisão
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 p-3 border-t bg-muted/30">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onProceed}
          disabled={hasErrors || isImporting}
          className={cn(hasErrors && "opacity-50 cursor-not-allowed")}
        >
          <Upload className="h-4 w-4 mr-1" />
          {isImporting ? "Importando..." : `Importar ${totalRows} registros`}
        </Button>
      </div>
    </motion.div>
  );
}
