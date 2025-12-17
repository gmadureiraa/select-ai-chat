import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  FileSpreadsheet,
  Bot,
  ArrowRight,
  Check,
  X,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ValidationResult, CSVWarning } from "@/hooks/useCSVValidation";

interface CSVValidationAgentProps {
  validationResults: ValidationResult[];
  onProceed: () => void;
  onCancel: () => void;
  onApplyFix?: (fileIndex: number, warningIndex: number) => void;
  isImporting?: boolean;
}

interface AgentMessage {
  type: "info" | "warning" | "error" | "success" | "question";
  content: string;
  actions?: { label: string; action: string; variant?: "default" | "outline" | "destructive" }[];
}

export function CSVValidationAgent({
  validationResults,
  onProceed,
  onCancel,
  onApplyFix,
  isImporting
}: CSVValidationAgentProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set([0]));
  const [showPreview, setShowPreview] = useState<Set<number>>(new Set());
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const toggleExpanded = (index: number) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const togglePreview = (index: number) => {
    setShowPreview(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApplyFix = (fileIndex: number, warningIndex: number, warningType: string) => {
    const key = `${fileIndex}-${warningIndex}`;
    setAppliedFixes(prev => new Set(prev).add(key));
    onApplyFix?.(fileIndex, warningIndex);
  };

  // Generate agent messages based on validation results
  const generateAgentMessages = (): AgentMessage[] => {
    const messages: AgentMessage[] = [];
    
    const totalFiles = validationResults.length;
    const validFiles = validationResults.filter(r => r.isValid).length;
    const totalWarnings = validationResults.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalErrors = validationResults.reduce((sum, r) => sum + r.errors.length, 0);
    const totalRows = validationResults.reduce((sum, r) => sum + r.validRows, 0);
    
    // Initial summary
    if (totalErrors > 0) {
      messages.push({
        type: "error",
        content: `Encontrei ${totalErrors} erro(s) crítico(s) que impedem a importação. Por favor, corrija os problemas antes de continuar.`
      });
    } else if (totalWarnings > 0) {
      messages.push({
        type: "warning",
        content: `Analisei ${totalFiles} arquivo(s) e encontrei ${totalWarnings} aviso(s). Você pode revisar e decidir como proceder.`
      });
    } else {
      messages.push({
        type: "success",
        content: `Perfeito! ${totalFiles} arquivo(s) analisado(s) com ${totalRows} registros válidos. Tudo pronto para importar.`
      });
    }
    
    // Check for absolute followers
    const hasAbsoluteFollowers = validationResults.some(r => r.needsConversion);
    if (hasAbsoluteFollowers) {
      messages.push({
        type: "question",
        content: "Detectei que os dados de seguidores parecem ser valores absolutos (total de seguidores), não incrementais (novos seguidores por dia). Posso calcular automaticamente os valores diários para você?",
        actions: [
          { label: "Sim, calcular", action: "convert_followers", variant: "default" },
          { label: "Não, manter como está", action: "keep_absolute", variant: "outline" }
        ]
      });
    }
    
    return messages;
  };

  const messages = generateAgentMessages();
  const hasErrors = validationResults.some(r => r.errors.length > 0);
  const canProceed = !hasErrors;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "posts": return "📱";
      case "reach": return "👁️";
      case "followers": 
      case "followers_absolute": return "👥";
      case "views": return "👀";
      case "interactions": return "💬";
      case "profile_visits": return "🏠";
      case "link_clicks": return "🔗";
      default: return "📄";
    }
  };

  const getStatusIcon = (result: ValidationResult) => {
    if (result.errors.length > 0) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (result.warnings.length > 0) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Agent Chat Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span>Agente de Validação</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AnimatePresence>
            {messages.map((message, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-3 rounded-lg text-sm ${
                  message.type === "error" ? "bg-destructive/10 border border-destructive/20" :
                  message.type === "warning" ? "bg-yellow-500/10 border border-yellow-500/20" :
                  message.type === "success" ? "bg-green-500/10 border border-green-500/20" :
                  message.type === "question" ? "bg-primary/10 border border-primary/20" :
                  "bg-muted"
                }`}
              >
                <div className="flex gap-2">
                  {message.type === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  {message.type === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />}
                  {message.type === "success" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                  {message.type === "question" && <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  {message.type === "info" && <Bot className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p>{message.content}</p>
                    {message.actions && (
                      <div className="flex gap-2 mt-2">
                        {message.actions.map((action, actionIdx) => (
                          <Button 
                            key={actionIdx} 
                            size="sm" 
                            variant={action.variant || "default"}
                            className="h-7 text-xs"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Files Validation List */}
      <div className="space-y-2">
        {validationResults.map((result, fileIdx) => (
          <Card key={fileIdx} className={`overflow-hidden ${
            result.errors.length > 0 ? "border-destructive/30" :
            result.warnings.length > 0 ? "border-yellow-500/30" :
            "border-green-500/30"
          }`}>
            {/* File Header */}
            <div 
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(fileIdx)}
            >
              {getStatusIcon(result)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{result.fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{getTypeIcon(result.detectedType)}</span>
                  <span>{result.detectedTypeLabel}</span>
                  <span>•</span>
                  <span>{result.validRows} registros</span>
                  {result.confidence > 0 && (
                    <>
                      <span>•</span>
                      <span>{result.confidence}% confiança</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {result.warnings.length > 0 && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">
                    {result.warnings.length} aviso{result.warnings.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {result.errors.length > 0 && (
                  <Badge variant="destructive">
                    {result.errors.length} erro{result.errors.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {expandedFiles.has(fileIdx) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
              {expandedFiles.has(fileIdx) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-3 pb-3 space-y-3 border-t">
                    {/* Errors */}
                    {result.errors.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-destructive">Erros:</p>
                        {result.errors.map((error, errIdx) => (
                          <div key={errIdx} className="p-2 bg-destructive/10 rounded text-xs">
                            <p className="font-medium">{error.message}</p>
                            {error.details && <p className="text-muted-foreground mt-1">{error.details}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings with Actions */}
                    {result.warnings.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-yellow-600">Avisos:</p>
                        {result.warnings.map((warning, warnIdx) => {
                          const fixKey = `${fileIdx}-${warnIdx}`;
                          const isFixed = appliedFixes.has(fixKey);
                          
                          return (
                            <div 
                              key={warnIdx} 
                              className={`p-2 rounded text-xs flex items-start justify-between gap-2 ${
                                isFixed ? "bg-green-500/10" : "bg-yellow-500/10"
                              }`}
                            >
                              <div className="flex-1">
                                <p className={isFixed ? "line-through text-muted-foreground" : ""}>
                                  {warning.message}
                                </p>
                                {warning.suggestedFix && !isFixed && (
                                  <p className="text-muted-foreground mt-1">
                                    Sugestão: {warning.suggestedFix}
                                  </p>
                                )}
                              </div>
                              {warning.autoFixable && !isFixed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplyFix(fileIdx, warnIdx, warning.type);
                                  }}
                                >
                                  <Wand2 className="h-3 w-3 mr-1" />
                                  Corrigir
                                </Button>
                              )}
                              {isFixed && (
                                <Badge variant="outline" className="text-green-600 border-green-500/30">
                                  <Check className="h-3 w-3 mr-1" />
                                  Corrigido
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Preview Table Toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreview(fileIdx);
                      }}
                    >
                      {showPreview.has(fileIdx) ? (
                        <>Ocultar Preview</>
                      ) : (
                        <>Ver Preview dos Dados ({result.previewData.length} primeiras linhas)</>
                      )}
                    </Button>

                    {/* Preview Table */}
                    <AnimatePresence>
                      {showPreview.has(fileIdx) && result.previewData.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <ScrollArea className="h-48 border rounded">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  <th className="p-2 text-left font-medium">#</th>
                                  {Object.keys(result.previewData[0]?.data || {}).slice(0, 4).map((col, colIdx) => (
                                    <th key={colIdx} className="p-2 text-left font-medium truncate max-w-24">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {result.previewData.map((row, rowIdx) => (
                                  <tr 
                                    key={rowIdx} 
                                    className={`border-t ${row.hasWarning ? "bg-yellow-500/5" : ""}`}
                                  >
                                    <td className="p-2 text-muted-foreground">{row.rowNumber}</td>
                                    {Object.values(row.data).slice(0, 4).map((val, valIdx) => (
                                      <td key={valIdx} className="p-2 truncate max-w-24">
                                        {val}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isImporting}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button
          onClick={onProceed}
          disabled={!canProceed || isImporting}
          className="flex-1"
        >
          {isImporting ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              Importando...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-2" />
              Importar {validationResults.reduce((sum, r) => sum + r.validRows, 0)} registros
            </>
          )}
        </Button>
      </div>

      {/* Progress bar during import */}
      {isImporting && (
        <Progress value={undefined} className="h-1" />
      )}
    </div>
  );
}
