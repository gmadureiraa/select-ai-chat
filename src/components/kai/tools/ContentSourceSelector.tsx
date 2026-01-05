import { Lightbulb, Link2, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceType } from "@/hooks/useContentCreator";
import { MentionableInput } from "@/components/planning/MentionableInput";

interface ContentSourceSelectorProps {
  sourceType: SourceType;
  onSourceTypeChange: (type: SourceType) => void;
  themeInput: string;
  onThemeInputChange: (value: string) => void;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  referenceInput: string;
  onReferenceInputChange: (value: string) => void;
  additionalContext: string;
  onAdditionalContextChange: (value: string) => void;
  clientId?: string;
  disabled?: boolean;
}

export function ContentSourceSelector({
  sourceType,
  onSourceTypeChange,
  themeInput,
  onThemeInputChange,
  urlInput,
  onUrlInputChange,
  referenceInput,
  onReferenceInputChange,
  additionalContext,
  onAdditionalContextChange,
  clientId,
  disabled = false,
}: ContentSourceSelectorProps) {
  return (
    <div className="space-y-4">
      <Tabs value={sourceType} onValueChange={(v) => onSourceTypeChange(v as SourceType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="theme" disabled={disabled} className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Tema
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled} className="gap-2">
            <Link2 className="h-4 w-4" />
            Link
          </TabsTrigger>
          <TabsTrigger value="reference" disabled={disabled} className="gap-2">
            <BookOpen className="h-4 w-4" />
            Referência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Tema ou assunto</Label>
            <Textarea
              id="theme"
              placeholder="Ex: 5 dicas de produtividade para empreendedores, Como criar uma rotina matinal eficiente..."
              value={themeInput}
              onChange={(e) => onThemeInputChange(e.target.value)}
              disabled={disabled}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Descreva o tema ou ideia que deseja transformar em conteúdo
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="url">Link do conteúdo</Label>
            <Input
              id="url"
              placeholder="https://youtube.com/watch?v=... ou https://site.com/artigo"
              value={urlInput}
              onChange={(e) => onUrlInputChange(e.target.value)}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              YouTube, artigos, newsletters ou qualquer página com texto
            </p>
          </div>
        </TabsContent>

        <TabsContent value="reference" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Referências da biblioteca</Label>
            <MentionableInput
              value={referenceInput}
              onChange={onReferenceInputChange}
              placeholder="Use @ para mencionar conteúdos ou referências da biblioteca, ou cole links..."
              clientId={clientId}
              multiline
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Combine @menções da biblioteca com links externos
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Additional context - always visible */}
      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor="additional">Instruções adicionais (opcional)</Label>
        <Textarea
          id="additional"
          placeholder="Ex: Foque em empreendedores iniciantes, use tom informal, inclua estatísticas..."
          value={additionalContext}
          onChange={(e) => onAdditionalContextChange(e.target.value)}
          disabled={disabled}
          className="min-h-[60px] resize-none"
        />
      </div>
    </div>
  );
}
