import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSelector } from "@/components/research/ProjectSelector";
import { ResearchCanvas } from "@/components/research/ResearchCanvas";
import { useResearchProjects } from "@/hooks/useResearchProjects";

const ResearchLab = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const { projects } = useResearchProjects();
  const selectedProject = projects.find(p => p.id === selectedProjectId);

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
            {selectedProject?.client_id && (
              <div className="text-sm text-muted-foreground">
                Cliente filtrado no projeto
              </div>
            )}
          </div>
        </div>

        {!selectedProjectId ? (
          <div className="flex items-center justify-center flex-1 bg-muted/30">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Nenhum projeto selecionado</p>
              <p className="text-sm">Selecione ou crie um projeto para começar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 overflow-hidden bg-muted/30">
            <div className="h-full overflow-hidden rounded-lg border border-border shadow-sm bg-background">
              <ResearchCanvas 
                projectId={selectedProjectId} 
                clientId={selectedProject?.client_id || undefined} 
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ResearchLab;
