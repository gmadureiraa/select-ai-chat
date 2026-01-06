import { useState } from "react";
import { 
  Sparkles, 
  Loader2, 
  Link2, 
  Image as ImageIcon, 
  Video, 
  BookOpen,
  X,
  Clock,
  ArrowLeft,
  Calendar,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useBulkContentCreator } from "@/hooks/useBulkContentCreator";
import { FormatQuantitySelector } from "./FormatQuantitySelector";
import { BulkContentCard } from "./BulkContentCard";
import { BulkProgressGrid } from "./BulkProgressGrid";
import { MentionableInput } from "@/components/planning/MentionableInput";
import { useNavigate } from "react-router-dom";

interface BulkContentCreatorProps {
  clientId: string;
}

export function BulkContentCreator({ clientId }: BulkContentCreatorProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState("");
  const [showResults, setShowResults] = useState(false);

  const {
    briefing,
    setBriefing,
    attachments,
    addAttachment,
    removeAttachment,
    formatQuantities,
    updateQuantity,
    autoAddToPlanning,
    setAutoAddToPlanning,
    targetColumnId,
    setTargetColumnId,
    columns,
    totalItems,
    timeEstimate,
    isGenerating,
    generatedItems,
    generateAll,
    sendToPlanning,
    discardItem,
    reset,
  } = useBulkContentCreator();

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addAttachment({ type: 'url', value: urlInput.trim(), name: urlInput.trim() });
    setUrlInput("");
  };

  const handleAddLibraryRef = (ref: string) => {
    if (!ref.trim()) return;
    addAttachment({ type: 'library', value: ref, name: 'Referência da biblioteca' });
  };

  const handleGenerate = async () => {
    if (!clientId) {
      toast({
        title: "Cliente necessário",
        description: "Selecione um cliente para gerar conteúdos",
        variant: "destructive",
      });
      return;
    }

    if (totalItems === 0) {
      toast({
        title: "Formatos necessários",
        description: "Selecione pelo menos um formato e quantidade",
        variant: "destructive",
      });
      return;
    }

    if (!briefing.trim()) {
      toast({
        title: "Briefing necessário",
        description: "Descreva o que você quer criar",
        variant: "destructive",
      });
      return;
    }

    setShowResults(true);
    await generateAll(clientId);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleReset = () => {
    reset();
    setShowResults(false);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min`;
  };

  const addedToPlanningCount = generatedItems.filter(i => i.addedToPlanning).length;

  // Results view
  if (showResults) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Conteúdos em Massa</h1>
              <p className="text-muted-foreground">
                {isGenerating 
                  ? `Gerando ${generatedItems.filter(i => i.status === 'done').length + 1}/${generatedItems.length}`
                  : `${generatedItems.filter(i => i.status === 'done').length} conteúdos prontos`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {addedToPlanningCount > 0 && (
              <Button 
                variant="default" 
                onClick={() => navigate('/kaleidos?tab=planning')}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Ver Planejamento ({addedToPlanningCount})
              </Button>
            )}
            <Button variant="outline" onClick={handleReset}>
              Novo Lote
            </Button>
          </div>
        </div>

        {/* Progress */}
        {isGenerating && (
          <BulkProgressGrid items={generatedItems} isGenerating={isGenerating} />
        )}

        {/* Results Grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {generatedItems.map((item) => (
            <BulkContentCard
              key={item.id}
              item={item}
              onCopy={handleCopy}
              onSendToPlanning={(id) => sendToPlanning(id, clientId)}
              onDiscard={discardItem}
            />
          ))}
        </div>

        {/* Send all remaining */}
        {!isGenerating && generatedItems.some(i => i.status === 'done' && !i.addedToPlanning) && (
          <div className="flex justify-center">
            <Button
              onClick={() => {
                generatedItems
                  .filter(i => i.status === 'done' && !i.addedToPlanning)
                  .forEach(i => sendToPlanning(i.id, clientId));
              }}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar todos para Planejamento
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Input view
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Criador em Massa</h1>
          <p className="text-muted-foreground">
            Gere múltiplos conteúdos de uma vez, em paralelo
          </p>
        </div>
      </div>

      {/* Briefing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📝 O que você quer criar?</CardTitle>
          <CardDescription>
            Descreva a demanda principal. Use @menções para referenciar materiais da biblioteca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MentionableInput
            value={briefing}
            onChange={setBriefing}
            clientId={clientId}
            placeholder="Ex: Preciso de conteúdos sobre produtividade... Use @ para mencionar materiais da biblioteca"
            className="min-h-[120px]"
            multiline
            rows={5}
          />

          {/* Attachments */}
          <div className="space-y-3">
            <p className="text-sm font-medium">📎 Materiais de apoio (opcional)</p>
            
            {/* URL input */}
            <div className="flex gap-2">
              <Input
                placeholder="Cole um link para extrair conteúdo..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isGenerating}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleAddUrl}
                disabled={!urlInput.trim() || isGenerating}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Attached items */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="gap-1.5 pr-1"
                  >
                    {att.type === 'url' && <Link2 className="h-3 w-3" />}
                    {att.type === 'image' && <ImageIcon className="h-3 w-3" />}
                    {att.type === 'video' && <Video className="h-3 w-3" />}
                    {att.type === 'library' && <BookOpen className="h-3 w-3" />}
                    <span className="max-w-[150px] truncate">{att.name || att.value}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:bg-destructive/20"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Format Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📦 Quantos conteúdos de cada formato?</CardTitle>
          <CardDescription>
            Clique nos números para definir a quantidade de cada tipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormatQuantitySelector
            formatQuantities={formatQuantities}
            onUpdateQuantity={updateQuantity}
            disabled={isGenerating}
          />
        </CardContent>
      </Card>

      {/* Planning Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📅 Destino dos conteúdos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Adicionar automaticamente ao planejamento</Label>
              <p className="text-xs text-muted-foreground">
                Conteúdos gerados irão para a coluna selecionada
              </p>
            </div>
            <Switch
              checked={autoAddToPlanning}
              onCheckedChange={setAutoAddToPlanning}
              disabled={isGenerating}
            />
          </div>

          {autoAddToPlanning && columns.length > 0 && (
            <div className="space-y-2">
              <Label>Coluna de destino</Label>
              <Select
                value={targetColumnId || columns.find(c => c.column_type === 'draft')?.id || columns[0]?.id}
                onValueChange={setTargetColumnId}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary & Generate */}
      <Card className={cn(
        "border-2 transition-all",
        totalItems > 0 ? "border-primary bg-primary/5" : "border-muted"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-muted-foreground">conteúdos</p>
              </div>
              {totalItems > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{formatTime(timeEstimate)}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || totalItems === 0 || !briefing.trim()}
              size="lg"
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar {totalItems} Conteúdo{totalItems !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
