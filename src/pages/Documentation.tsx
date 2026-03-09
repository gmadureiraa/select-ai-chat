import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Book, 
  Sparkles, 
  BarChart3, 
  Settings,
  Users,
  ChevronRight,
  Search,
  Home,
  Wand2,
  MessageSquare,
  Calendar,
  Shield,
  HelpCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
            O kAI é o Canvas de criação de conteúdo com IA para profissionais de marketing. 
            Crie fluxos visuais que conectam fontes, briefings e IA para gerar conteúdo 
            profissional em escala.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <Sparkles className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-2">Canvas de Criação</h3>
            <p className="text-sm text-muted-foreground">
              Arraste, conecte e crie fluxos visuais de conteúdo com IA multi-agente.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <BarChart3 className="h-8 w-8 text-emerald-500 mb-3" />
            <h3 className="font-semibold mb-2">Performance Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Monitore métricas de todas as plataformas com insights automáticos.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <MessageSquare className="h-8 w-8 text-blue-500 mb-3" />
            <h3 className="font-semibold mb-2">Assistente kAI</h3>
            <p className="text-sm text-muted-foreground">
              Assistente inteligente para gerar ideias e conteúdos rapidamente.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
            <Calendar className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-2">Planejamento</h3>
            <p className="text-sm text-muted-foreground">
              Organize e agende publicações com quadro Kanban integrado.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/20">
          <h3 className="font-semibold mb-2">🚀 Primeiros Passos com o Canvas</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Crie um cliente e configure sua identidade</li>
            <li>Acesse o <strong>Canvas</strong> na sidebar</li>
            <li>Adicione nós: URL, briefing, referência</li>
            <li>Conecte ao nó de IA e gere conteúdo em batch</li>
          </ol>
        </div>

        {/* Canvas Highlight */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-pink-500/10 border border-primary/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">O Diferencial: Canvas Visual</h3>
              <p className="text-sm text-muted-foreground">Fluxos visuais + IA multi-agente</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-background/50 border">
              <p className="font-medium mb-1">Drag & Drop</p>
              <p className="text-xs text-muted-foreground">Arraste nós e conecte</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border">
              <p className="font-medium mb-1">Multi-Fonte</p>
              <p className="text-xs text-muted-foreground">URL, PDF, briefing, vídeo</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border">
              <p className="font-medium mb-1">Batch Generation</p>
              <p className="text-xs text-muted-foreground">Até 10 variações por vez</p>
            </div>
          </div>
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
    id: "smart-commands",
    title: "Comandos Inteligentes",
    icon: Wand2,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Comandos Inteligentes</h1>
          <p className="text-muted-foreground text-lg">
            O kAI entende linguagem natural e detecta automaticamente o que você precisa.
          </p>
        </div>

        {/* Image Generation */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🎨 Geração de Imagens com Linguagem Natural</h2>
          <p className="text-muted-foreground">
            Você não precisa usar comandos específicos. Basta pedir uma imagem naturalmente:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h4 className="font-medium mb-2">Comandos Suportados</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Gera uma imagem de..."</li>
                <li>• "Cria uma arte para..."</li>
                <li>• "Faz um visual de..."</li>
                <li>• "@imagem [descrição]"</li>
                <li>• "Preciso de uma imagem..."</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <h4 className="font-medium mb-2">Detecção de Plataforma</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stories/Reels → 9:16 vertical</li>
                <li>• Post Instagram → 1:1 quadrado</li>
                <li>• YouTube thumbnail → 16:9 horizontal</li>
                <li>• LinkedIn → 1.91:1</li>
                <li>• Pinterest → 2:3 vertical</li>
              </ul>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-r from-violet-500/5 to-pink-500/5 border">
            <h4 className="font-medium mb-2">💡 Exemplo de Uso</h4>
            <p className="text-sm text-muted-foreground italic">
              "Cria uma imagem para story do Instagram sobre meditação matinal, com cores suaves e uma pessoa em paz"
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              → O kAI detecta automaticamente: formato 9:16, estilo calmo, plataforma Instagram
            </p>
          </div>
        </div>

        {/* Contextual References */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🔗 Referências Contextuais</h2>
          <p className="text-muted-foreground">
            O kAI entende quando você referencia algo que ele disse antes:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">Referências Diretas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Desenvolva <strong>isso</strong>"</li>
                <li>• "Usa <strong>essa ideia</strong>"</li>
                <li>• "Baseado <strong>no que você falou</strong>..."</li>
                <li>• "Transforma <strong>isso</strong> em post"</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">Referências Numéricas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Desenvolve a <strong>primeira</strong> ideia"</li>
                <li>• "Gostei da <strong>terceira opção</strong>"</li>
                <li>• "A <strong>última sugestão</strong> ficou boa"</li>
                <li>• "Usa a <strong>opção 2</strong>"</li>
              </ul>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium mb-2">💬 Fluxo de Conversa Natural</h4>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground"><strong>Você:</strong> "Me dá 5 ideias de post sobre produtividade"</p>
              <p className="text-muted-foreground"><strong>kAI:</strong> [lista 5 ideias]</p>
              <p className="text-muted-foreground"><strong>Você:</strong> "Desenvolve a segunda"</p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                → O kAI sabe exatamente qual ideia você quer e a desenvolve automaticamente
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">⚡ Quick Actions Inteligentes</h2>
          <p className="text-muted-foreground">
            Após cada resposta, botões de ação aparecem automaticamente baseados no tipo de conteúdo:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium mb-2">💡 Para Ideias</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Desenvolver</span>
                <span className="px-2 py-1 text-xs rounded-full bg-violet-500/10 text-violet-500">Gerar imagem</span>
                <span className="px-2 py-1 text-xs rounded-full bg-pink-500/10 text-pink-500">Carrossel</span>
                <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-500">Mais ideias</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <h4 className="font-medium mb-2">📝 Para Conteúdo</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Gerar imagem</span>
                <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-500">Agendar</span>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-500">Revisar</span>
                <span className="px-2 py-1 text-xs rounded-full bg-purple-500/10 text-purple-500">Adaptar</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20">
              <h4 className="font-medium mb-2">📊 Para Análises</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-rose-500/10 text-rose-500">Sugestões</span>
                <span className="px-2 py-1 text-xs rounded-full bg-orange-500/10 text-orange-500">Relatório</span>
                <span className="px-2 py-1 text-xs rounded-full bg-teal-500/10 text-teal-500">Plano de ação</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <h4 className="font-medium mb-2">📋 Para Listas</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Desenvolver 1ª</span>
                <span className="px-2 py-1 text-xs rounded-full bg-violet-500/10 text-violet-500">Todas em posts</span>
                <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-500">Expandir</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Format */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">📐 Formato Automático de Imagens</h2>
          <p className="text-muted-foreground">
            O kAI detecta automaticamente o melhor formato baseado no contexto:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Plataforma</th>
                  <th className="text-left py-2 font-medium">Formato</th>
                  <th className="text-left py-2 font-medium">Dimensões</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2">Instagram Stories/Reels</td>
                  <td>9:16 vertical</td>
                  <td>1024×1820</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2">Instagram Post/Carrossel</td>
                  <td>1:1 quadrado</td>
                  <td>1024×1024</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2">YouTube Thumbnail</td>
                  <td>16:9 horizontal</td>
                  <td>1792×1024</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2">LinkedIn</td>
                  <td>1.91:1 banner</td>
                  <td>1200×628</td>
                </tr>
                <tr>
                  <td className="py-2">Pinterest</td>
                  <td>2:3 vertical</td>
                  <td>1024×1536</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h3 className="font-semibold mb-2">🎯 Dica Avançada</h3>
            <p className="text-sm text-muted-foreground">
              Você pode especificar o formato manualmente se preferir: 
              "Gera uma imagem <strong>quadrada</strong>..." ou "Cria um banner <strong>horizontal</strong>..."
            </p>
          </div>
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
            Convide membros para a equipe e gerencie permissões:
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
          <h2 className="text-xl font-semibold">Uso e Tokens</h2>
          <p className="text-muted-foreground">
            Visualize informações de uso e consumo de tokens.
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
  {
    id: "planning",
    title: "Planejamento",
    icon: Calendar,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Planejamento de Conteúdo</h1>
          <p className="text-muted-foreground text-lg">
            Organize e gerencie todo o pipeline de produção de conteúdo com o quadro Kanban.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quadro Kanban</h2>
          <p className="text-muted-foreground">
            Visualize o status de cada conteúdo através das colunas do quadro:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-blue-500 mb-2" />
              <p className="font-medium text-sm">Planejado</p>
              <p className="text-xs text-muted-foreground">Ideias e briefings</p>
            </div>
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-amber-500 mb-2" />
              <p className="font-medium text-sm">Em Produção</p>
              <p className="text-xs text-muted-foreground">Sendo criado</p>
            </div>
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-violet-500 mb-2" />
              <p className="font-medium text-sm">Aprovação</p>
              <p className="text-xs text-muted-foreground">Aguardando review</p>
            </div>
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mb-2" />
              <p className="font-medium text-sm">Publicado</p>
              <p className="text-xs text-muted-foreground">Finalizado</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Funcionalidades</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">📅 Agendamento</h4>
              <p className="text-sm text-muted-foreground">
                Defina datas de publicação e visualize no calendário integrado.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">🏷️ Labels</h4>
              <p className="text-sm text-muted-foreground">
                Organize por tipo de conteúdo, plataforma ou prioridade.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">👤 Atribuição</h4>
              <p className="text-sm text-muted-foreground">
                Atribua responsáveis para cada item do planejamento.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2">🔄 Drag & Drop</h4>
              <p className="text-sm text-muted-foreground">
                Mova itens entre colunas arrastando e soltando.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <h3 className="font-semibold mb-2">🚀 Publicação Agendada (Agency)</h3>
          <p className="text-sm text-muted-foreground">
            No plano Agency, conecte suas redes sociais para publicação automática 
            quando o item atingir a data agendada.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "permissions",
    title: "Permissões e Roles",
    icon: Shield,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Permissões e Roles</h1>
          <p className="text-muted-foreground text-lg">
            Entenda o sistema de permissões e como gerenciar acessos no seu workspace.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tabela de Permissões</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Funcionalidade</th>
                  <th className="text-center py-3 px-2 font-medium">Owner</th>
                  <th className="text-center py-3 px-2 font-medium">Admin</th>
                  <th className="text-center py-3 px-2 font-medium">Member</th>
                  <th className="text-center py-3 px-2 font-medium">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: "Usar Assistente IA", owner: true, admin: true, member: true, viewer: false },
                  { feature: "Editar Biblioteca", owner: true, admin: true, member: true, viewer: false },
                  { feature: "Editar Planejamento", owner: true, admin: true, member: true, viewer: false },
                  { feature: "Visualizar Performance", owner: true, admin: true, member: true, viewer: true },
                  { feature: "Gerenciar Clientes", owner: true, admin: true, member: false, viewer: false },
                  { feature: "Editar Base de Conhecimento", owner: true, admin: true, member: false, viewer: false },
                  { feature: "Gerenciar Time", owner: true, admin: true, member: false, viewer: false },
                  { feature: "Configurações Avançadas", owner: true, admin: true, member: false, viewer: false },
                  { feature: "Gerenciar Dados", owner: true, admin: false, member: false, viewer: false },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-muted/30">
                    <td className="py-2 px-4">{row.feature}</td>
                    <td className="text-center py-2 px-2">
                      {row.owner ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.admin ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.member ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                    <td className="text-center py-2 px-2">
                      {row.viewer ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Convidando Membros</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Acesse <strong>Configurações → Time</strong></li>
            <li>Clique em <strong>"Convidar membro"</strong></li>
            <li>Escolha o email e a role desejada</li>
            <li>O convidado receberá um email com link de acesso</li>
          </ol>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Atribuição de Clientes</h2>
          <p className="text-muted-foreground">
            Membros só veem os clientes aos quais foram atribuídos. Admins e owners 
            podem atribuir clientes específicos para cada membro na área de Time.
          </p>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h4 className="font-medium mb-2">💡 Dica</h4>
            <p className="text-sm text-muted-foreground">
              Use roles de Viewer para clientes que precisam apenas acompanhar o progresso 
              sem poder editar conteúdo.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: HelpCircle,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Troubleshooting</h1>
          <p className="text-muted-foreground text-lg">
            Soluções para problemas comuns e perguntas frequentes.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "O CSV não importa corretamente",
              a: "Verifique se o arquivo está no formato correto (UTF-8) e se as colunas correspondem ao esperado. O sistema detecta automaticamente o tipo de CSV baseado nas colunas."
            },
            {
              q: "A IA está gerando conteúdo fora do tom de voz",
              a: "Adicione mais exemplos na Biblioteca do cliente e revise o Guia de Identidade. Quanto mais contexto, melhor a IA captura o estilo."
            },
            {
              q: "Imagens não aparecem na biblioteca",
              a: "Verifique se o upload foi concluído. Arquivos muito grandes (>5MB) podem falhar. Tente reduzir o tamanho da imagem."
            },
            {
              q: "Não consigo acessar uma ferramenta",
              a: "Verifique sua role na equipe. Algumas ferramentas são restritas a Admins e Owners. Peça ao administrador para alterar sua permissão se necessário."
            },
            {
              q: "O carrossel do Instagram não importou todas as imagens",
              a: "Alguns carrosséis têm restrições de privacidade. Tente copiar o link diretamente do app do Instagram (não do navegador)."
            },
            {
              q: "Tokens acabaram antes do fim do mês",
              a: "Otimize prompts para usar menos tokens. Gerar imagens consome mais tokens que texto. Verifique o uso detalhado em Configurações."
            }
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">❓ {item.q}</h4>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h3 className="font-semibold mb-2">📧 Suporte</h3>
          <p className="text-sm text-muted-foreground">
            Não encontrou a solução? Entre em contato pelo email{" "}
            <a href="mailto:suporte@kaleidos.com.br" className="text-primary underline">
              suporte@kaleidos.com.br
            </a>{" "}
            ou pelo chat no canto inferior direito.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "changelog",
    title: "Changelog",
    icon: Book,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Changelog</h1>
          <p className="text-muted-foreground text-lg">
            Histórico de atualizações e melhorias do sistema.
          </p>
        </div>

        <div className="space-y-6">
          {[
            {
              version: "3.0.0",
              date: "Janeiro 2026",
              changes: [
                "Canvas de Criação de Conteúdo - Nova interface visual",
                "Novos planos: Basic ($25) e Agency ($100)",
                "IA multi-agente integrada ao Canvas",
                "Geração em batch (até 10 variações)",
                "Templates de fluxo prontos",
              ],
              type: "major"
            },
            {
              version: "2.5.0",
              date: "Janeiro 2026",
              changes: [
                "Sistema completo de permissões (Owner, Admin, Member, Viewer)",
                "Página de configurações reformulada",
                "Documentação expandida",
              ],
              type: "major"
            },
            {
              version: "2.4.0",
              date: "Dezembro 2025",
              changes: [
                "Novo sistema de planejamento com Kanban",
                "Calendário integrado para visualização",
                "Publicação agendada (Agency)",
              ],
              type: "major"
            },
            {
              version: "2.3.0",
              date: "Outubro 2025",
              changes: [
                "Base de Conhecimento com busca semântica",
                "Upload de PDFs com extração de texto",
                "Integração com websites para scraping",
              ],
              type: "minor"
            },
          ].map((release) => (
            <div key={release.version} className="relative pl-6 border-l-2 border-border">
              <div className={cn(
                "absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-background",
                release.type === "major" ? "bg-primary" : 
                release.type === "minor" ? "bg-violet-500" : "bg-muted-foreground"
              )} />
              <div className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono font-semibold">v{release.version}</span>
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs",
                    release.type === "major" ? "bg-primary/10 text-primary" :
                    release.type === "minor" ? "bg-violet-500/10 text-violet-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {release.type}
                  </span>
                </div>
                <ul className="space-y-1">
                  {release.changes.map((change, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function Documentation({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("export");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContent = sections.find(s => s.id === activeSection)?.content;

  // Embedded mode: render without header/full-page wrapper
  if (embedded) {
    return (
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <ScrollArea className="h-[calc(100vh-280px)]">
              <nav className="space-y-1">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="flex-1 text-left truncate">{section.title}</span>
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeContent}
        </div>
      </div>
    );
  }

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