import { Copy, Check, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
}

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

  // Fetch client templates with clickup_list_id
  const { data: templates } = useQuery({
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

  const handleSendToClickUp = async () => {
    if (!selectedTemplate || !taskName) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um template e insira um nome para a tarefa",
        variant: "destructive",
      });
      return;
    }

    const template = templates?.find(t => t.id === selectedTemplate);
    if (!template?.clickup_list_id) {
      toast({
        title: "Erro",
        description: "Template sem lista do ClickUp configurada",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-to-clickup', {
        body: {
          listId: template.clickup_list_id,
          taskName,
          content,
          clientName,
          templateName: template.name,
        },
      });

      if (error) throw error;

      toast({
        title: "Enviado para ClickUp!",
        description: "A tarefa foi criada com sucesso",
      });

      setIsDialogOpen(false);
      setSelectedTemplate("");
      setTaskName("");
    } catch (error) {
      console.error('Error sending to ClickUp:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
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

        {role === "assistant" && clientId && templates && templates.length > 0 && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar para ClickUp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template">Template / Lista</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
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
                  />
                </div>
                <Button 
                  onClick={handleSendToClickUp} 
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? "Enviando..." : "Criar Tarefa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </div>
  );
};