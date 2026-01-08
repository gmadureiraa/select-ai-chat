import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormatRules } from "@/hooks/useFormatRules";

const CATEGORIES = [
  { value: "social", label: "Redes Sociais" },
  { value: "video", label: "Vídeo" },
  { value: "email", label: "Email" },
  { value: "blog", label: "Blog/Artigo" },
  { value: "custom", label: "Personalizado" },
];

interface CreateFormatRuleModalProps {
  onCreated?: () => void;
}

export const CreateFormatRuleModal = ({ onCreated }: CreateFormatRuleModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("social");
  const [structureRules, setStructureRules] = useState("");
  const [toneRules, setToneRules] = useState("");
  const [lengthMin, setLengthMin] = useState("");
  const [lengthMax, setLengthMax] = useState("");

  const { createFormatRule, isCreating } = useFormatRules();

  const handleCreate = async () => {
    if (!name.trim()) return;

    const formatId = `custom-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

    await createFormatRule({
      format_id: formatId,
      name: name.trim(),
      description: description.trim() || undefined,
      rules: {
        category,
        structure: structureRules.split("\n").filter(Boolean),
        tone: toneRules.split("\n").filter(Boolean),
        length: {
          min: parseInt(lengthMin) || 0,
          max: parseInt(lengthMax) || 2000,
        },
      },
    });

    setIsOpen(false);
    resetForm();
    onCreated?.();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("social");
    setStructureRules("");
    setToneRules("");
    setLengthMin("");
    setLengthMax("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Formato
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Formato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Formato *</Label>
            <Input
              id="name"
              placeholder="Ex: Post Institucional"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Breve descrição do formato"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="structure">Regras de Estrutura (uma por linha)</Label>
            <Textarea
              id="structure"
              placeholder="Ex:
Começar com hook que gera curiosidade
Dividir em 3-5 parágrafos curtos
Terminar com CTA claro"
              value={structureRules}
              onChange={(e) => setStructureRules(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Regras de Tom (uma por linha)</Label>
            <Textarea
              id="tone"
              placeholder="Ex:
Linguagem profissional mas acessível
Evitar jargões técnicos
Usar voz ativa"
              value={toneRules}
              onChange={(e) => setToneRules(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lengthMin">Tamanho Mínimo (caracteres)</Label>
              <Input
                id="lengthMin"
                type="number"
                placeholder="100"
                value={lengthMin}
                onChange={(e) => setLengthMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lengthMax">Tamanho Máximo (caracteres)</Label>
              <Input
                id="lengthMax"
                type="number"
                placeholder="500"
                value={lengthMax}
                onChange={(e) => setLengthMax(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? "Criando..." : "Criar Formato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
