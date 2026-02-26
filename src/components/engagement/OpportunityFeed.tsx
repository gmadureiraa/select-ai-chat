import { EngagementOpportunity } from "@/hooks/useEngagementFeed";
import { OpportunityCard } from "./OpportunityCard";
import { Loader2, Inbox } from "lucide-react";

interface OpportunityFeedProps {
  opportunities: EngagementOpportunity[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (opp: EngagementOpportunity) => void;
  onDismiss: (id: string) => void;
  onSave: (id: string) => void;
}

export function OpportunityFeed({ 
  opportunities, 
  isLoading, 
  selectedId, 
  onSelect, 
  onDismiss, 
  onSave 
}: OpportunityFeedProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Nenhuma oportunidade encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em "Buscar" para encontrar tweets relevantes do seu nicho
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {opportunities.map((opp) => (
        <OpportunityCard
          key={opp.id}
          opportunity={opp}
          isSelected={selectedId === opp.id}
          onSelect={() => onSelect(opp)}
          onDismiss={() => onDismiss(opp.id)}
          onSave={() => onSave(opp.id)}
        />
      ))}
    </div>
  );
}
