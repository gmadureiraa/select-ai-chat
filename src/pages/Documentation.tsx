import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Book, 
  Sparkles, 
  BarChart3, 
  Library, 
  Settings,
  Zap,
  Workflow,
  FlaskConical,
  Users,
  ChevronRight,
  Search,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDevAccess } from "@/hooks/useDevAccess";

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const sections: DocSection[] = [
  {
    id: "intro",
    title: "Introdução",
    icon: Home,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Bem-vindo ao kAI</h1>
          <p className="text-muted-foreground text-lg">
            O kAI é sua plataforma completa de inteligência artificial para criação e gestão de conteúdo. 
            Desenvolvido pela Kaleidos, ele combina análise de performance, geração de conteúdo por IA 
            e automações para maximizar sua presença digital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <Sparkles className="h-8 w-8 text-violet-500 mb-3" />
            <h3 className="font-semibold mb-2">Assistente IA</h3>
            <p className="text-sm text-muted-foreground">
              Crie conteúdo de alta qualidade com IA que entende a identidade do seu cliente.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <BarChart3 className="h-8 w-8 text-emerald-500 mb-3" />
            <h3 className="font-semibold mb-2">Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Monitore performance em todas as plataformas com insights automáticos.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <Library className="h-8 w-8 text-blue-500 mb-3" />
            <h3 className="font-semibold mb-2">Biblioteca</h3>
            <p className="text-sm text-muted-foreground">
              Organize todo conteúdo produzido e referências de inspiração.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <Zap className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-2">Automações</h3>
            <p className="text-sm text-muted-foreground">
              Automatize tarefas repetitivas e economize horas de trabalho.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/20">
          <h3 className="font-semibold mb-2">Primeiros Passos</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Crie ou selecione um cliente na sidebar</li>
            <li>Configure a identidade do cliente (tom de voz, posicionamento)</li>
            <li>Comece a criar conteúdo com o Assistente</li>
            <li>Importe dados de performance via CSV</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "assistant",
    title: "Assistente kAI",
    icon: Sparkles,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Assistente kAI</h1>
          <p className="text-muted-foreground text-lg">
            Sistema multi-agente que gera conteúdo profissional mantendo a voz autêntica do cliente.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">11 Agentes Especializados</h2>
          <p className="text-muted-foreground">
            Cada tipo de conteúdo tem um agente especializado com regras específicas:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: "Newsletter", desc: "Assunto + preview + corpo estruturado" },
              { name: "Email Marketing", desc: "Copy de vendas + CTAs + urgência" },
              { name: "Carrossel", desc: "10 slides + gancho + legenda" },
              { name: "Post Estático", desc: "Uma mensagem + visual impactante" },
              { name: "Reels/Shorts", desc: "Roteiro 15-60s + gancho 2s" },
              { name: "Vídeo Longo", desc: "Roteiro YouTube + capítulos" },
              { name: "Tweet", desc: "280 chars + take quente" },
              { name: "Thread", desc: "5-15 tweets + numeração" },
              { name: "LinkedIn", desc: "Storytelling profissional" },
              { name: "Artigo", desc: "1500-3000 palavras estruturadas" },
              { name: "Blog Post", desc: "SEO otimizado + meta description" }
            ].map((agent) => (
              <div key={agent.name} className="p-3 rounded-lg bg-muted/30 border">
                <h4 className="font-medium text-sm">{agent.name}</h4>
                <p className="text-xs text-muted-foreground">{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pipeline de Geração</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-500">1</span>
              </div>
              <div>
                <h4 className="font-medium">Pesquisador</h4>
                <p className="text-sm text-muted-foreground">
                  Analisa biblioteca e extrai padrões do cliente.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/10">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-500">2</span>
              </div>
              <div>
                <h4 className="font-medium">Escritor</h4>
                <p className="text-sm text-muted-foreground">
                  Aplica regras do formato específico (carrossel, newsletter, etc.).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-rose-500">3</span>
              </div>
              <div>
                <h4 className="font-medium">Editor de Estilo (Crítico)</h4>
                <p className="text-sm text-muted-foreground">
                  Compara com exemplos reais e ajusta tom/vocabulário para autenticidade.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-500">4</span>
              </div>
              <div>
                <h4 className="font-medium">Verificador</h4>
                <p className="text-sm text-muted-foreground">
                  Revisão final de qualidade, checando regras e consistência.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-semibold mb-2">💡 Dica</h3>
          <p className="text-sm text-muted-foreground">
            Quanto mais exemplos na biblioteca, melhor a IA captura a voz autêntica do cliente.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "performance",
    title: "Performance",
    icon: BarChart3,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Performance Analytics</h1>
          <p className="text-muted-foreground text-lg">
            Monitore métricas de todas as plataformas sociais em um só lugar, 
            com insights automáticos gerados por IA.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Plataformas Suportadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["Instagram", "YouTube", "Twitter/X", "Newsletter", "TikTok"].map((platform) => (
              <div key={platform} className="p-3 rounded-lg bg-muted/30 text-center">
                <span className="text-sm font-medium">{platform}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Importação de Dados</h2>
          <p className="text-muted-foreground">
            Importe dados via CSV exportado das plataformas. O sistema detecta 
            automaticamente o tipo de arquivo e faz a validação dos dados.
          </p>
          <div className="p-4 rounded-lg border border-border/50">
            <h4 className="font-medium mb-2">Instagram</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Métricas diárias (visão geral, alcance, seguidores)</li>
              <li>• Métricas de posts individuais (engajamento, salvos)</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-border/50">
            <h4 className="font-medium mb-2">YouTube</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Conexão via OAuth para dados automáticos</li>
              <li>• Importação CSV de métricas históricas</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Metas e Objetivos</h2>
          <p className="text-muted-foreground">
            Defina metas para cada métrica e acompanhe o progresso. 
            O sistema calcula automaticamente o percentual atingido.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Insights Automáticos</h2>
          <p className="text-muted-foreground">
            Após importar dados, a IA analisa padrões e gera insights sobre:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Melhores horários para postar</li>
            <li>Tipos de conteúdo com maior engajamento</li>
            <li>Tendências de crescimento</li>
            <li>Recomendações estratégicas</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "library",
    title: "Biblioteca",
    icon: Library,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Biblioteca de Conteúdo</h1>
          <p className="text-muted-foreground text-lg">
            Organize todo conteúdo produzido e materiais de referência para cada cliente.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Biblioteca de Conteúdo</h2>
          <p className="text-muted-foreground">
            Armazena todo conteúdo produzido para o cliente, servindo como 
            referência de estilo para novas gerações.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Newsletter", "Carrossel", "Tweet/Thread", "Roteiro", "Blog", "LinkedIn"].map((type) => (
              <div key={type} className="p-2 rounded bg-muted/30 text-center text-sm">
                {type}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Biblioteca de Referências</h2>
          <p className="text-muted-foreground">
            Materiais externos de inspiração: exemplos de concorrentes, 
            tendências, designs de referência.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Importação de Carrossel</h2>
          <p className="text-muted-foreground">
            Cole um link do Instagram para extrair automaticamente todas as 
            imagens e texto de um carrossel.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <h3 className="font-semibold mb-2">Importância para a IA</h3>
          <p className="text-sm text-muted-foreground">
            O Assistente kAI usa a biblioteca para entender o estilo real do cliente. 
            Quanto mais exemplos, melhor a qualidade do conteúdo gerado.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "automations",
    title: "Automações",
    icon: Zap,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Automações</h1>
          <p className="text-muted-foreground text-lg">
            Configure tarefas automáticas que rodam em horários específicos, 
            economizando tempo em atividades repetitivas.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tipos de Automação</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Geração de Conteúdo</h4>
              <p className="text-sm text-muted-foreground">
                Crie rascunhos de newsletter, posts ou ideias automaticamente 
                em horários programados.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Relatórios de Performance</h4>
              <p className="text-sm text-muted-foreground">
                Gere relatórios semanais/mensais com análise de métricas e tendências.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Monitoramento</h4>
              <p className="text-sm text-muted-foreground">
                Acompanhe métricas e receba alertas quando metas forem atingidas ou 
                houver quedas significativas.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Agendamento</h2>
          <p className="text-muted-foreground">
            Configure quando a automação deve rodar:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Uma vez (data específica)</li>
            <li>Diariamente</li>
            <li>Semanalmente (dias específicos)</li>
            <li>Mensalmente</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "agent-builder",
    title: "Agent Builder",
    icon: Workflow,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Agent Builder</h1>
          <p className="text-muted-foreground text-lg">
            Crie workflows de IA personalizados com interface visual drag-and-drop.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tipos de Nós</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-medium text-blue-600">Trigger</h4>
              <p className="text-sm text-muted-foreground">Inicia o workflow (manual ou agendado)</p>
            </div>
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h4 className="font-medium text-violet-600">Agent</h4>
              <p className="text-sm text-muted-foreground">Executa uma tarefa com IA</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h4 className="font-medium text-amber-600">Condition</h4>
              <p className="text-sm text-muted-foreground">Lógica condicional (if/else)</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="font-medium text-emerald-600">Tool</h4>
              <p className="text-sm text-muted-foreground">Integração externa (n8n, webhooks)</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Integração n8n</h2>
          <p className="text-muted-foreground">
            Conecte workflows do n8n como ferramentas dentro dos agents, 
            permitindo automações complexas com serviços externos.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "research",
    title: "Lab de Pesquisa",
    icon: FlaskConical,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Lab de Pesquisa</h1>
          <p className="text-muted-foreground text-lg">
            Canvas infinito para pesquisa visual, coleta de referências 
            e análise de conteúdo com IA.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recursos</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Canvas Visual</h4>
              <p className="text-sm text-muted-foreground">
                Arraste e organize imagens, textos, PDFs e links em um quadro infinito.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">IA Integrada</h4>
              <p className="text-sm text-muted-foreground">
                Chat com IA que tem acesso a todos os itens do projeto para análise contextual.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Conexões</h4>
              <p className="text-sm text-muted-foreground">
                Conecte itens relacionados para criar mapas de conhecimento visual.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "team",
    title: "Equipe",
    icon: Users,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Gestão de Equipe</h1>
          <p className="text-muted-foreground text-lg">
            Convide membros para seu workspace e gerencie permissões de acesso.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Níveis de Permissão</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Owner</h4>
              <p className="text-sm text-muted-foreground">
                Acesso total. Pode excluir clientes, gerenciar equipe e todas as configurações.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Admin</h4>
              <p className="text-sm text-muted-foreground">
                Mesmas permissões do Owner, exceto transferir propriedade.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Member</h4>
              <p className="text-sm text-muted-foreground">
                Pode ver, criar e editar. Não pode excluir clientes ou recursos importantes. 
                Acesso restrito a ferramentas avançadas.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Acesso por Cliente</h2>
          <p className="text-muted-foreground">
            Owners e Admins podem restringir membros a clientes específicos. 
            Membros sem restrição veem todos os clientes do workspace.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    title: "Configurações",
    icon: Settings,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Configurações</h1>
          <p className="text-muted-foreground text-lg">
            Personalize seu workspace e configure integrações.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Configurações do Cliente</h2>
          <p className="text-muted-foreground">
            Cada cliente tem suas próprias configurações:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Logo/Avatar personalizado</li>
            <li>Guia de identidade e posicionamento</li>
            <li>Redes sociais vinculadas</li>
            <li>Documentos de referência</li>
            <li>Tags e segmentação</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Uso de IA</h2>
          <p className="text-muted-foreground">
            Acompanhe consumo de tokens e custos estimados por modelo e função.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "orchestrator",
    title: "Orquestrador",
    icon: Workflow,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Orquestrador Inteligente</h1>
          <p className="text-muted-foreground text-lg">
            Sistema que analisa a complexidade do pedido e decide automaticamente 
            qual pipeline de agentes utilizar.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Como Funciona</h2>
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 font-bold text-sm">1</div>
                <div>
                  <p className="font-medium">Análise de Intenção</p>
                  <p className="text-sm text-muted-foreground">Detecta se é pergunta, geração, análise ou tarefa complexa</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 font-bold text-sm">2</div>
                <div>
                  <p className="font-medium">Seleção de Pipeline</p>
                  <p className="text-sm text-muted-foreground">Escolhe entre chat simples, single-agent, ou multi-agent</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 font-bold text-sm">3</div>
                <div>
                  <p className="font-medium">Execução Coordenada</p>
                  <p className="text-sm text-muted-foreground">Passa contexto entre agentes com memória compartilhada</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tipos de Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="font-medium text-emerald-600 mb-2">Chat Simples</h4>
              <p className="text-sm text-muted-foreground">Perguntas rápidas, conversas gerais. Usa resposta direta sem pipeline.</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-medium text-blue-600 mb-2">Single-Agent</h4>
              <p className="text-sm text-muted-foreground">Tarefas específicas com um agente especializado (ex: gerar um tweet).</p>
            </div>
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h4 className="font-medium text-violet-600 mb-2">Multi-Agent</h4>
              <p className="text-sm text-muted-foreground">Tarefas complexas com 4 agentes em sequência (pesquisador → escritor → editor → verificador).</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Agentes Especializados</h2>
          <p className="text-muted-foreground">O sistema conta com 6 agentes core que podem ser combinados:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { name: "Researcher", role: "Busca dados no banco e biblioteca" },
              { name: "Content Writer", role: "Gera conteúdo seguindo regras de formato" },
              { name: "Style Editor", role: "Ajusta tom e voz para o cliente" },
              { name: "Reviewer", role: "Verifica qualidade e consistência" },
              { name: "Data Analyst", role: "Analisa métricas e gera insights" },
              { name: "Strategist", role: "Cria planos e recomendações" },
            ].map((agent) => (
              <div key={agent.name} className="p-3 rounded-lg bg-muted/30 border">
                <p className="font-medium text-sm">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "technical",
    title: "Conceitos Técnicos",
    icon: Book,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Conceitos Técnicos</h1>
          <p className="text-muted-foreground text-lg">
            Documentação técnica interna sobre a arquitetura do sistema.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">RAG (Retrieval-Augmented Generation)</h2>
          <div className="p-4 rounded-lg bg-muted/30 border">
            <p className="text-muted-foreground mb-3">
              Técnica que combina busca de documentos com geração de texto. O kAI usa RAG para:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span><strong>Buscar contexto relevante</strong>: Antes de gerar, busca na biblioteca do cliente exemplos similares</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span><strong>Grounding</strong>: A resposta é "ancorada" em dados reais, evitando alucinações</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span><strong>Personalização</strong>: Usa o guia de identidade para manter o tom correto</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Context Window</h2>
          <div className="p-4 rounded-lg bg-muted/30 border">
            <p className="text-muted-foreground mb-3">
              Quantidade máxima de texto que o modelo consegue processar de uma vez.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 rounded bg-background">
                <p className="font-medium">Gemini 2.5 Flash</p>
                <p className="text-muted-foreground">~1M tokens (~750k palavras)</p>
              </div>
              <div className="p-2 rounded bg-background">
                <p className="font-medium">GPT-5</p>
                <p className="text-muted-foreground">~128k tokens (~100k palavras)</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              O kAI otimiza o uso do context window priorizando: guia de identidade → regras do template → exemplos recentes → histórico.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Multi-Agent Pipeline</h2>
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-muted-foreground mb-3">
              Arquitetura onde múltiplos agentes LLM trabalham em sequência, cada um com uma especialidade:
            </p>
            <div className="space-y-2 text-sm font-mono">
              <div className="p-2 rounded bg-background/50">
                <code>input → Researcher → Writer → Editor → Reviewer → output</code>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Cada agente recebe o output do anterior + contexto original. O estado é mantido em memória compartilhada.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Streaming SSE</h2>
          <div className="p-4 rounded-lg bg-muted/30 border">
            <p className="text-muted-foreground mb-3">
              Server-Sent Events para resposta em tempo real. A resposta chega token por token:
            </p>
            <ul className="space-y-1 text-sm">
              <li>• <strong>Latência percebida baixa</strong>: Usuário vê texto enquanto gera</li>
              <li>• <strong>Progresso visual</strong>: Animação de "digitando"</li>
              <li>• <strong>Cancelamento</strong>: Pode parar geração a qualquer momento</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Mapeamento de Arquivos</h2>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-muted-foreground mb-3 text-sm">
              Principais arquivos do sistema de agentes:
            </p>
            <div className="space-y-1 text-xs font-mono">
              <p><span className="text-amber-600">types/contentAgents.ts</span> - Definição dos 11 agentes de conteúdo</p>
              <p><span className="text-amber-600">types/orchestrator.ts</span> - Agentes especializados do orquestrador</p>
              <p><span className="text-amber-600">types/template.ts</span> - Regras de formato por tipo</p>
              <p><span className="text-amber-600">hooks/useClientChat.ts</span> - Lógica principal do chat</p>
              <p><span className="text-amber-600">functions/execute-agent</span> - Edge function que executa agentes</p>
              <p><span className="text-amber-600">functions/orchestrator</span> - Orquestrador multi-agente</p>
              <p><span className="text-amber-600">functions/chat</span> - Chat simples com streaming</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function Documentation() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("intro");
  const [searchQuery, setSearchQuery] = useState("");
  const { canAccessAutomations, canAccessAgentBuilder, canAccessResearchLab } = useDevAccess();

  // Filter sections based on dev access
  const visibleSections = useMemo(() => {
    const devOnlySections = [
      ...(!canAccessAutomations ? ['automations'] : []),
      ...(!canAccessAgentBuilder ? ['agent-builder'] : []),
      ...(!canAccessResearchLab ? ['research'] : []),
    ];
    return sections.filter(s => !devOnlySections.includes(s.id));
  }, [canAccessAutomations, canAccessAgentBuilder, canAccessResearchLab]);

  const filteredSections = visibleSections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentSection = visibleSections.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/50 bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/30">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/kai')}
            className="gap-2 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao kAI
          </Button>
          <div className="flex items-center gap-2">
            <Book className="h-5 w-5 text-violet-500" />
            <span className="font-semibold">Documentação</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0"
            />
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-muted/80",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <section.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{section.title}</span>
                {activeSection === section.id && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center">
            kAI by Kaleidos © 2024
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {currentSection?.content}
        </div>
      </div>
    </div>
  );
}
