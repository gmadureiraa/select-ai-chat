import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSelector } from "@/components/research/ProjectSelector";
import { AddItemDialog } from "@/components/research/AddItemDialog";
import { ResearchCanvas } from "@/components/research/ResearchCanvas";
import { ResearchChatPanel } from "@/components/research/ResearchChatPanel";

const ResearchLab = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>();

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Laboratório de Pesquisa</h1>
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
            />
          </div>
          {selectedProjectId && <AddItemDialog projectId={selectedProjectId} />}
        </div>

        {!selectedProjectId ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Nenhum projeto selecionado</p>
              <p className="text-sm">Selecione ou crie um projeto para começar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
            <div className="lg:col-span-2 overflow-auto">
              <ResearchCanvas projectId={selectedProjectId} />
            </div>
            <div className="overflow-hidden">
              <ResearchChatPanel projectId={selectedProjectId} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ResearchLab;
