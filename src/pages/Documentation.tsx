import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Book, 
  Sparkles, 
  BarChart3, 
  Library, 
  Settings,
  Users,
  ChevronRight,
  Search,
  Home,
  BookOpen,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ExportableDocumentation } from "@/components/docs/ExportableDocumentation";

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const sections: DocSection[] = [
  {
    id: "export",
    title: "Exportar Documentação",
    icon: Download,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Exportar Documentação</h1>
          <p className="text-muted-foreground text-lg">
            Baixe a documentação técnica completa do sistema para análise offline ou uso com outras IAs.
          </p>
        </div>
        <ExportableDocumentation />
      </div>
    ),
  },
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
            e organização inteligente para maximizar sua presença digital.
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
            <BookOpen className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-2">Base de Conhecimento</h3>
            <p className="text-sm text-muted-foreground">
              Centralize documentos, guias e materiais de referência em um só lugar.
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

        {/* Screenshot placeholder */}
        <div className="p-8 rounded-xl bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Library className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Screenshot: Interface principal do kAI</p>
          <p className="text-xs text-muted-foreground/60">Imagem ilustrativa será adicionada aqui</p>
        </div>

        {/* Pricing info */}
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <h3 className="font-semibold mb-2">Planos Disponíveis</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 rounded bg-background">
              <p className="font-medium">Starter</p>
              <p className="text-muted-foreground">R$ 497,90/mês • 1 cliente • 10k tokens</p>
            </div>
            <div className="p-2 rounded bg-background">
              <p className="font-medium">Pro</p>
              <p className="text-muted-foreground">R$ 1.497,90/mês • 5 clientes • 3 membros</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">14 dias de trial gratuito em todos os planos</p>
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
          <h2 className="text-xl font-semibold">Pipeline Multi-Agente</h2>
          <p className="text-muted-foreground">
            Cada conteúdo passa por um pipeline de 4 agentes especializados que trabalham em sequência:
          </p>
          
          {/* Visual pipeline diagram */}
          <div className="p-6 rounded-xl bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 border border-border/50">
            <div className="flex items-center justify-between gap-2 mb-4">
              {[
                { step: 1, icon: "🔍", name: "Pesquisador", desc: "Analisa contexto e referências", color: "blue" },
                { step: 2, icon: "✍️", name: "Escritor", desc: "Aplica regras do formato", color: "violet" },
                { step: 3, icon: "📝", name: "Editor", desc: "Refina tom e estilo", color: "rose" },
                { step: 4, icon: "✅", name: "Revisor", desc: "Verificação final", color: "emerald" },
              ].map((agent, i) => (
                <div key={agent.step} className="flex items-center flex-1">
                  <div className="flex-1 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-xl mb-2">
                      {agent.icon}
                    </div>
                    <p className="text-xs font-medium">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.desc}</p>
                  </div>
                  {i < 3 && <div className="w-8 h-0.5 bg-border mx-1" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              O progresso do pipeline é exibido em tempo real durante a geração
            </p>
          </div>

          {/* Screenshot placeholder for pipeline */}
          <div className="p-6 rounded-xl bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Screenshot: Visualização do Pipeline em Ação</p>
            <p className="text-xs text-muted-foreground/60">GIF ou imagem do progresso será adicionado aqui</p>
          </div>
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
    id: "knowledge-base",
    title: "Base de Conhecimento",
    icon: BookOpen,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Base de Conhecimento</h1>
          <p className="text-muted-foreground text-lg">
            Centralize documentos, guias e materiais de referência para enriquecer 
            o contexto disponível para a IA.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tipos de Conteúdo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Documentos PDF</h4>
              <p className="text-sm text-muted-foreground">
                Faça upload de PDFs e o sistema extrai o texto automaticamente.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Links Web</h4>
              <p className="text-sm text-muted-foreground">
                Cole URLs de artigos e referências para salvar o conteúdo.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Notas</h4>
              <p className="text-sm text-muted-foreground">
                Crie notas e documentos diretamente na plataforma.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">Guias de Marca</h4>
              <p className="text-sm text-muted-foreground">
                Adicione brand books, manuais de identidade e tom de voz.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Busca Inteligente</h2>
          <p className="text-muted-foreground">
            A busca semântica encontra documentos relevantes mesmo usando termos diferentes.
            O sistema entende o significado, não apenas palavras-chave.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h3 className="font-semibold mb-2">Uso pela IA</h3>
          <p className="text-sm text-muted-foreground">
            A base de conhecimento é automaticamente consultada pelo Assistente kAI 
            para enriquecer o contexto das respostas e manter consistência.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "clients",
    title: "Gestão de Clientes",
    icon: Users,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Gestão de Clientes</h1>
          <p className="text-muted-foreground text-lg">
            Configure múltiplos clientes com identidades, templates e bibliotecas independentes.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Cadastro de Cliente</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><strong>Nome e descrição</strong>: Identificação básica</li>
            <li><strong>Avatar</strong>: Logo ou imagem representativa</li>
            <li><strong>Guia de Identidade</strong>: Tom de voz, valores, posicionamento</li>
            <li><strong>Redes Sociais</strong>: Links para perfis do cliente</li>
            <li><strong>Tags</strong>: Categorização para filtragem</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Templates</h2>
          <p className="text-muted-foreground">
            Cada cliente pode ter templates personalizados com regras de formato, 
            exemplos de referência e instruções específicas.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Websites</h2>
          <p className="text-muted-foreground">
            Adicione URLs do cliente para o sistema fazer scraping automático 
            e manter o contexto atualizado.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Documentos</h2>
          <p className="text-muted-foreground">
            Faça upload de PDFs, apresentações e outros documentos. 
            O conteúdo é extraído e fica disponível para a IA.
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
            Gerencie sua conta, equipe e preferências do sistema.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Perfil</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><strong>Nome e avatar</strong>: Personalização da conta</li>
            <li><strong>Email</strong>: Email de login (não editável)</li>
            <li><strong>Tema</strong>: Claro, escuro ou automático</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Equipe</h2>
          <p className="text-muted-foreground">
            Convide membros para seu workspace e gerencie permissões:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="font-medium text-sm">Owner</p>
              <p className="text-xs text-muted-foreground">Acesso total + billing</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="font-medium text-sm">Admin</p>
              <p className="text-xs text-muted-foreground">Acesso total exceto billing</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="font-medium text-sm">Member</p>
              <p className="text-xs text-muted-foreground">Acesso a clientes permitidos</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Plano e Tokens</h2>
          <p className="text-muted-foreground">
            Visualize seu plano atual, consumo de tokens e faça upgrade se necessário.
          </p>
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
      </div>
    ),
  },
];

export default function Documentation() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("export");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContent = sections.find(s => s.id === activeSection)?.content;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold">Documentação</h1>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border/50 h-[calc(100vh-56px)] sticky top-14">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-[calc(100vh-160px)]">
              <nav className="space-y-1">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{section.title}</span>
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      activeSection === section.id && "rotate-90"
                    )} />
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 max-w-4xl">
          {activeContent}
        </main>
      </div>
    </div>
  );
}