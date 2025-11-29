import { Copy, Check, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
}

// Validation constants
const MAX_TASK_NAME_LENGTH = 200;
const MIN_TASK_NAME_LENGTH = 3;

export const MessageActions = ({
  content,
  role,
  onRegenerate,
  isLastMessage,
  clientId,
  clientName,
  templateName,
}: MessageActionsProps) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [taskName, setTaskName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [taskUrl, setTaskUrl] = useState<string | null>(null);

  // Fetch client templates with clickup_list_id
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['client-templates-clickup', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_templates')
        .select('*')
        .eq('client_id', clientId)
        .not('clickup_list_id', 'is', null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && role === "assistant",
  });

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) {
      toast({
        description: "Mensagem copiada!",
        duration: 2000,
      });
    } else {
      toast({
        description: "Erro ao copiar mensagem",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const validateTaskName = (name: string): string | null => {
    if (!name || name.trim().length < MIN_TASK_NAME_LENGTH) {
      return `Nome da tarefa deve ter pelo menos ${MIN_TASK_NAME_LENGTH} caracteres`;
    }
    if (name.length > MAX_TASK_NAME_LENGTH) {
      return `Nome da tarefa não pode exceder ${MAX_TASK_NAME_LENGTH} caracteres`;
    }
    return null;
  };

  const handleSendToClickUp = async () => {
    // Reset success state
    setTaskUrl(null);

    // Validate inputs
    if (!selectedTemplate) {
      toast({
        title: "Template não selecionado",
        description: "Por favor, selecione um template",
        variant: "destructive",
      });
      return;
    }

    const validationError = validateTaskName(taskName);
    if (validationError) {
      toast({
        title: "Nome da tarefa inválido",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    const template = templates?.find(t => t.id === selectedTemplate);
    if (!template?.clickup_list_id) {
      toast({
        title: "Configuração incompleta",
        description: "Este template não tem uma lista do ClickUp configurada",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-to-clickup', {
        body: {
          listId: template.clickup_list_id,
          taskName: taskName.trim(),
          content,
          clientName,
          templateName: template.name,
        },
      });

      if (error) throw error;

      // Show success state
      setTaskUrl(data.taskUrl);
      
      toast({
        title: "✓ Tarefa criada!",
        description: "A tarefa foi adicionada ao ClickUp com sucesso",
      });

      // Reset form after 2 seconds
      setTimeout(() => {
        setIsDialogOpen(false);
        setSelectedTemplate("");
        setTaskName("");
        setTaskUrl(null);
      }, 2000);
    } catch (error) {
      console.error('Error sending to ClickUp:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar tarefa';
      toast({
        title: "Erro ao enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isSending) {
      // Reset state when closing
      setSelectedTemplate("");
      setTaskName("");
      setTaskUrl(null);
    }
    setIsDialogOpen(open);
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCopied ? "Copiado!" : "Copiar mensagem"}</p>
          </TooltipContent>
        </Tooltip>

        {role === "assistant" && isLastMessage && onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRegenerate}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Regenerar resposta</p>
            </TooltipContent>
          </Tooltip>
        )}

        {role === "assistant" && clientId && !isLoadingTemplates && templates && templates.length > 0 && (
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enviar para ClickUp</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar para ClickUp</DialogTitle>
                <DialogDescription>
                  Crie uma nova tarefa no ClickUp com o conteúdo desta mensagem
                </DialogDescription>
              </DialogHeader>
              
              {taskUrl ? (
                <div className="space-y-4 py-4">
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-sm">
                      Tarefa criada com sucesso!
                    </AlertDescription>
                  </Alert>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(taskUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir tarefa no ClickUp
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template">Template / Lista do ClickUp</Label>
                    <Select 
                      value={selectedTemplate} 
                      onValueChange={setSelectedTemplate}
                      disabled={isSending}
                    >
                      <SelectTrigger id="template">
                        <SelectValue placeholder="Selecione o template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="taskName">Nome da Tarefa</Label>
                    <Input
                      id="taskName"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      placeholder="Ex: Newsletter Semanal - 29/11"
                      maxLength={MAX_TASK_NAME_LENGTH}
                      disabled={isSending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {taskName.length}/{MAX_TASK_NAME_LENGTH} caracteres
                    </p>
                  </div>

                  <Button 
                    onClick={handleSendToClickUp} 
                    disabled={isSending || !selectedTemplate || !taskName}
                    className="w-full"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando tarefa...
                      </>
                    ) : (
                      "Criar Tarefa"
                    )}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </div>
  );
};