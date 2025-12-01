import { ResearchItemCard } from "./ResearchItemCard";
import { useResearchItems } from "@/hooks/useResearchItems";

interface ResearchCanvasProps {
  projectId: string;
}

export const ResearchCanvas = ({ projectId }: ResearchCanvasProps) => {
  const { items, deleteItem } = useResearchItems(projectId);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Nenhum material adicionado ainda</p>
          <p className="text-sm">Clique em "Adicionar Material" para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {items.map((item) => (
        <ResearchItemCard key={item.id} item={item} onDelete={deleteItem.mutate} />
      ))}
    </div>
  );
};
