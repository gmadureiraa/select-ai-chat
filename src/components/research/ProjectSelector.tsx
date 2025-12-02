import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { useClients } from "@/hooks/useClients";

interface ProjectSelectorProps {
  selectedProjectId?: string;
  onSelectProject: (projectId: string) => void;
}

export const ProjectSelector = ({ selectedProjectId, onSelectProject }: ProjectSelectorProps) => {
  const { projects, createProject, updateProject } = useResearchProjects();
  const { clients } = useClients();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createProject.mutateAsync({ name, description, client_id: clientId || undefined });
    setName("");
    setDescription("");
    setClientId("");
    setIsOpen(false);
  };

  const handleEdit = async () => {
    if (!selectedProjectId || !name.trim()) return;

    await updateProject.mutateAsync({ 
      id: selectedProjectId, 
      name, 
      description,
      client_id: clientId || undefined
    });
    setIsEditOpen(false);
  };

  const openEditDialog = () => {
    if (selectedProject) {
      setName(selectedProject.name);
      setDescription(selectedProject.description || "");
      setClientId(selectedProject.client_id || "");
      setIsEditOpen(true);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedProjectId || ""} onValueChange={onSelectProject}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Selecione um projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedProjectId && (
        <Button variant="outline" size="icon" onClick={openEditDialog}>
          <Settings className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto de Pesquisa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Projeto</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Análise de Concorrentes"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo da pesquisa..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="client">Cliente (opcional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || createProject.isPending}>
              {createProject.isPending ? "Criando..." : "Criar Projeto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome do Projeto</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Análise de Concorrentes"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo da pesquisa..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-client">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} disabled={!name.trim() || updateProject.isPending}>
              {updateProject.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
