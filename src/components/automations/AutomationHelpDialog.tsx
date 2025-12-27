import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Settings, 
  PlayCircle, 
  Rss, 
  Clock, 
  Share2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface AutomationHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationHelpDialog({ open, onOpenChange }: AutomationHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Guia de Automações
          </DialogTitle>
          <DialogDescription>
            Aprenda a criar e gerenciar automações de publicação com n8n
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* O que são automações */}
            <section>
              <h3 className="font-semibold text-lg mb-3">O que são automações?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automações permitem que você conecte seu n8n ao KAI para criar workflows 
                de publicação automática. Com isso, você pode agendar posts, processar 
                feeds RSS, gerar conteúdo com IA e publicar automaticamente nas redes sociais.
              </p>
            </section>

            <Separator />

            {/* Como configurar n8n */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Como configurar o n8n
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium mb-1">1. Obtenha suas credenciais n8n</p>
                  <p className="text-muted-foreground">
                    No painel do n8n, vá em Settings → n8n API para obter sua URL e API Key.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium mb-1">2. Configure no KAI</p>
                  <p className="text-muted-foreground">
                    Clique em "Configurar n8n" e insira sua URL base (ex: https://seu-n8n.app.n8n.cloud) e API Key.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium mb-1">3. Teste a conexão</p>
                  <p className="text-muted-foreground">
                    Após salvar, seus workflows aparecerão automaticamente na lista.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            {/* Tipos de gatilhos */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                Tipos de gatilhos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Agendamento</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Execute workflows em horários específicos (diário, semanal, etc.)
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Rss className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-sm">Feed RSS</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dispara quando há novos itens em um feed RSS configurado
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm">Webhook</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dispara quando recebe uma chamada HTTP externa
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Manual</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Execute manualmente pelo botão "Executar" na interface
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            {/* Fluxo de publicação */}
            <section>
              <h3 className="font-semibold text-lg mb-3">Fluxo de publicação automática</h3>
              <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Rss className="h-5 w-5" />
                    </div>
                    <span>Gatilho</span>
                  </div>
                  <div className="h-0.5 flex-1 bg-border mx-2" />
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Zap className="h-5 w-5" />
                    </div>
                    <span>Processa</span>
                  </div>
                  <div className="h-0.5 flex-1 bg-border mx-2" />
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      ✨
                    </div>
                    <span>IA Gera</span>
                  </div>
                  <div className="h-0.5 flex-1 bg-border mx-2" />
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Share2 className="h-5 w-5" />
                    </div>
                    <span>Publica</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                O workflow n8n pode chamar a API do KAI para gerar conteúdo e depois 
                publicar automaticamente nas redes sociais configuradas.
              </p>
            </section>

            <Separator />

            {/* Requisitos */}
            <section>
              <h3 className="font-semibold text-lg mb-3">Requisitos</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Plano Enterprise ativo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Conta n8n (cloud ou self-hosted)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>APIs das redes sociais configuradas (Twitter, LinkedIn, etc.)</span>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button asChild>
            <Link to="docs#automations">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Documentação Completa
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
