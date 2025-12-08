import { useState, useEffect } from 'react';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  X,
  Sparkles,
  Zap,
  Bot,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface WorkflowExecutionPanelProps {
  workflowId: string;
  workflowName: string;
  nodes: any[];
  onClose: () => void;
}

interface Variable {
  key: string;
  value: string;
}

interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  timestamp?: string;
}

export function WorkflowExecutionPanel({ 
  workflowId, 
  workflowName, 
  nodes,
  onClose 
}: WorkflowExecutionPanelProps) {
  const { executeWorkflowAsync, isExecuting } = useWorkflowExecution(workflowId);
  const [input, setInput] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [progress, setProgress] = useState(0);

  // Initialize execution steps from nodes
  useEffect(() => {
    const agentNodes = nodes.filter(n => n.type === 'agent' || n.type === 'trigger');
    const steps: ExecutionStep[] = agentNodes.map(node => ({
      nodeId: node.id,
      nodeName: node.data?.label || node.data?.config?.name || node.type,
      nodeType: node.type,
      status: 'pending',
    }));
    setExecutionSteps(steps);
  }, [nodes]);

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
    setProgress(0);
    setCurrentStep(0);

    // Reset all steps to pending
    setExecutionSteps(prev => prev.map(s => ({ ...s, status: 'pending', output: undefined })));

    const variablesObj = variables.reduce((acc, v) => {
      if (v.key) acc[v.key] = v.value;
      return acc;
    }, {} as Record<string, string>);

    // Simulate step-by-step execution visualization
    const simulateSteps = async () => {
      for (let i = 0; i < executionSteps.length; i++) {
        setCurrentStep(i);
        setExecutionSteps(prev => prev.map((s, idx) => ({
          ...s,
          status: idx === i ? 'running' : idx < i ? 'success' : 'pending',
        })));
        setProgress(((i + 0.5) / executionSteps.length) * 100);
        await new Promise(r => setTimeout(r, 800));
      }
    };

    // Start simulation
    simulateSteps();

    try {
      const response = await executeWorkflowAsync({
        workflowId,
        triggerData: {
          input,
          message: input,
          variables: variablesObj,
        },
      });

      // Mark all steps as complete
      setProgress(100);
      
      if (response.success) {
        setResult(response.result);
        setExecutionSteps(prev => prev.map(s => ({ 
          ...s, 
          status: 'success',
          output: 'Concluído com sucesso'
        })));
      } else {
        setError(response.error || 'Execution failed');
        setExecutionSteps(prev => prev.map((s, idx) => ({ 
          ...s, 
          status: idx === currentStep ? 'error' : s.status === 'running' ? 'error' : s.status
        })));
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setExecutionSteps(prev => prev.map(s => ({ 
        ...s, 
        status: s.status === 'running' ? 'error' : s.status
      })));
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'trigger': return <Zap className="h-4 w-4" />;
      case 'agent': return <Bot className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-muted-foreground';
      case 'running': return 'text-primary';
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold">Executando: {workflowName}</h1>
            <p className="text-sm text-muted-foreground">Workflow em tempo real</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Input & Controls */}
        <div className="w-1/3 border-r p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Input */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Input do Workflow</Label>
            <Textarea
              placeholder="Digite o input que será processado pelo workflow..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Variables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Variáveis</Label>
              <Button variant="outline" size="sm" onClick={addVariable} className="gap-1">
                <Plus className="h-3 w-3" />
                Adicionar
              </Button>
            </div>
            
            <AnimatePresence>
              {variables.map((variable, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2"
                >
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
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Execute Button */}
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !input.trim()}
            size="lg"
            className="w-full gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Executando Workflow...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Executar Workflow
              </>
            )}
          </Button>

          {/* Progress */}
          {isExecuting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Center Panel - Execution Steps */}
        <div className="w-1/3 border-r p-6 overflow-y-auto">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pipeline de Execução
          </h2>

          <div className="space-y-3">
            {executionSteps.map((step, index) => (
              <motion.div
                key={step.nodeId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`p-4 transition-all ${
                  step.status === 'running' ? 'ring-2 ring-primary shadow-lg' : ''
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      step.status === 'running' 
                        ? 'bg-primary text-primary-foreground animate-pulse' 
                        : step.status === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : step.status === 'error'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : step.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.status === 'error' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        getNodeIcon(step.nodeType)
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{step.nodeName}</p>
                      <p className={`text-xs capitalize ${getStatusColor(step.status)}`}>
                        {step.status === 'pending' ? 'Aguardando' : 
                         step.status === 'running' ? 'Processando...' : 
                         step.status === 'success' ? 'Concluído' : 'Erro'}
                      </p>
                    </div>

                    {index < executionSteps.length - 1 && step.status === 'success' && (
                      <ArrowRight className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="flex-1 p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Resultado da Execução
            </h2>
            {(result || error) && (
              <Badge 
                variant="outline" 
                className={error 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : 'bg-green-500/10 text-green-500 border-green-500/20'
                }
              >
                {error ? (
                  <><XCircle className="h-3 w-3 mr-1" /> Erro</>
                ) : (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso</>
                )}
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1 border rounded-lg bg-muted/30">
            {!result && !error && !isExecuting && (
              <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
                <div>
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Digite um input e execute o workflow para ver o resultado aqui</p>
                </div>
              </div>
            )}

            {isExecuting && !result && !error && (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando workflow...</p>
                </div>
              </div>
            )}

            {(result || error) && (
              <div className="p-4">
                {error ? (
                  <div className="text-red-500 whitespace-pre-wrap">{error}</div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap break-words text-sm">
                      {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </motion.div>
  );
}
