import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, RefreshCw, Loader2, Check, AlertCircle,
  Globe, FileText, ImageIcon, Instagram, Youtube, Tag, AlignLeft
} from "lucide-react";
import { useClientContext, ContextSources } from "@/hooks/useClientContext";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

interface AIContextTabProps {
  clientId: string;
  identityGuide: string | null;
  clientUpdatedAt: string | null;
  onContextUpdate: (context: string) => void;
}

export function AIContextTab({ 
  clientId, 
  identityGuide, 
  clientUpdatedAt,
  onContextUpdate 
}: AIContextTabProps) {
  const [localContext, setLocalContext] = useState(identityGuide || "");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { generateContext, fetchSourceCounts, isGenerating, sources } = useClientContext();
  const { updateClient } = useClients();
  const { toast } = useToast();

  // Fetch source counts on mount
  useEffect(() => {
    fetchSourceCounts(clientId);
  }, [clientId]);

  // Sync with prop changes
  useEffect(() => {
    setLocalContext(identityGuide || "");
  }, [identityGuide]);

  const handleGenerate = async () => {
    const newContext = await generateContext(clientId);
    if (newContext) {
      setLocalContext(newContext);
      onContextUpdate(newContext);
      setHasUnsavedChanges(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClient.mutateAsync({
        id: clientId,
        identity_guide: localContext,
      });
      onContextUpdate(localContext);
      setHasUnsavedChanges(false);
      toast({
        title: "Contexto salvo",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o contexto.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContextChange = (value: string) => {
    setLocalContext(value);
    setHasUnsavedChanges(value !== identityGuide);
  };

  const formatLastUpdate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    const date = new Date(dateStr);
    return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getSourceStatus = (count: number, label: string, Icon: React.ElementType) => {
    const isAvailable = count > 0;
    return (
      <div className={`flex items-center gap-2 text-sm ${isAvailable ? "text-foreground" : "text-muted-foreground"}`}>
        {isAvailable ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
        )}
        <Icon className="h-4 w-4" />
        <span>
          {isAvailable ? `${count} ${label}` : `Sem ${label.toLowerCase()}`}
        </span>
      </div>
    );
  };

  const totalSources = sources
    ? (sources.hasDescription ? 1 : 0) +
      (sources.hasTags ? 1 : 0) +
      sources.websitesCount +
      sources.documentsCount +
      sources.contentCount +
      sources.referencesCount +
      sources.instagramCount +
      sources.youtubeCount
    : 0;

  return (
    <div className="space-y-4">
      {/* Data Sources Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Fontes de Dados para Contexto
          </CardTitle>
          <CardDescription>
            O contexto é gerado analisando todo o material disponível do cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`flex items-center gap-2 text-sm ${sources?.hasDescription ? "text-foreground" : "text-muted-foreground"}`}>
              {sources?.hasDescription ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
              )}
              <AlignLeft className="h-4 w-4" />
              <span>Descrição</span>
            </div>
            
            <div className={`flex items-center gap-2 text-sm ${sources?.hasTags ? "text-foreground" : "text-muted-foreground"}`}>
              {sources?.hasTags ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
              )}
              <Tag className="h-4 w-4" />
              <span>Posicionamento</span>
            </div>
            
            {sources && getSourceStatus(sources.websitesCount, "websites", Globe)}
            {sources && getSourceStatus(sources.documentsCount, "documentos", FileText)}
            {sources && getSourceStatus(sources.contentCount, "conteúdos", FileText)}
            {sources && getSourceStatus(sources.referencesCount, "referências", ImageIcon)}
            {sources && getSourceStatus(sources.instagramCount, "posts Instagram", Instagram)}
            {sources && getSourceStatus(sources.youtubeCount, "vídeos YouTube", Youtube)}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{totalSources}</span> fontes disponíveis para análise
            </div>
            <div className="text-sm text-muted-foreground">
              Última atualização: {formatLastUpdate(clientUpdatedAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando fontes...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              {localContext ? "Regenerar Contexto" : "Gerar Contexto com IA"}
            </>
          )}
        </Button>

        {hasUnsavedChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="outline"
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        )}

        {hasUnsavedChanges && (
          <Badge variant="secondary" className="text-xs">
            Alterações não salvas
          </Badge>
        )}
      </div>

      {/* Context Editor */}
      <Card className={localContext ? "border-primary/20" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {localContext ? "Contexto Gerado" : "Nenhum contexto gerado"}
          </CardTitle>
          <CardDescription>
            {localContext 
              ? "Este documento é usado pela IA para criar todo o conteúdo do cliente. Você pode editá-lo manualmente."
              : "Clique em 'Gerar Contexto com IA' para criar o documento automaticamente a partir das fontes disponíveis."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {localContext ? (
            <Textarea
              value={localContext}
              onChange={(e) => handleContextChange(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="O contexto aparecerá aqui após a geração..."
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
              <Sparkles className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-medium text-lg mb-2">Nenhum contexto gerado ainda</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                O Contexto de IA é um documento completo que a IA usa para criar conteúdo 
                perfeitamente alinhado com a marca do cliente. Ele é gerado automaticamente 
                analisando todas as fontes de dados disponíveis.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar Contexto Agora
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
