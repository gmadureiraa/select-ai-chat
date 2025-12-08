import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, Edit, Upload, Loader2, Search, BookOpen, Download, ExternalLink, Tag } from "lucide-react";
import { useGlobalKnowledge, KNOWLEDGE_CATEGORIES, KnowledgeCategory, GlobalKnowledge } from "@/hooks/useGlobalKnowledge";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { toast } from "sonner";
import { TagsInput } from "@/components/knowledge/TagsInput";

export default function KnowledgeBase() {
  const { knowledge, isLoading, createKnowledge, updateKnowledge, deleteKnowledge } = useGlobalKnowledge();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<GlobalKnowledge | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("other");
  const [formSourceFile, setFormSourceFile] = useState("");
  const [formPageCount, setFormPageCount] = useState<number | null>(null);
  const [formPdfUrl, setFormPdfUrl] = useState<string | null>(null);
  const [formTags, setFormTags] = useState<string[]>([]);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("other");
    setFormSourceFile("");
    setFormPageCount(null);
    setFormPdfUrl(null);
    setFormTags([]);
  };

  // Get all unique tags
  const allTags = Array.from(new Set(knowledge.flatMap(k => k.tags || [])));

  // Sanitize filename for storage (remove special chars, accents, spaces)
  const sanitizeFileName = (name: string) => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .toLowerCase();
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    setIsUploading(true);
    try {
      // Upload to storage with sanitized filename
      const sanitizedName = sanitizeFileName(file.name);
      const { path, signedUrl, error: uploadError } = await uploadAndGetSignedUrl(
        new File([file], `${Date.now()}_${sanitizedName}`, { type: file.type }),
        "knowledge"
      );

      if (uploadError) throw uploadError;

      // Extract PDF content using signed URL
      const { data, error } = await supabase.functions.invoke('extract-pdf', {
        body: { fileUrl: signedUrl, fileName: file.name }
      });

      if (error) throw error;

      setFormTitle(file.name.replace('.pdf', ''));
      setFormContent(data.content || '');
      setFormSourceFile(file.name);
      setFormPageCount(data.pageCount || null);
      setFormPdfUrl(signedUrl);
      
      toast.success('PDF extraído com sucesso! Revise o conteúdo abaixo.');
    } catch (error: any) {
      console.error('PDF upload error:', error);
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

    await createKnowledge.mutateAsync({
      title: formTitle,
      content: formContent,
      category: formCategory,
      source_file: formSourceFile || undefined,
      page_count: formPageCount || undefined,
      metadata: formPdfUrl ? { pdf_url: formPdfUrl } : undefined,
      tags: formTags,
    });

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (item: GlobalKnowledge) => {
    setSelectedKnowledge(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category);
    setFormSourceFile(item.source_file || "");
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
    const matchesTag = filterTag === "all" || (item.tags && item.tags.includes(filterTag));
    return matchesSearch && matchesCategory && matchesTag;
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
      other: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' },
    };
    return configs[category];
  };

  const getPdfUrl = (item: GlobalKnowledge) => {
    if (item.metadata && typeof item.metadata === 'object' && 'pdf_url' in item.metadata) {
      return (item.metadata as { pdf_url?: string }).pdf_url;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Adicione materiais de referência para melhorar a criação de conteúdo"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conhecimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {KNOWLEDGE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[140px]">
                <Tag className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar PDF
        </Button>
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
              Adicione PDFs com materiais de referência sobre copywriting, storytelling, hooks e mais para melhorar a qualidade do conteúdo gerado pela IA.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKnowledge.map((item) => {
            const categoryConfig = getCategoryConfig(item.category);
            const pdfUrl = getPdfUrl(item);
            
            return (
              <Card 
                key={item.id} 
                className="hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => handleView(item)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${categoryConfig.bg} shrink-0`}>
                        <FileText className={`h-4 w-4 ${categoryConfig.text}`} />
                      </div>
                      <CardTitle className="text-sm font-medium line-clamp-2 leading-tight">{item.title}</CardTitle>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                      {pdfUrl && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7" 
                          onClick={() => window.open(pdfUrl, '_blank')}
                          title="Abrir PDF original"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${categoryConfig.bg} ${categoryConfig.text} ${categoryConfig.border}`}>
                      {getCategoryLabel(item.category)}
                    </span>
                    {item.tags?.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.content.slice(0, 180)}...
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    {item.page_count && (
                      <span className="text-[11px] text-muted-foreground/70">
                        ~{item.page_count} páginas
                      </span>
                    )}
                    {pdfUrl && (
                      <span className="text-[11px] text-primary/70 flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        PDF anexado
                      </span>
                    )}
                  </div>
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
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Extraindo conteúdo do PDF...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Clique para fazer upload de um PDF</p>
                    <p className="text-xs text-muted-foreground">O conteúdo será extraído automaticamente</p>
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
              <Label>Conteúdo extraído</Label>
              <ScrollArea className="h-[160px] border rounded-md">
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="O conteúdo do PDF aparecerá aqui após o upload..."
                  className="min-h-[160px] border-0 resize-none"
                />
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagsInput 
                tags={formTags} 
                onChange={setFormTags} 
                placeholder="Adicionar tag..." 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createKnowledge.isPending || !formTitle || !formContent}
            >
              {createKnowledge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
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
              <ScrollArea className="h-[200px] border rounded-md">
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="min-h-[200px] border-0 resize-none"
                />
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagsInput 
                tags={formTags} 
                onChange={setFormTags} 
                placeholder="Adicionar tag..." 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateKnowledge.isPending}>
              {updateKnowledge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedKnowledge?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedKnowledge && (() => {
            const categoryConfig = getCategoryConfig(selectedKnowledge.category);
            const pdfUrl = getPdfUrl(selectedKnowledge);
            
            return (
              <div className="space-y-4">
                <div className="flex items-center flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${categoryConfig.bg} ${categoryConfig.text} ${categoryConfig.border}`}>
                    {getCategoryLabel(selectedKnowledge.category)}
                  </span>
                  {selectedKnowledge.page_count && (
                    <span className="text-sm text-muted-foreground">
                      ~{selectedKnowledge.page_count} páginas
                    </span>
                  )}
                  {selectedKnowledge.source_file && (
                    <span className="text-sm text-muted-foreground">
                      • {selectedKnowledge.source_file}
                    </span>
                  )}
                  {pdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(pdfUrl, '_blank')}
                      className="h-7 text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Abrir PDF original
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[400px] border rounded-md p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {selectedKnowledge.content}
                  </div>
                </ScrollArea>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => { setIsViewDialogOpen(false); handleEdit(selectedKnowledge!); }}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
