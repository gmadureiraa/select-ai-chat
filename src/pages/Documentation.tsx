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
  XCircle,
  FileText,
  Layout,
  Palette,
  Library,
  Zap,
  Building2,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { formatRulesData, type FormatRuleData } from "@/lib/formatRulesData";

// ──────────────────────────────────────────────
// Sections
// ──────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

// Helper to render a format card
function FormatRuleCard({ format }: { format: FormatRuleData }) {
  return (
    <AccordionItem value={format.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-3 text-left">
          <span className="text-xl">{format.emoji}</span>
          <div>
            <p className="font-medium text-sm">{format.name}</p>
            <p className="text-xs text-muted-foreground font-normal">{format.summary}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-4">
        {/* Structure */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-primary">📐 Estrutura Obrigatória</h4>
          <div className="space-y-2">
            {format.structure.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Golden Rules */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-primary">✅ Regras de Ouro</h4>
          <ul className="space-y-1">
            {format.goldenRules.map((rule, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
        </div>

        {/* Delivery Format */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-primary">📋 Formato de Entrega</h4>
          <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap font-mono">
            {format.deliveryFormat}
          </pre>
        </div>

        {/* Common Mistakes */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-destructive">❌ Erros Comuns a Evitar</h4>
          <ul className="space-y-1">
            {format.commonMistakes.map((mistake, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-destructive/60 mt-0.5 shrink-0" />
                {mistake}
              </li>
            ))}
          </ul>
        </div>

        {/* Examples */}
        {format.examples && format.examples.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-primary">📌 Exemplos de Referência</h4>
            <div className="space-y-3">
              {format.examples.map((example, i) => (
                <pre key={i} className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border overflow-x-auto whitespace-pre-wrap font-mono">
                  {example}
                </pre>
              ))}
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
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
            O kAI é a plataforma de criação de conteúdo com IA para profissionais de marketing. 
            Crie fluxos visuais, gere conteúdo profissional em escala e gerencie todo o pipeline editorial.
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
      </div>
    ),
  },
  {
    id: "app-navigation",
    title: "Abas do App",
    icon: Layout,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Navegação do App</h1>
          <p className="text-muted-foreground text-lg">
            Todas as seções e abas disponíveis no kAI, acessíveis pela sidebar lateral.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              icon: <Palette className="h-5 w-5 text-primary" />,
              name: "Canvas",
              tab: "canvas",
              description: "Editor visual de fluxos de conteúdo com ReactFlow. Arraste nós (URL, Briefing, Referência, IA) e conecte para criar pipelines de geração. Suporta batch generation (até 10 variações). É o coração criativo da plataforma.",
              access: "Todos exceto Viewers",
            },
            {
              icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
              name: "kAI Chat",
              tab: "assistant",
              description: "Assistente conversacional com IA multi-agente. Gera conteúdo (tweets, carrosséis, newsletters...), imagens, ideias e análises. Detecta intenção automaticamente e adapta o formato. Suporta referências contextuais (\"desenvolva a segunda ideia\").",
              access: "Members, Admins, Owners",
            },
            {
              icon: <Calendar className="h-5 w-5 text-amber-500" />,
              name: "Planejamento",
              tab: "planning",
              description: "Quadro Kanban para gerenciar o pipeline editorial. Colunas: Planejado → Em Produção → Aprovação → Publicado. Suporta agendamento, labels, atribuição de responsáveis e visualização em calendário. Publicação automática via Late API (Enterprise).",
              access: "Todos (Viewers em read-only)",
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-emerald-500" />,
              name: "Performance",
              tab: "performance",
              description: "Dashboard de métricas de todas as plataformas sociais (Instagram, YouTube, LinkedIn, Newsletter/Beehiiv). Importação via CSV ou OAuth. Insights automáticos com IA. Top performers e tendências de crescimento.",
              access: "Todos (requer cliente selecionado)",
            },
            {
              icon: <Library className="h-5 w-5 text-violet-500" />,
              name: "Biblioteca",
              tab: "library",
              description: "Repositório de conteúdo do cliente. 3 abas: Content Library (posts, newsletters, cases), Reference Library (artigos, estudos de referência) e Visual References (logos, paletas, referências visuais). Suporta favoritos e sincronização RSS/Beehiiv.",
              access: "Todos (requer cliente selecionado)",
            },
            {
              icon: <Zap className="h-5 w-5 text-orange-500" />,
              name: "Automações",
              tab: "automations",
              description: "Criação de automações de conteúdo recorrente. Triggers: horário agendado, RSS feed, webhook. Gera conteúdo automaticamente com rotação editorial (8 categorias Twitter, 13 tipos LinkedIn). Disparo via Edge Functions.",
              access: "Admins, Owners, Dev access",
            },
            {
              icon: <Building2 className="h-5 w-5 text-pink-500" />,
              name: "Perfis (Clientes)",
              tab: "clients",
              description: "Gestão de clientes/marcas. Cada perfil tem: nome, descrição, avatar, guia de identidade, voice profile, redes sociais, websites, documentos e templates. O guia de identidade é usado pela IA para manter o tom de voz.",
              access: "Members, Admins, Owners",
            },
            {
              icon: <Settings className="h-5 w-5 text-muted-foreground" />,
              name: "Configurações",
              tab: "settings",
              description: "Perfil do usuário (nome, avatar, senha), Equipe (convidar membros, roles), Notificações (push, email, in-app), Aparência (tema claro/escuro) e Documentação (este guia).",
              access: "Admins, Owners",
            },
          ].map((item) => (
            <div key={item.tab} className="p-4 rounded-lg border border-border/50 bg-card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{item.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {item.access}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-semibold mb-2">💡 Navegação</h3>
          <p className="text-sm text-muted-foreground">
            A sidebar pode ser recolhida clicando no botão "Recolher" no rodapé. 
            No mobile, ela abre como drawer lateral via o menu hamburger no header.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "format-rules",
    title: "Regras de Criação de Conteúdo",
    icon: FileText,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Regras de Criação de Conteúdo</h1>
          <p className="text-muted-foreground text-lg">
            Guia completo com as regras, estrutura obrigatória e formato de entrega de cada tipo de conteúdo 
            suportado pelo kAI. Clique em cada formato para ver todos os detalhes.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h3 className="font-semibold mb-2">🔄 Pipeline de Geração</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Todo conteúdo gerado pelo kAI passa por 4 etapas automáticas:
          </p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 font-medium">1. Writer</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-500 font-medium">2. Validate</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 font-medium">3. Repair</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">4. Review</span>
          </div>
        </div>

        <Accordion type="multiple" className="space-y-2">
          {formatRulesData.map((format) => (
            <FormatRuleCard key={format.id} format={format} />
          ))}
        </Accordion>

        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-semibold mb-2">📌 Importante</h3>
          <p className="text-sm text-muted-foreground">
            Estas regras definem a <strong>estrutura e formato técnico</strong>. O tom de voz, estilo de escrita, 
            cores e personalidade vêm do <strong>perfil do cliente</strong> (guia de identidade, voice profile, brand assets).
          </p>
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
          <div className="p-6 rounded-xl bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 border border-border/50">
            <div className="flex items-center justify-between gap-2 mb-4">
              {[
                { icon: "✍️", name: "Writer", desc: "Escreve seguindo regras do formato" },
                { icon: "📝", name: "Validate", desc: "Verifica estrutura e regras" },
                { icon: "🔧", name: "Repair", desc: "Corrige problemas encontrados" },
                { icon: "✅", name: "Review", desc: "Limpeza final e polimento" },
              ].map((agent, i) => (
                <div key={agent.name} className="flex items-center flex-1">
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
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">12 Formatos Suportados</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {formatRulesData.map((f) => (
              <div key={f.id} className="p-3 rounded-lg bg-muted/30 border">
                <h4 className="font-medium text-sm">{f.emoji} {f.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Modelos de IA por Formato</h2>
          <p className="text-muted-foreground text-sm">
            Formatos complexos (carrossel, newsletter, blog, vídeo longo) usam <strong>Gemini 2.5 Pro</strong> para 
            máxima qualidade. Formatos curtos (tweet, post) usam <strong>Gemini 2.0 Flash</strong> para velocidade.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-semibold mb-2">💡 Dica</h3>
          <p className="text-sm text-muted-foreground">
            Quanto mais exemplos na biblioteca e mais detalhado o guia de identidade, 
            melhor a IA captura a voz autêntica do cliente.
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

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🎨 Geração de Imagens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h4 className="font-medium mb-2">Comandos Suportados</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Gera uma imagem de..."</li>
                <li>• "Cria uma arte para..."</li>
                <li>• "Faz um visual de..."</li>
                <li>• "@imagem [descrição]"</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <h4 className="font-medium mb-2">Detecção de Plataforma</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stories/Reels → 9:16 vertical</li>
                <li>• Post Instagram → 1:1 quadrado</li>
                <li>• YouTube thumbnail → 16:9</li>
                <li>• LinkedIn → 1.91:1</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🔗 Referências Contextuais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">Referências Diretas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Desenvolva <strong>isso</strong>"</li>
                <li>• "Usa <strong>essa ideia</strong>"</li>
                <li>• "Transforma <strong>isso</strong> em post"</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">Referências Numéricas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Desenvolve a <strong>primeira</strong> ideia"</li>
                <li>• "Gostei da <strong>terceira opção</strong>"</li>
                <li>• "Usa a <strong>opção 2</strong>"</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">⚡ Quick Actions</h2>
          <p className="text-muted-foreground text-sm">
            Após cada resposta, botões de ação aparecem automaticamente baseados no tipo de conteúdo:
            Desenvolver, Gerar imagem, Agendar, Revisar, Adaptar formato, etc.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "image-generation",
    title: "Geração de Imagens",
    icon: Image,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Geração de Imagens</h1>
          <p className="text-muted-foreground text-lg">
            Pipeline de geração de imagens com Gemini 2.0 Flash, DNA visual do cliente e regra "sem texto".
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pipeline</h2>
          <div className="space-y-2">
            {[
              { step: "1", title: "Prompt Enrichment", desc: "O prompt do usuário é enriquecido com o DNA visual do cliente (visual references, brand assets, paleta de cores)." },
              { step: "2", title: "Geração com Gemini", desc: "Gemini 2.0 Flash gera a imagem. Prompt inclui 'absolutely no text' para evitar texto na imagem." },
              { step: "3", title: "Retry 'Sem Texto'", desc: "Se o modelo adicionar texto na imagem, o sistema faz retry automático com prompt reforçado." },
              { step: "4", title: "Upload & Entrega", desc: "Imagem é salva no Storage e URL é retornada ao usuário/chat." },
            ].map((s) => (
              <div key={s.step} className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Formatos Automáticos</h2>
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
                {[
                  ["Instagram Stories/Reels", "9:16 vertical", "1024×1820"],
                  ["Instagram Post/Carrossel", "1:1 quadrado", "1024×1024"],
                  ["YouTube Thumbnail", "16:9 horizontal", "1792×1024"],
                  ["LinkedIn", "1.91:1 banner", "1200×628"],
                  ["Pinterest", "2:3 vertical", "1024×1536"],
                ].map(([platform, format, dims]) => (
                  <tr key={platform} className="border-b border-border/50">
                    <td className="py-2">{platform}</td>
                    <td>{format}</td>
                    <td>{dims}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            Monitore métricas de todas as plataformas sociais em um só lugar.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Plataformas Suportadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["Instagram", "YouTube", "Twitter/X", "Newsletter", "LinkedIn"].map((p) => (
              <div key={p} className="p-3 rounded-lg bg-muted/30 text-center text-sm font-medium">{p}</div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Funcionalidades</h2>
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>• Importação via CSV ou conexão OAuth</li>
            <li>• Métricas de posts individuais (engajamento, alcance, salvos)</li>
            <li>• Top performers identificados automaticamente</li>
            <li>• Insights com IA (melhores horários, tipos de conteúdo)</li>
            <li>• Metas e objetivos com acompanhamento de progresso</li>
            <li>• Sincronização RSS para newsletters (Beehiiv)</li>
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
            <li><strong>Guia de Identidade</strong>: Tom de voz, valores, posicionamento — usado pela IA</li>
            <li><strong>Voice Profile</strong>: Listas de palavras "USE" e "EVITE"</li>
            <li><strong>Redes Sociais</strong>: Links para perfis do cliente</li>
            <li><strong>Websites</strong>: URLs para scraping automático de contexto</li>
            <li><strong>Documentos</strong>: PDFs e apresentações com extração de texto</li>
            <li><strong>Templates</strong>: Regras de formato personalizadas</li>
            <li><strong>Tags</strong>: Categorização para filtragem</li>
          </ul>
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
            Organize o pipeline de produção com quadro Kanban e calendário integrado.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quadro Kanban</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color: "bg-blue-500", name: "Planejado", desc: "Ideias e briefings" },
              { color: "bg-amber-500", name: "Em Produção", desc: "Sendo criado" },
              { color: "bg-violet-500", name: "Aprovação", desc: "Aguardando review" },
              { color: "bg-emerald-500", name: "Publicado", desc: "Finalizado" },
            ].map((col) => (
              <div key={col.name} className="p-3 rounded-lg border border-border/50 bg-muted/30">
                <div className={cn("w-3 h-3 rounded-full mb-2", col.color)} />
                <p className="font-medium text-sm">{col.name}</p>
                <p className="text-xs text-muted-foreground">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Funcionalidades</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: "📅", title: "Agendamento", desc: "Defina datas de publicação e visualize no calendário." },
              { icon: "🏷️", title: "Labels", desc: "Organize por tipo, plataforma ou prioridade." },
              { icon: "👤", title: "Atribuição", desc: "Atribua responsáveis para cada item." },
              { icon: "🔄", title: "Drag & Drop", desc: "Mova itens entre colunas arrastando." },
              { icon: "🤖", title: "Geração IA", desc: "Gere conteúdo diretamente no card com um clique." },
              { icon: "📤", title: "Publicação", desc: "Publicação automática via Late API (Enterprise)." },
            ].map((f) => (
              <div key={f.title} className="p-3 rounded-lg border border-border/50">
                <h4 className="font-medium text-sm">{f.icon} {f.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
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
            Sistema de permissões por role no workspace.
          </p>
        </div>

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
                { feature: "Canvas", owner: true, admin: true, member: true, viewer: false },
                { feature: "Planejamento (editar)", owner: true, admin: true, member: true, viewer: false },
                { feature: "Planejamento (ver)", owner: true, admin: true, member: true, viewer: true },
                { feature: "Editar Biblioteca", owner: true, admin: true, member: true, viewer: false },
                { feature: "Visualizar Performance", owner: true, admin: true, member: true, viewer: true },
                { feature: "Gerenciar Clientes", owner: true, admin: true, member: false, viewer: false },
                { feature: "Automações", owner: true, admin: true, member: false, viewer: false },
                { feature: "Gerenciar Time", owner: true, admin: true, member: false, viewer: false },
                { feature: "Configurações", owner: true, admin: true, member: false, viewer: false },
              ].map((row) => (
                <tr key={row.feature} className="hover:bg-muted/30">
                  <td className="py-2 px-4">{row.feature}</td>
                  {[row.owner, row.admin, row.member, row.viewer].map((v, i) => (
                    <td key={i} className="text-center py-2 px-2">
                      {v ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            Soluções para problemas comuns.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { q: "A IA está gerando conteúdo fora do tom de voz", a: "Adicione mais exemplos na Biblioteca e revise o Guia de Identidade. Quanto mais contexto, melhor." },
            { q: "Carrossel com poucos slides ou texto longo", a: "O sistema valida automaticamente. Se falhar, revise o título — prompts mais específicos geram melhor resultado." },
            { q: "Imagens com texto indesejado", a: "O sistema faz retry automático com 'sem texto'. Se persistir, adicione 'sem nenhum texto' no prompt." },
            { q: "O CSV não importa corretamente", a: "Verifique formato UTF-8 e colunas corretas. O sistema detecta tipo de CSV automaticamente." },
            { q: "Não consigo acessar uma ferramenta", a: "Verifique sua role (Owner, Admin, Member, Viewer). Peça ao admin para ajustar permissões." },
            { q: "Tokens acabaram antes do fim do mês", a: "Imagens consomem mais tokens que texto. Verifique uso detalhado em Configurações." },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-lg border border-border/50">
              <h4 className="font-medium mb-2 text-primary">❓ {item.q}</h4>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
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
            Histórico de atualizações do sistema.
          </p>
        </div>

        <div className="space-y-6">
          {[
            {
              version: "3.2.0",
              date: "Março 2026",
              changes: [
                "Documentação completa de todos os 12 formatos de conteúdo integrada ao app",
                "Upgrade de modelo: Gemini 2.5 Pro para formatos complexos (carrossel, newsletter, blog)",
                "Validação pós-geração de carrosséis (contagem de palavras, slides, CTA)",
                "Parser robusto para carrosséis com múltiplos padrões de marcação",
                "Documentação 100% — 5 novos docs técnicos criados",
                "Changelog unificado em todos os documentos",
                "Aba 'Documentação' nas Configurações",
              ],
              type: "major" as const,
            },
            {
              version: "3.1.0",
              date: "Fevereiro 2026",
              changes: [
                "kAI Chat com detecção de intenção multi-modo (content, ideas, performance)",
                "Geração de imagens com DNA visual do cliente",
                "Automações com rotação editorial (8 categorias Twitter, 13 LinkedIn)",
                "Engagement Hub para Twitter com scoring de relevância",
                "Content Repurpose: YouTube → multi-formato",
              ],
              type: "major" as const,
            },
            {
              version: "3.0.0",
              date: "Janeiro 2026",
              changes: [
                "Canvas de Criação de Conteúdo — interface visual ReactFlow",
                "IA multi-agente integrada ao Canvas",
                "Geração em batch (até 10 variações)",
                "Sistema completo de permissões (Owner, Admin, Member, Viewer)",
              ],
              type: "major" as const,
            },
            {
              version: "2.5.0",
              date: "Dezembro 2025",
              changes: [
                "Novo sistema de planejamento com Kanban",
                "Calendário integrado para visualização",
                "Publicação agendada via Late API (Enterprise)",
              ],
              type: "minor" as const,
            },
          ].map((release) => (
            <div key={release.version} className="relative pl-6 border-l-2 border-border">
              <div className={cn(
                "absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-background",
                release.type === "major" ? "bg-primary" : "bg-violet-500"
              )} />
              <div className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono font-semibold">v{release.version}</span>
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs",
                    release.type === "major" ? "bg-primary/10 text-primary" : "bg-violet-500/10 text-violet-500"
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
  const [activeSection, setActiveSection] = useState("intro");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContent = sections.find(s => s.id === activeSection)?.content;

  if (embedded) {
    return (
      <div className="flex gap-6">
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
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {activeContent}
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

        <main className="flex-1 p-8 max-w-4xl">
          {activeContent}
        </main>
      </div>
    </div>
  );
}
