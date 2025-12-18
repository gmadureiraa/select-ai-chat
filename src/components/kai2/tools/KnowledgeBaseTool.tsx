import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Trash2, Edit, Upload, Loader2, Search, BookOpen, Download, ExternalLink, Link, Globe, Sparkles, Brain, Lightbulb } from "lucide-react";
import { useGlobalKnowledge, KNOWLEDGE_CATEGORIES, KnowledgeCategory, GlobalKnowledge, SemanticSearchResult } from "@/hooks/useGlobalKnowledge";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl, openFileInNewTab, downloadFile } from "@/lib/storage";
import { toast } from "sonner";
import { TagsInput } from "@/components/knowledge/TagsInput";
import { TasksPanel } from "@/components/kai2/TasksPanel";
import { useContextualTasks } from "@/hooks/useContextualTasks";
import { useDebounce } from "@/hooks/useDebounce";

export const KnowledgeBaseTool = () => {
  const { knowledge, isLoading, createKnowledge, updateKnowledge, deleteKnowledge, processKnowledge, searchKnowledge } = useGlobalKnowledge();
  const { tasks, isActive: tasksActive, startTasks, advanceToTask, completeAllTasks } = useContextualTasks();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<GlobalKnowledge | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [addMode, setAddMode] = useState<"pdf" | "url">("pdf");
  const [urlInput, setUrlInput] = useState("");
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("other");
  const [formSourceFile, setFormSourceFile] = useState("");
  const [formSourceUrl, setFormSourceUrl] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formKeyTakeaways, setFormKeyTakeaways] = useState<string[]>([]);
  const [formPageCount, setFormPageCount] = useState<number | null>(null);
  const [formPdfPath, setFormPdfPath] = useState<string | null>(null);
  const [formTags, setFormTags] = useState<string[]>([]);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("other");
    setFormSourceFile("");
    setFormSourceUrl("");
    setFormSummary("");
    setFormKeyTakeaways([]);
    setFormPageCount(null);
    setFormPdfPath(null);
    setFormTags([]);
    setUrlInput("");
  };

  const sanitizeFileName = (name: string) => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    setIsUploading(true);
    startTasks("knowledge-base");
    try {
      advanceToTask("upload");
      const sanitizedName = sanitizeFileName(file.name);
      const { path, signedUrl, error: uploadError } = await uploadAndGetSignedUrl(
        new File([file], `${Date.now()}_${sanitizedName}`, { type: file.type }),
        "knowledge"
      );

      if (uploadError) throw uploadError;

      advanceToTask("extract");
      const { data, error } = await supabase.functions.invoke('extract-pdf', {
        body: { fileUrl: signedUrl, fileName: file.name }
      });

      if (error) throw error;

      advanceToTask("categorize");
      setFormTitle(file.name.replace('.pdf', ''));
      setFormContent(data.content || '');
      setFormSourceFile(file.name);
      setFormPageCount(data.pageCount || null);
      setFormPdfPath(path); // Store path, not signed URL
      
      completeAllTasks();
      toast.success('PDF extraído com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao processar PDF: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error('Preencha título e conteúdo');
      return;
    }

    const inserted = await createKnowledge.mutateAsync({
      title: formTitle,
      content: formContent,
      category: formCategory,
      source_file: formSourceFile || undefined,
      source_url: formSourceUrl || undefined,
      summary: formSummary || undefined,
      key_takeaways: formKeyTakeaways.length > 0 ? formKeyTakeaways : undefined,
      page_count: formPageCount || undefined,
      metadata: formPdfPath ? { pdf_path: formPdfPath } : undefined,
      tags: formTags,
    });

    // Generate embedding for semantic search
    if (inserted?.id) {
      processKnowledge.mutate({
        type: 'embed',
        content: formContent,
        knowledgeId: inserted.id
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleUrlScrape = async () => {
    if (!urlInput.trim()) {
      toast.error('Digite uma URL válida');
      return;
    }

    setIsProcessingUrl(true);
    startTasks("knowledge-base");
    try {
      advanceToTask("upload");
      toast.info('Extraindo conteúdo da URL...');

      const { data, error } = await processKnowledge.mutateAsync({
        type: 'url',
        url: urlInput
      });

      if (error) throw new Error(error);

      advanceToTask("extract");
      setFormTitle(data.title || new URL(urlInput).hostname);
      setFormContent(data.content || '');
      setFormSourceUrl(urlInput);
      setFormSummary(data.summary || '');
      setFormKeyTakeaways(data.keyTakeaways || []);
      
      advanceToTask("categorize");
      completeAllTasks();
      toast.success('Conteúdo extraído e resumido!');
    } catch (error: any) {
      toast.error('Erro ao processar URL: ' + error.message);
    } finally {
      setIsProcessingUrl(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!formContent.trim()) {
      toast.error('Adicione conteúdo primeiro');
      return;
    }

    try {
      toast.info('Gerando resumo com IA...');
      const { data, error } = await processKnowledge.mutateAsync({
        type: 'summarize',
        content: formContent
      });

      if (error) throw new Error(error);

      setFormSummary(data.summary || '');
      setFormKeyTakeaways(data.keyTakeaways || []);
      toast.success('Resumo gerado!');
    } catch (error: any) {
      toast.error('Erro ao gerar resumo: ' + error.message);
    }
  };

  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchKnowledge(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Semantic search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchKnowledge]);

  const debouncedSearch = useDebounce(searchTerm, 500);

  // Trigger semantic search when debounced search term changes
  if (useSemanticSearch && debouncedSearch && debouncedSearch !== searchTerm) {
    handleSemanticSearch(debouncedSearch);
  }

  const handleEdit = (item: GlobalKnowledge) => {
    setSelectedKnowledge(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category);
    setFormSourceFile(item.source_file || "");
    setFormSourceUrl(item.source_url || "");
    setFormSummary(item.summary || "");
    setFormKeyTakeaways(item.key_takeaways || []);
    setFormPageCount(item.page_count);
    setFormTags(item.tags || []);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedKnowledge) return;

    await updateKnowledge.mutateAsync({
      id: selectedKnowledge.id,
      title: formTitle,
      content: formContent,
      category: formCategory,
      summary: formSummary,
      key_takeaways: formKeyTakeaways,
      tags: formTags,
    });

    resetForm();
    setSelectedKnowledge(null);
    setIsEditDialogOpen(false);
  };

  const handleView = (item: GlobalKnowledge) => {
    setSelectedKnowledge(item);
    setIsViewDialogOpen(true);
  };

  const filteredKnowledge = knowledge.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: KnowledgeCategory) => {
    return KNOWLEDGE_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getCategoryConfig = (category: KnowledgeCategory) => {
    const configs: Record<KnowledgeCategory, { bg: string; text: string; border: string }> = {
      copywriting: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
      storytelling: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
      hooks: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
      psychology: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
      structure: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
      engagement: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
      marketing_strategy: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
      growth_hacking: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
      social_media: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
      seo: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/30' },
      branding: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
      analytics: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
      audience: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
      other: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' },
    };
    return configs[category];
  };

  const getPdfPath = (item: GlobalKnowledge) => {
    if (item.metadata && typeof item.metadata === 'object') {
      const meta = item.metadata as { pdf_path?: string; pdf_url?: string };
      return meta.pdf_path || meta.pdf_url || null;
    }
    return null;
  };

  const handleOpenPdf = async (item: GlobalKnowledge) => {
    const pdfPath = getPdfPath(item);
    if (!pdfPath) return;
    await openFileInNewTab(pdfPath);
  };

  const handleDownloadPdf = async (item: GlobalKnowledge) => {
    const pdfPath = getPdfPath(item);
    if (!pdfPath) return;
    await downloadFile(pdfPath, item.source_file || `${item.title}.pdf`);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Base de Conhecimento</h1>
            <p className="text-muted-foreground text-sm">Materiais de referência para IA (PDFs e URLs)</p>
          </div>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={useSemanticSearch ? "Busca semântica..." : "Buscar..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (useSemanticSearch) handleSemanticSearch(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          <Button
            variant={useSemanticSearch ? "default" : "outline"}
            size="icon"
            onClick={() => setUseSemanticSearch(!useSemanticSearch)}
            title="Busca Semântica (IA)"
          >
            <Brain className="h-4 w-4" />
          </Button>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {KNOWLEDGE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredKnowledge.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum conhecimento encontrado</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Adicione PDFs com materiais de referência para melhorar a qualidade do conteúdo gerado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKnowledge.map((item) => {
              const categoryConfig = getCategoryConfig(item.category);
              const hasPdf = !!getPdfPath(item);
              
              return (
                <Card 
                  key={item.id} 
                  className="hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => handleView(item)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg ${categoryConfig.bg} shrink-0`}>
                          <FileText className={`h-4 w-4 ${categoryConfig.text}`} />
                        </div>
                        <CardTitle className="text-sm font-medium line-clamp-2">{item.title}</CardTitle>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(item)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover conhecimento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteKnowledge.mutate(item.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${categoryConfig.bg} ${categoryConfig.text} ${categoryConfig.border}`}>
                        {getCategoryLabel(item.category)}
                      </span>
                      {hasPdf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPdf(item);
                          }}
                        >
                          <FileText className="h-3 w-3" />
                          Abrir PDF
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {item.content.slice(0, 150)}...
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Adicionar Conhecimento</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePDFUpload}
                  className="hidden"
                  id="pdf-upload"
                  disabled={isUploading}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      <TasksPanel 
                        tasks={tasks}
                        isActive={tasksActive}
                        collapsible={false}
                        className="w-full max-w-xs"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">Clique para fazer upload de um PDF</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Nome do material"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formCategory} onValueChange={(v) => setFormCategory(v as KnowledgeCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <ScrollArea className="h-48 border rounded-md p-3">
                  <Textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Conteúdo extraído ou digitado..."
                    className="min-h-[180px] border-0 p-0 focus-visible:ring-0 resize-none"
                  />
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <TagsInput tags={formTags} onChange={setFormTags} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createKnowledge.isPending}>
                {createKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedKnowledge?.title}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {selectedKnowledge && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Badge>{getCategoryLabel(selectedKnowledge.category)}</Badge>
                      {getPdfPath(selectedKnowledge) && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleOpenPdf(selectedKnowledge)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownloadPdf(selectedKnowledge)}
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </Button>
                        </div>
                      )}
                    </div>
                    {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedKnowledge.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-sm prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg border">{selectedKnowledge.content}</pre>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Editar Conhecimento</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formCategory} onValueChange={(v) => setFormCategory(v as KnowledgeCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <ScrollArea className="h-48 border rounded-md p-3">
                  <Textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="min-h-[180px] border-0 p-0 focus-visible:ring-0 resize-none"
                  />
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <TagsInput tags={formTags} onChange={setFormTags} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={updateKnowledge.isPending}>
                {updateKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};