import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, Sparkles, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiInvoke } from '../../lib/apiInvoke';

interface ContentGuidelinesCardProps {
  clientId: string;
  initialGuidelines: string | null;
  onUpdate?: (guidelines: string) => void;
}

const PLACEHOLDER_GUIDELINES = `Exemplos de regras práticas:

• Sempre começar posts com uma provocação ou pergunta
• Nunca usar mais de 3 hashtags no Instagram
• Preferir dados e números a opiniões genéricas
• Usar parágrafos curtos (máx 2 linhas)
• Tom direto, sem rodeios — como conversa entre amigos
• Evitar jargões corporativos como "sinergia", "alavancagem"
• CTAs sempre no imperativo: "Salve", "Compartilhe", "Comente"
• Incluir pelo menos 1 exemplo ou caso real por conteúdo`;

export function ContentGuidelinesCard({ clientId, initialGuidelines, onUpdate }: ContentGuidelinesCardProps) {
  const [guidelines, setGuidelines] = useState(initialGuidelines || "");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setGuidelines(initialGuidelines || "");
    setHasUnsavedChanges(false);
  }, [initialGuidelines]);

  const handleChange = useCallback((value: string) => {
    setGuidelines(value);
    setHasUnsavedChanges(value !== (initialGuidelines || ""));
  }, [initialGuidelines]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // P0 fix audit 2026-05-16: troca supabase.from('clients').update por
      // /api/client-update (auth + assertClientAccess + Zod).
      const { error } = await apiInvoke("client-update", {
        body: { client_id: clientId, content_guidelines: guidelines },
      });
      if (error) throw new Error(error.message || "Erro ao salvar guia");

      setHasUnsavedChanges(false);
      onUpdate?.(guidelines);
      toast({ title: "Guia salvo", description: "As diretrizes de criação foram atualizadas." });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar o guia.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await apiInvoke("generate-content-guidelines", {
        body: { clientId },
      });

      if (error) throw error;
      if (data?.guidelines) {
        setGuidelines(data.guidelines);
        setHasUnsavedChanges(true);
        toast({ title: "Guia gerado!", description: "Revise e salve as diretrizes sugeridas pela IA." });
      }
    } catch (error) {
      toast({
        title: "Erro ao gerar guia",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className={guidelines ? "border-primary/20" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Guia de Criação de Conteúdo
            </CardTitle>
            <CardDescription className="mt-1">
              Regras práticas que a IA segue ao criar conteúdo para este cliente
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Não salvo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={guidelines}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={PLACEHOLDER_GUIDELINES}
          className="min-h-[200px] text-sm"
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Gerar com IA
              </>
            )}
          </Button>

          {hasUnsavedChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
