import { useState, useRef } from "react";
import { SecondaryLayout } from "@/components/SecondaryLayout";
import { ProjectSelector } from "@/components/research/ProjectSelector";
import { ResearchCanvas, ResearchCanvasRef } from "@/components/research/ResearchCanvas";
import { PresentationMode } from "@/components/research/PresentationMode";
import { CommentsPanel } from "@/components/research/CommentsPanel";
import { SharingDialog } from "@/components/research/SharingDialog";
import { VersionHistoryPanel } from "@/components/research/VersionHistoryPanel";
import { ProjectTemplates, ProjectTemplate } from "@/components/research/ProjectTemplates";
import { AutomationsPanel } from "@/components/research/AutomationsPanel";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { useResearchItems } from "@/hooks/useResearchItems";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { 
  Presentation, 
  Settings2, 
  LayoutTemplate, 
  Zap, 
  MessageSquare, 
  History, 
  Share2,
} from "lucide-react";

const ResearchLab = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [showPresentation, setShowPresentation] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const canvasRef = useRef<ResearchCanvasRef>(null);
  const { projects } = useResearchProjects();
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const { items } = useResearchItems(selectedProjectId);

  const handleApplyTemplate = (template: ProjectTemplate) => {
    if (canvasRef.current) {
      canvasRef.current.applyTemplate(template.items);
    }
  };

  return (
    <SecondaryLayout title="Laboratório de Pesquisa">
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
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

          {selectedProjectId && (
            <div className="flex items-center gap-2">
              {/* Configs Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Configurações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Projeto</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowTemplates(true)}>
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    Templates
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAutomations(true)}>
                    <Zap className="h-4 w-4 mr-2" />
                    Automações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Colaboração</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowComments(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comentários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowSharing(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowVersions(true)}>
                    <History className="h-4 w-4 mr-2" />
                    Histórico de Versões
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {items && items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresentation(true)}
                  className="gap-2"
                >
                  <Presentation className="h-4 w-4" />
                  Apresentar
                </Button>
              )}
            </div>
          )}
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
                ref={canvasRef}
                projectId={selectedProjectId} 
                clientId={selectedProject?.client_id || undefined}
                projectName={selectedProject?.name}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs/Panels - controlled by state */}
      {showTemplates && (
        <ProjectTemplates 
          onApplyTemplate={handleApplyTemplate} 
          open={showTemplates}
          onOpenChange={setShowTemplates}
        />
      )}
      
      {showAutomations && selectedProjectId && (
        <AutomationsPanel 
          projectId={selectedProjectId}
          open={showAutomations}
          onOpenChange={setShowAutomations}
        />
      )}
      
      {showComments && selectedProjectId && (
        <CommentsPanel 
          projectId={selectedProjectId}
          open={showComments}
          onOpenChange={setShowComments}
        />
      )}
      
      {showVersions && selectedProjectId && (
        <VersionHistoryPanel 
          projectId={selectedProjectId}
          open={showVersions}
          onOpenChange={setShowVersions}
        />
      )}
      
      {showSharing && selectedProjectId && (
        <SharingDialog 
          projectId={selectedProjectId}
          projectName={selectedProject?.name}
          open={showSharing}
          onOpenChange={setShowSharing}
        />
      )}

      {/* Presentation Mode */}
      {showPresentation && items && (
        <PresentationMode
          items={items}
          onClose={() => setShowPresentation(false)}
        />
      )}
    </SecondaryLayout>
  );
};

export default ResearchLab;
