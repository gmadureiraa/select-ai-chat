// AiAgentEditor — Dialog admin pra editar ai_agents.
// Estrutura típica do agent madureira-redes:
//   knowledge_base = {
//     docs: [string],                        // links/wikilinks pra vault
//     frames_proibidos: [string],            // anti-patterns a bloquear
//     tecnicas_obrigatorias: [string],       // técnicas que devem aparecer
//     ...
//   }
// model = 'gemini-2.5-flash' | 'gemini-2.5-pro' (free-form mas selectamos 2)
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AiAgent, useAiWorkflows } from '@/hooks/useAiWorkflows';
import { cn } from '@/lib/utils';

interface AiAgentEditorProps {
  agent: AiAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido, barato)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (mais capaz)' },
];

// String-array editor com adicionar/remover linhas. Usado pros campos
// docs / frames_proibidos / tecnicas_obrigatorias.
interface StringListEditorProps {
  label: string;
  description?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function StringListEditor({ label, description, values, onChange, placeholder }: StringListEditorProps) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };

  const removeItem = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant="outline" className="text-[10px]">{values.length}</Badge>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      {values.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {values.map((v, i) => (
            <div
              key={`${v}-${i}`}
              className="flex items-start gap-2 px-2.5 py-1.5 border rounded-md bg-muted/30 text-sm"
            >
              <span className="flex-1 break-words">{v}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeItem(i)}
                aria-label={`Remover ${v}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder ?? 'Nova entrada (Enter pra adicionar)'}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function AiAgentEditor({ agent, open, onOpenChange }: AiAgentEditorProps) {
  const { updateAgent } = useAiWorkflows();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skillId, setSkillId] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [isActive, setIsActive] = useState(true);

  // Knowledge base broken into 3 list fields + raw extras (tudo que sobrar)
  const [docs, setDocs] = useState<string[]>([]);
  const [framesProibidos, setFramesProibidos] = useState<string[]>([]);
  const [tecnicasObrigatorias, setTecnicasObrigatorias] = useState<string[]>([]);
  const [extrasRaw, setExtrasRaw] = useState('{}');
  const [extrasError, setExtrasError] = useState<string | null>(null);

  useEffect(() => {
    if (open && agent) {
      setName(agent.name);
      setDescription(agent.description ?? '');
      setSkillId(agent.skill_id ?? '');
      setModel(agent.model ?? 'gemini-2.5-flash');
      setIsActive(agent.is_active);

      const kb = (agent.knowledge_base ?? {}) as Record<string, unknown>;
      const docsVal = Array.isArray(kb.docs) ? (kb.docs as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
      const fpVal = Array.isArray(kb.frames_proibidos)
        ? (kb.frames_proibidos as unknown[]).filter((x) => typeof x === 'string') as string[]
        : [];
      const toVal = Array.isArray(kb.tecnicas_obrigatorias)
        ? (kb.tecnicas_obrigatorias as unknown[]).filter((x) => typeof x === 'string') as string[]
        : [];
      setDocs(docsVal);
      setFramesProibidos(fpVal);
      setTecnicasObrigatorias(toVal);

      // Tudo o que NÃO for esses 3 campos vai pra "extras" (raw json)
      const known = new Set(['docs', 'frames_proibidos', 'tecnicas_obrigatorias']);
      const extras: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(kb)) {
        if (!known.has(k)) extras[k] = v;
      }
      setExtrasRaw(JSON.stringify(extras, null, 2));
      setExtrasError(null);
    }
  }, [open, agent]);

  // Live extras JSON validation
  useEffect(() => {
    if (!extrasRaw.trim()) {
      setExtrasError(null);
      return;
    }
    try {
      const parsed = JSON.parse(extrasRaw);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setExtrasError('extras precisa ser objeto JSON');
      } else {
        setExtrasError(null);
      }
    } catch (e: any) {
      setExtrasError(`JSON inválido: ${e.message}`);
    }
  }, [extrasRaw]);

  const knowledgeBasePreview = useMemo(() => {
    let extras: Record<string, unknown> = {};
    try {
      extras = extrasRaw.trim() ? JSON.parse(extrasRaw) : {};
    } catch {
      extras = {};
    }
    return {
      ...extras,
      docs,
      frames_proibidos: framesProibidos,
      tecnicas_obrigatorias: tecnicasObrigatorias,
    };
  }, [docs, framesProibidos, tecnicasObrigatorias, extrasRaw]);

  const isValid =
    !!agent &&
    name.trim().length > 0 &&
    !extrasError &&
    !updateAgent.isPending;

  const handleSubmit = () => {
    if (!agent || !isValid) return;
    updateAgent.mutate(
      {
        id: agent.id,
        name: name.trim(),
        description: description.trim() || null,
        skill_id: skillId.trim() || null,
        model: model.trim() || null,
        is_active: isActive,
        knowledge_base: knowledgeBasePreview,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-purple-500" />
            Editar Agent AI
          </DialogTitle>
          <DialogDescription>
            Knowledge base, skill, modelo e listas de validação (frames proibidos, técnicas obrigatórias).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Nome + skill */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ag-name">Nome</Label>
              <Input
                id="ag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: agent-madureira-redes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-skill">skill_id</Label>
              <Input
                id="ag-skill"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                placeholder="Ex: copywriting-madureira@1.2"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Descrição + model + ativo */}
          <div className="space-y-2">
            <Label htmlFor="ag-desc">Descrição</Label>
            <Textarea
              id="ag-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg h-[42px]">
              <Label className="text-sm">Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {/* knowledge_base.docs */}
          <StringListEditor
            label="docs"
            description="Caminhos/wikilinks pra vault Obsidian. Cada doc vira contexto pro agent."
            values={docs}
            onChange={setDocs}
            placeholder="Ex: vault/01 - KALEIDOS/.../CLAUDE.md"
          />

          {/* knowledge_base.frames_proibidos */}
          <StringListEditor
            label="frames_proibidos"
            description="Padrões/frases bloqueadas — validator detecta e força repair."
            values={framesProibidos}
            onChange={setFramesProibidos}
            placeholder="Ex: simples assim."
          />

          {/* knowledge_base.tecnicas_obrigatorias */}
          <StringListEditor
            label="tecnicas_obrigatorias"
            description="Técnicas que devem aparecer (gancho, dado-shock, primeira-pessoa, etc)."
            values={tecnicasObrigatorias}
            onChange={setTecnicasObrigatorias}
            placeholder="Ex: hook-pessoal-slide-2"
          />

          {/* knowledge_base extras (raw json) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ag-extras">knowledge_base extras (jsonb)</Label>
              <Badge variant="outline" className="text-[10px] font-mono">
                {extrasRaw.length} chars
              </Badge>
            </div>
            <Textarea
              id="ag-extras"
              value={extrasRaw}
              onChange={(e) => setExtrasRaw(e.target.value)}
              rows={6}
              className={cn(
                'font-mono text-xs leading-relaxed',
                extrasError && 'border-red-500',
              )}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Campos extras do knowledge_base que não são docs/frames_proibidos/tecnicas_obrigatorias.
              Mergeados no save.
            </p>
            {extrasError && (
              <p className="text-xs text-red-500 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {extrasError}
              </p>
            )}
          </div>

          {/* Read-only meta */}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t pt-3">
            <div>
              <span className="font-medium block text-foreground">id</span>
              <code className="break-all">{agent.id}</code>
            </div>
            <div>
              <span className="font-medium block text-foreground">workspace_id</span>
              <code className="break-all">{agent.workspace_id}</code>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {updateAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
