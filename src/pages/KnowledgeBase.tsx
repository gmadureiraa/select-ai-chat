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
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, Edit, Upload, Loader2, Search, BookOpen } from "lucide-react";
import { useGlobalKnowledge, KNOWLEDGE_CATEGORIES, KnowledgeCategory, GlobalKnowledge } from "@/hooks/useGlobalKnowledge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const { knowledge, isLoading, createKnowledge, updateKnowledge, deleteKnowledge } = useGlobalKnowledge();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<GlobalKnowledge | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("other");
  const [formSourceFile, setFormSourceFile] = useState("");
  const [formPageCount, setFormPageCount] = useState<number | null>(null);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCategory("other");
    setFormSourceFile("");
    setFormPageCount(null);
  };

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
      const fileName = `knowledge/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('client-files')
        .getPublicUrl(fileName);

      // Extract PDF content
      const { data, error } = await supabase.functions.invoke('extract-pdf', {
        body: { fileUrl: urlData.publicUrl, fileName: file.name }
      });

      if (error) throw error;

      setFormTitle(file.name.replace('.pdf', ''));
      setFormContent(data.content || '');
      setFormSourceFile(file.name);
      setFormPageCount(data.pageCount || null);
      
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
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedKnowledge) return;

    await updateKnowledge.mutateAsync({
      id: selectedKnowledge.id,
      title: formTitle,
      content: formContent,
      category: formCategory,
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

  const getCategoryColor = (category: KnowledgeCategory) => {
    const colors: Record<KnowledgeCategory, string> = {
      copywriting: 'bg-blue-500/20 text-blue-400',
      storytelling: 'bg-purple-500/20 text-purple-400',
      hooks: 'bg-yellow-500/20 text-yellow-400',
      psychology: 'bg-pink-500/20 text-pink-400',
      structure: 'bg-green-500/20 text-green-400',
      engagement: 'bg-cyan-500/20 text-cyan-400',
      other: 'bg-muted text-muted-foreground',
    };
    return colors[category];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Adicione materiais de referência para melhorar a criação de conteúdo"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conhecimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {KNOWLEDGE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {filteredKnowledge.map((item) => (
            <Card 
              key={item.id} 
              className="hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleView(item)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <CardTitle className="text-base line-clamp-1">{item.title}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
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
                <Badge className={getCategoryColor(item.category)}>
                  {getCategoryLabel(item.category)}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.content.slice(0, 200)}...
                </p>
                {item.page_count && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ~{item.page_count} páginas
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
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
              <ScrollArea className="h-[200px] border rounded-md">
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="O conteúdo do PDF aparecerá aqui após o upload..."
                  className="min-h-[200px] border-0 resize-none"
                />
              </ScrollArea>
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
              <ScrollArea className="h-[300px] border rounded-md">
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="min-h-[300px] border-0 resize-none"
                />
              </ScrollArea>
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

          {selectedKnowledge && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getCategoryColor(selectedKnowledge.category)}>
                  {getCategoryLabel(selectedKnowledge.category)}
                </Badge>
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
              </div>

              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {selectedKnowledge.content}
                </div>
              </ScrollArea>
            </div>
          )}

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
