// MetricoolLinkinBioEditor — gestão da página linkin bio do Instagram.
// - Lista botões + catálogo de imagens
// - Adicionar / editar / remover botões
// - Drag-drop pra reordenar (chama updateButtonPosition por item)
// - Preview visual do mock da página
import { useEffect, useMemo, useState } from 'react';
import {
  useMetricoolLinkinBio,
  useAddMetricoolBioButton,
  useEditMetricoolBioButton,
  useReorderMetricoolBioButton,
  useDeleteMetricoolBioButton,
  useEditMetricoolBioCatalog,
  useDeleteMetricoolBioCatalog,
  type MetricoolBioButton,
  type MetricoolBioCatalogItem,
} from '@/hooks/useMetricoolLinkinBio';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2,
  Link as LinkIcon,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  Save,
  X,
  ImageIcon,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  clientId: string;
}

interface SortableButtonRowProps {
  button: MetricoolBioButton;
  editing: boolean;
  draftLink: string;
  draftText: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onChangeLink: (v: string) => void;
  onChangeText: (v: string) => void;
  onDelete: () => void;
}

function SortableButtonRow({
  button,
  editing,
  draftLink,
  draftText,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onChangeLink,
  onChangeText,
  onDelete,
}: SortableButtonRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(button.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 rounded-md border bg-background"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        {editing ? (
          <div className="space-y-2">
            <Input
              placeholder="Texto do botão"
              value={draftText}
              onChange={(e) => onChangeText(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="https://..."
              value={draftLink}
              onChange={(e) => onChangeLink(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
        ) : (
          <>
            <div className="font-medium text-sm truncate">{button.text || '(sem texto)'}</div>
            {button.link && (
              <a
                href={button.link}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:underline truncate block max-w-full"
                title={button.link}
              >
                <ExternalLink className="h-3 w-3 inline-block mr-1" />
                {button.link}
              </a>
            )}
            {button.shortUrl && (
              <span className="text-[10px] font-mono text-emerald-600 truncate block">
                {button.shortUrl}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onSave}
              disabled={saving}
              title="Salvar"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onCancelEdit}
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onStartEdit}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Deletar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function MetricoolLinkinBioEditor({ clientId }: Props) {
  const { toast } = useToast();
  const { data, isLoading, error } = useMetricoolLinkinBio(clientId);
  const addBtn = useAddMetricoolBioButton(clientId);
  const editBtn = useEditMetricoolBioButton(clientId);
  const reorderBtn = useReorderMetricoolBioButton(clientId);
  const deleteBtn = useDeleteMetricoolBioButton(clientId);
  const editCat = useEditMetricoolBioCatalog(clientId);
  const deleteCat = useDeleteMetricoolBioCatalog(clientId);

  const remoteButtons = data?.buttons || [];
  const catalog = data?.catalog || [];

  // Order local pra drag-drop
  const [localOrder, setLocalOrder] = useState<MetricoolBioButton[]>([]);
  useEffect(() => {
    const sorted = [...remoteButtons].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    setLocalOrder(sorted);
  }, [remoteButtons]);

  // Edit state
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [draftLink, setDraftLink] = useState('');
  const [draftText, setDraftText] = useState('');

  // New button form
  const [newText, setNewText] = useState('');
  const [newLink, setNewLink] = useState('');

  // Catalog edit state
  const [catEditId, setCatEditId] = useState<number | string | null>(null);
  const [catDraftLink, setCatDraftLink] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.findIndex((b) => String(b.id) === String(active.id));
    const newIndex = localOrder.findIndex((b) => String(b.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(newOrder);
    // Metricool API tem só "updateButtonPosition" por itemid (sem position numérica).
    // Estratégia: chama o endpoint pro item movido — back-end gerencia ordering.
    try {
      await reorderBtn.mutateAsync({ itemid: active.id });
      toast({ title: 'Ordem atualizada' });
    } catch (e: any) {
      toast({
        title: 'Erro ao reordenar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleAddButton = async () => {
    if (!newText.trim() || !newLink.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha texto e link.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await addBtn.mutateAsync({ textButton: newText.trim(), link: newLink.trim() });
      setNewText('');
      setNewLink('');
      toast({ title: 'Botão adicionado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao adicionar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleStartEdit = (b: MetricoolBioButton) => {
    setEditingId(b.id);
    setDraftLink(b.link || '');
    setDraftText(b.text || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraftLink('');
    setDraftText('');
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    try {
      await editBtn.mutateAsync({
        itemid: editingId,
        link: draftLink.trim() || undefined,
        text: draftText.trim() || undefined,
      });
      handleCancelEdit();
      toast({ title: 'Botão atualizado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteButton = async (id: number | string) => {
    if (!confirm('Deletar este botão?')) return;
    try {
      await deleteBtn.mutateAsync({ itemid: id });
      toast({ title: 'Botão deletado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao deletar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handlePublish = () => {
    // As mutations já chamam a API direto — "publicar" é ré-fetch + feedback.
    toast({
      title: 'Linkin Bio sincronizada',
      description: 'Mudanças já estão no ar pelo Metricool.',
    });
  };

  const handleSaveCatalog = async () => {
    if (catEditId == null) return;
    try {
      await editCat.mutateAsync({ itemid: catEditId, link: catDraftLink.trim() });
      setCatEditId(null);
      setCatDraftLink('');
      toast({ title: 'Link atualizado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCatalog = async (id: number | string) => {
    if (!confirm('Remover esta imagem do linkin bio?')) return;
    try {
      await deleteCat.mutateAsync({ itemid: id });
      toast({ title: 'Imagem removida' });
    } catch (e: any) {
      toast({
        title: 'Erro ao remover',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const ids = useMemo(() => localOrder.map((b) => String(b.id)), [localOrder]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Linkin Bio (Instagram)
          </CardTitle>
          <CardDescription>
            Gerencie os links da bio do Instagram via Metricool. Reordene arrastando.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="buttons" className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList>
                <TabsTrigger value="buttons">
                  <LinkIcon className="h-3 w-3 mr-1" /> Botões ({localOrder.length})
                </TabsTrigger>
                <TabsTrigger value="catalog">
                  <ImageIcon className="h-3 w-3 mr-1" /> Catálogo ({catalog.length})
                </TabsTrigger>
              </TabsList>
              <Button size="sm" onClick={handlePublish} variant="default">
                <Save className="h-3.5 w-3.5 mr-1" /> Publicar
              </Button>
            </div>

            {/* BUTTONS */}
            <TabsContent value="buttons" className="space-y-4">
              <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Novo botão
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lb-text">Texto</Label>
                  <Input
                    id="lb-text"
                    placeholder="Meu novo curso"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lb-link">Link</Label>
                  <Input
                    id="lb-link"
                    placeholder="https://..."
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddButton}
                  disabled={addBtn.isPending}
                >
                  {addBtn.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" /> Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar botão
                    </>
                  )}
                </Button>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando botões...
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive border border-destructive/40 rounded-md p-3">
                  Erro ao carregar: {(error as Error)?.message}
                </div>
              )}

              {!isLoading && localOrder.length === 0 && (
                <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                  Nenhum botão ainda. Adicione o primeiro acima.
                </div>
              )}

              {!isLoading && localOrder.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {localOrder.map((b) => (
                        <SortableButtonRow
                          key={b.id}
                          button={b}
                          editing={editingId === b.id}
                          draftLink={draftLink}
                          draftText={draftText}
                          saving={editBtn.isPending}
                          onStartEdit={() => handleStartEdit(b)}
                          onCancelEdit={handleCancelEdit}
                          onSave={handleSaveEdit}
                          onChangeLink={setDraftLink}
                          onChangeText={setDraftText}
                          onDelete={() => handleDeleteButton(b.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </TabsContent>

            {/* CATALOG */}
            <TabsContent value="catalog" className="space-y-3">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando catálogo...
                </div>
              )}

              {!isLoading && catalog.length === 0 && (
                <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                  Nenhuma imagem no catálogo. As imagens são puxadas do feed do Instagram conectado ao Metricool.
                </div>
              )}

              {!isLoading && catalog.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {catalog.map((item: MetricoolBioCatalogItem) => (
                    <div key={item.id} className="rounded-md border overflow-hidden bg-background">
                      {item.imageUrl ? (
                        <div
                          className="aspect-square bg-muted bg-cover bg-center"
                          style={{ backgroundImage: `url(${item.imageUrl})` }}
                        />
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2 space-y-1">
                        {catEditId === item.id ? (
                          <>
                            <Input
                              placeholder="https://..."
                              value={catDraftLink}
                              onChange={(e) => setCatDraftLink(e.target.value)}
                              className="h-7 text-xs"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={handleSaveCatalog}
                                disabled={editCat.isPending}
                              >
                                {editCat.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Salvar'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setCatEditId(null);
                                  setCatDraftLink('');
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-muted-foreground hover:underline truncate block"
                                title={item.url}
                              >
                                {item.url}
                              </a>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                Sem link
                              </span>
                            )}
                            <div className="flex items-center justify-between">
                              {item.shortUrl && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {item.shortUrl}
                                </Badge>
                              )}
                              <div className="flex items-center gap-0.5 ml-auto">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setCatEditId(item.id);
                                    setCatDraftLink(item.url || '');
                                  }}
                                  title="Editar link"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteCatalog(item.id)}
                                  title="Remover imagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* PREVIEW */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" /> Preview
          </CardTitle>
          <CardDescription className="text-xs">
            Como aparece pra quem clica no link da bio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-[260px] rounded-3xl border-4 border-foreground/20 bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/40 dark:via-pink-950/40 dark:to-orange-950/40 p-4 space-y-3">
            <div className="flex flex-col items-center text-center space-y-1.5 pt-2">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                IG
              </div>
              <div className="font-semibold text-sm">Linkin Bio</div>
              <div className="text-[10px] text-muted-foreground">Powered by Metricool</div>
            </div>
            <div className="space-y-2">
              {localOrder.length === 0 ? (
                <div className="text-center text-[11px] text-muted-foreground p-3">
                  Adicione botões pra ver o preview.
                </div>
              ) : (
                localOrder.slice(0, 8).map((b) => (
                  <div
                    key={b.id}
                    className="w-full px-3 py-2 rounded-full bg-foreground/90 text-background text-xs font-medium text-center truncate"
                  >
                    {b.text || '(sem texto)'}
                  </div>
                ))
              )}
            </div>
            {catalog.length > 0 && (
              <div className="grid grid-cols-3 gap-1 pt-2">
                {catalog.slice(0, 9).map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square rounded bg-muted bg-cover bg-center"
                    style={
                      item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
