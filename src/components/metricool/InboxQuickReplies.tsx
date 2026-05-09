// InboxQuickReplies — dropdown de templates de resposta rápida.
// Persiste por cliente no localStorage. Cada template = { id, label, text }.
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface QuickReplyTemplate {
  id: string;
  label: string;
  text: string;
}

const storageKey = (clientId: string) => `kai-inbox-replies-${clientId}`;

function loadTemplates(clientId: string): QuickReplyTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(clientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is QuickReplyTemplate =>
        !!t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.text === 'string',
    );
  } catch {
    return [];
  }
}

function saveTemplates(clientId: string, templates: QuickReplyTemplate[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(clientId), JSON.stringify(templates));
  } catch {
    // ignore quota errors
  }
}

interface Props {
  clientId: string;
  /** Texto atual do input — pode ser salvo como template novo. */
  currentText: string;
  /** Chamado quando user clica num template — insere texto no input. */
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function InboxQuickReplies({ clientId, currentText, onPick, disabled }: Props) {
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>(() => loadTemplates(clientId));
  const [adding, setAdding] = useState(false);
  const [labelInput, setLabelInput] = useState('');

  // Recarrega quando troca cliente.
  useEffect(() => {
    setTemplates(loadTemplates(clientId));
    setAdding(false);
    setLabelInput('');
  }, [clientId]);

  const canAddCurrent = useMemo(() => currentText.trim().length > 0, [currentText]);

  const handleAdd = () => {
    const label = labelInput.trim();
    const text = currentText.trim();
    if (!label || !text) return;
    const next: QuickReplyTemplate[] = [
      ...templates,
      { id: `tpl-${Date.now()}`, label, text },
    ];
    setTemplates(next);
    saveTemplates(clientId, next);
    setLabelInput('');
    setAdding(false);
  };

  const handleRemove = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    saveTemplates(clientId, next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          title="Templates de resposta"
        >
          <Sparkles className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Templates de resposta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Nenhum template ainda. Adicione abaixo.
          </div>
        )}
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="flex items-center gap-1 px-1.5 py-1 hover:bg-accent rounded-sm"
          >
            <button
              type="button"
              onClick={() => onPick(tpl.text)}
              className="flex-1 text-left text-sm truncate px-1 py-0.5"
              title={tpl.text}
            >
              {tpl.label}
            </button>
            <button
              type="button"
              onClick={() => handleRemove(tpl.id)}
              className="text-muted-foreground hover:text-destructive shrink-0 p-1"
              aria-label={`Remover template ${tpl.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <DropdownMenuSeparator />
        {adding ? (
          <div className="p-2 space-y-2">
            <Input
              autoFocus
              placeholder="Nome do template"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setLabelInput('');
                }
              }}
              className="h-8 text-xs"
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={!labelInput.trim() || !canAddCurrent}
                className="flex-1 h-7 text-xs"
              >
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setLabelInput('');
                }}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
            </div>
            {!canAddCurrent && (
              <p className="text-[10px] text-muted-foreground">
                Digite uma resposta no input pra salvar como template.
              </p>
            )}
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAdding(true);
            }}
            className="text-sm cursor-pointer"
          >
            <Plus className="h-3 w-3 mr-2" /> Adicionar template
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
