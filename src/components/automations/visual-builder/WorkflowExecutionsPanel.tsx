import { useState } from "react";
import { N8nExecutionsList } from "@/components/n8n/N8nExecutionsList";
import { N8nExecutionDetails } from "@/components/n8n/N8nExecutionDetails";
import { N8nExecution } from "@/hooks/useN8nAPI";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface WorkflowExecutionsPanelProps {
  workflowId?: string;
  workflowName?: string;
}

export function WorkflowExecutionsPanel({ workflowId, workflowName }: WorkflowExecutionsPanelProps) {
  const [selectedExecution, setSelectedExecution] = useState<N8nExecution | null>(null);

  return (
    <div className="h-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="h-full p-4 overflow-auto">
            <N8nExecutionsList
              workflowId={workflowId}
              workflowName={workflowName}
              onSelectExecution={setSelectedExecution}
              selectedExecutionId={selectedExecution?.id}
            />
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="h-full p-4 overflow-auto">
            <N8nExecutionDetails
              executionId={selectedExecution?.id || null}
              execution={selectedExecution || undefined}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
