import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSelector } from "@/components/research/ProjectSelector";
import { ResearchCanvas } from "@/components/research/ResearchCanvas";

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
          
        </div>

        {!selectedProjectId ? (
          <div className="flex items-center justify-center flex-1 bg-white">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Nenhum projeto selecionado</p>
              <p className="text-sm">Selecione ou crie um projeto para começar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 overflow-hidden bg-white">
            <div className="h-full overflow-hidden rounded-lg border border-gray-200 shadow-sm">
              <ResearchCanvas projectId={selectedProjectId} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ResearchLab;
