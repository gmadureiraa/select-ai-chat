import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/hooks/useClients";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDialog = ({ open, onOpenChange }: ClientDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const { createClient } = useClients();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createClient.mutateAsync({
      name,
      description: description || null,
      context_notes: contextNotes || null,
    });

    setName("");
    setDescription("");
    setContextNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>
            Crie um novo cliente e defina o contexto fixo para o chat
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cliente *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Empresa XYZ"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do cliente..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Contexto Fixo do Chat</Label>
            <Textarea
              id="context"
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
              placeholder="Informações importantes, estratégias, objetivos, etc. que o chat deve sempre considerar..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Este contexto será incluído em todas as conversas com este cliente
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Criar Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
