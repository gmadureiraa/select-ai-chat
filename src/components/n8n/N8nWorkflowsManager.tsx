import { useState } from "react";
import { N8nWorkflowsList } from "@/components/n8n/N8nWorkflowsList";
import { N8nExecutionsList } from "@/components/n8n/N8nExecutionsList";
import { N8nExecutionDetails } from "@/components/n8n/N8nExecutionDetails";
import { N8nExecution } from "@/hooks/useN8nAPI";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ArrowLeft, Zap } from "lucide-react";

interface N8nWorkflowsManagerProps {
  n8nBaseUrl?: string;
}

export function N8nWorkflowsManager({ n8nBaseUrl }: N8nWorkflowsManagerProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<{ id: string; name: string } | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<N8nExecution | null>(null);
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false);

  const handleViewExecutions = (workflowId: string, workflowName: string) => {
    setSelectedWorkflow({ id: workflowId, name: workflowName });
  };

  const handleSelectExecution = (execution: N8nExecution) => {
    setSelectedExecution(execution);
    setExecutionDetailsOpen(true);
  };

  const handleBackToWorkflows = () => {
    setSelectedWorkflow(null);
    setSelectedExecution(null);
  };

  return (
    <div className="space-y-6">
      {!selectedWorkflow ? (
        <N8nWorkflowsList 
          onViewExecutions={handleViewExecutions}
          n8nBaseUrl={n8nBaseUrl}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToWorkflows}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-medium">{selectedWorkflow.name}</span>
              <Badge variant="outline">Execuções</Badge>
            </div>
          </div>

          <N8nExecutionsList
            workflowId={selectedWorkflow.id}
            workflowName={selectedWorkflow.name}
            onSelectExecution={handleSelectExecution}
            selectedExecutionId={selectedExecution?.id}
          />
        </div>
      )}

      {/* Execution Details Dialog */}
      <Dialog open={executionDetailsOpen} onOpenChange={setExecutionDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes da Execução</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            <N8nExecutionDetails
              executionId={selectedExecution?.id || null}
              execution={selectedExecution || undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
