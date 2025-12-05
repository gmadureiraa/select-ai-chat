import { useState } from 'react';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';

interface WorkflowTestPanelProps {
  workflowId: string;
  workflowName: string;
}

interface Variable {
  key: string;
  value: string;
}

export function WorkflowTestPanel({ workflowId, workflowName }: WorkflowTestPanelProps) {
  const { executeWorkflowAsync, isExecuting } = useWorkflowExecution(workflowId);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const addVariable = () => {
    setVariables([...variables, { key: '', value: '' }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...variables];
    updated[index][field] = value;
    setVariables(updated);
  };

  const handleExecute = async () => {
    setResult(null);
    setError(null);

    const variablesObj = variables.reduce((acc, v) => {
      if (v.key) acc[v.key] = v.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await executeWorkflowAsync({
        workflowId,
        triggerData: {
          input,
          message: input,
          variables: variablesObj,
        },
      });

      if (response.success) {
        setResult(response.result);
      } else {
        setError(response.error || 'Execution failed');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2">
          <Play className="h-4 w-4" />
          Testar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Testar Workflow: {workflowName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Input */}
          <div className="space-y-2">
            <Label>Input / Mensagem</Label>
            <Textarea
              placeholder="Digite o input que será enviado ao workflow..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variáveis (opcional)</Label>
              <Button variant="ghost" size="sm" onClick={addVariable}>
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>
            {variables.length > 0 && (
              <div className="space-y-2">
                {variables.map((variable, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Nome"
                      value={variable.key}
                      onChange={(e) => updateVariable(index, 'key', e.target.value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Valor"
                      value={variable.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariable(index)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execute Button */}
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !input.trim()}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Workflow
              </>
            )}
          </Button>

          {/* Result */}
          {(result || error) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Resultado</Label>
                {error ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                    <XCircle className="h-3 w-3 mr-1" />
                    Erro
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Sucesso
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-64 border rounded-md">
                <pre className="p-4 text-sm whitespace-pre-wrap break-words">
                  {error ? (
                    <span className="text-red-500">{error}</span>
                  ) : (
                    typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                  )}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
