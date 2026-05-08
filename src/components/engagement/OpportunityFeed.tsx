import { EngagementOpportunity } from "@/hooks/useEngagementFeed";
import { OpportunityCard } from "./OpportunityCard";
import { Loader2, Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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
      <EmptyState
        icon={Inbox}
        title="Nenhuma oportunidade encontrada"
        description='Clique em "Buscar" pra encontrar tweets relevantes do seu nicho. A kAI cruza palavras-chave com a voz do cliente e ranqueia o que vale responder.'
        variant="default"
      />
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
