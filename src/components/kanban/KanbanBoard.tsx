import { useState } from "react";
import { Plus, Loader2, Library, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useKanbanBoard, KanbanCard, KanbanColumn } from "@/hooks/useKanbanBoard";
import { AddCardDialog } from "./AddCardDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface KanbanBoardProps {
  clientId?: string;
}

export function KanbanBoard({ clientId }: KanbanBoardProps) {
  const { columns, cards, isLoading, getCardsByColumn, moveCard, moveToLibrary, deleteCard } = useKanbanBoard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<KanbanColumn | null>(null);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleAddCard = (column: KanbanColumn) => {
    setSelectedColumn(column);
    setIsDialogOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumn) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedCard || draggedCard.column_id === targetColumn.id) {
      setDraggedCard(null);
      return;
    }

    const targetCards = getCardsByColumn(targetColumn.id);
    const newPosition = targetCards.length;

    await moveCard.mutateAsync({
      cardId: draggedCard.id,
      targetColumnId: targetColumn.id,
      newPosition,
    });

    setDraggedCard(null);
  };

  const handleMoveToLibrary = async (card: KanbanCard) => {
    await moveToLibrary.mutateAsync(card.id);
  };

  const handleDeleteCard = async (card: KanbanCard) => {
    await deleteCard.mutateAsync(card.id);
  };

  const getColumnColor = (column: KanbanColumn): string => {
    const colorMap: Record<string, string> = {
      'idea': 'bg-purple-500',
      'draft': 'bg-yellow-500',
      'review': 'bg-orange-500',
      'approved': 'bg-green-500',
      'scheduled': 'bg-blue-500',
      'published': 'bg-emerald-500',
    };
    return colorMap[column.column_type || ''] || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-semibold">Kanban de Conteúdo</h1>
          <p className="text-sm text-muted-foreground">
            Organize e acompanhe a produção de conteúdo
          </p>
        </div>
      </div>

      {/* Kanban Columns */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 h-full min-h-[calc(100vh-180px)]">
          {columns.map(column => {
            const columnCards = getCardsByColumn(column.id);

            return (
              <div
                key={column.id}
                className={cn(
                  "flex-shrink-0 w-[300px] rounded-lg bg-muted/30 border transition-colors",
                  dragOverColumn === column.id && "border-primary bg-primary/5"
                )}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column)}
              >
                {/* Column Header */}
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", getColumnColor(column))} />
                    <h3 className="font-medium">{column.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {columnCards.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleAddCard(column)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  <TooltipProvider>
                    {columnCards.map(card => (
                      <ContextMenu key={card.id}>
                        <ContextMenuTrigger>
                          <Card
                            draggable
                            onDragStart={(e) => handleDragStart(e, card)}
                            className={cn(
                              "p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                              draggedCard?.id === card.id && "opacity-50"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{card.title}</p>
                                {card.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {card.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {card.platform && (
                                    <Badge variant="outline" className="text-xs">
                                      {card.platform}
                                    </Badge>
                                  )}
                                  {card.due_date && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className="text-xs">
                                          {format(new Date(card.due_date), "dd/MM", { locale: ptBR })}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Data limite: {format(new Date(card.due_date), "dd 'de' MMMM", { locale: ptBR })}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {card.clients && (
                                    <Badge variant="outline" className="text-xs bg-primary/10">
                                      {card.clients.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem 
                            onClick={() => handleMoveToLibrary(card)}
                            disabled={!card.client_id}
                          >
                            <Library className="h-4 w-4 mr-2" />
                            Adicionar à Biblioteca
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleDeleteCard(card)}
                            className="text-destructive focus:text-destructive"
                          >
                            Excluir Card
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </TooltipProvider>

                  {columnCards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum card
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <AddCardDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        column={selectedColumn}
        defaultClientId={clientId}
      />
    </div>
  );
}
