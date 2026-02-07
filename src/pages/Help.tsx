import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Search, 
  LayoutDashboard, 
  Sparkles, 
  Users, 
  BarChart3, 
  Calendar, 
  Settings, 
  HelpCircle,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  MessageCircle,
  BookOpen,
  Zap,
  Play
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Preciso+de+ajuda+com+o+KAI.&type=phone_number&app_absent=0";

const categories = [
  {
    id: "getting-started",
    title: "Primeiros Passos",
    icon: Zap,
    description: "Como começar a usar o KAI",
    articles: [
      { title: "Criando sua conta", slug: "criando-conta" },
      { title: "Configurando seu primeiro cliente", slug: "primeiro-cliente" },
      { title: "Entendendo a interface", slug: "interface" },
      { title: "Tour rápido pelo Canvas", slug: "tour-canvas" },
    ],
  },
  {
    id: "canvas",
    title: "Canvas de Criação",
    icon: LayoutDashboard,
    description: "Como usar o Canvas visual",
    articles: [
      { title: "Introdução ao Canvas", slug: "intro-canvas" },
      { title: "Tipos de nós disponíveis", slug: "tipos-nos" },
      { title: "Conectando nós e fluxos", slug: "conexoes" },
      { title: "Gerando conteúdo em batch", slug: "batch-generation" },
      { title: "Salvando e reutilizando templates", slug: "templates" },
    ],
  },
  {
    id: "assistant",
    title: "Assistente kAI",
    icon: Sparkles,
    description: "Conversando com o assistente",
    articles: [
      { title: "O que o kAI pode fazer", slug: "kai-capacidades" },
      { title: "Modos de chat (Ideias, Conteúdo, Livre)", slug: "modos-chat" },
      { title: "Usando @menções", slug: "mencoes" },
      { title: "Criando cards com comandos", slug: "comandos-cards" },
    ],
  },
  {
    id: "clients",
    title: "Gerenciando Perfis",
    icon: Users,
    description: "Configurando e organizando perfis",
    articles: [
      { title: "Criando um novo perfil", slug: "criar-cliente" },
      { title: "Configurando contexto e tom de voz", slug: "contexto-tom" },
      { title: "Adicionando referências e documentos", slug: "referencias" },
      { title: "Conectando redes sociais", slug: "conectar-redes" },
    ],
  },
  {
    id: "performance",
    title: "Performance & Analytics",
    icon: BarChart3,
    description: "Métricas e análises",
    articles: [
      { title: "Importando métricas (CSV)", slug: "importar-csv" },
      { title: "Entendendo os dashboards", slug: "dashboards" },
      { title: "Análise de conteúdo com IA", slug: "analise-ia" },
      { title: "Exportando relatórios", slug: "exportar" },
    ],
  },
  {
    id: "planning",
    title: "Planejamento",
    icon: Calendar,
    description: "Kanban e publicação",
    articles: [
      { title: "Usando o quadro Kanban", slug: "kanban" },
      { title: "Agendando publicações", slug: "agendamento" },
      { title: "Trabalhando em equipe", slug: "equipe" },
    ],
  },
  {
    id: "settings",
    title: "Configurações",
    icon: Settings,
    description: "Conta e preferências",
    articles: [
      { title: "Gerenciando seu plano", slug: "plano" },
      { title: "Configurando workspace", slug: "workspace" },
      { title: "Convidando membros", slug: "membros" },
      { title: "Integrações e APIs", slug: "integracoes" },
    ],
  },
];

const faqs = [
  {
    question: "O que é o KAI?",
    answer: "KAI é uma plataforma de criação de conteúdo com IA. Você pode criar posts, legendas, roteiros e mais usando um Canvas visual intuitivo, onde conecta fontes de conteúdo, briefings e modelos de IA.",
  },
  {
    question: "Preciso saber programar para usar?",
    answer: "Não! O KAI foi feito para criadores de conteúdo e agências. A interface é visual e intuitiva - basta arrastar, conectar e gerar.",
  },
  {
    question: "Quais são os níveis de acesso?",
    answer: "Admin tem acesso total ao sistema. Membro pode criar e editar conteúdo, mas não gerencia equipe. Visualizador tem acesso somente leitura ao planejamento, performance e biblioteca.",
  },
  {
    question: "Como solicitar acesso?",
    answer: "Entre em contato com o administrador do sistema para receber um convite. Você receberá um email com instruções para criar sua conta.",
  },
  {
    question: "Como funciona a IA multi-agente?",
    answer: "O KAI usa 4 agentes especializados: Pesquisador (coleta contexto), Estrategista (define abordagem), Redator (cria o texto) e Editor (refina e formata). Eles trabalham juntos para criar conteúdo de alta qualidade.",
  },
];

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = categories.filter(
    (category) =>
      category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.articles.some((article) =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={kaleidosLogo} alt="KAI" className="h-8 w-8" />
              <span className="text-xl font-semibold">KAI</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">Central de Ajuda</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/kai">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao app
              </Button>
            </Link>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com suporte
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como podemos ajudar?
            </h1>
            <p className="text-muted-foreground mb-8">
              Encontre respostas, tutoriais e guias para usar o KAI
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar artigos, tutoriais..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="text-sm text-muted-foreground">Acesso rápido:</span>
            <Link to="/kai" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <LayoutDashboard className="w-4 h-4" />
              Abrir Canvas
            </Link>
            <Link to="/kai?tab=planning" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Calendar className="w-4 h-4" />
              Planejamento
            </Link>
            <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Settings className="w-4 h-4" />
              Configurações
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-foreground mb-8">Categorias</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{category.title}</CardTitle>
                          <CardDescription>{category.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {category.articles.slice(0, 4).map((article) => (
                          <li key={article.slug}>
                            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left">
                              <ChevronRight className="w-3 h-3" />
                              {article.title}
                            </button>
                          </li>
                        ))}
                        {category.articles.length > 4 && (
                          <li className="text-sm text-primary">
                            +{category.articles.length - 4} artigos
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Video Tutorial */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Aprenda em 5 minutos</h2>
            <p className="text-muted-foreground">Veja como criar seu primeiro conteúdo com o Canvas</p>
          </div>
          <div className="relative aspect-video bg-card rounded-2xl border border-border overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <Button size="lg" className="gap-2">
                <Play className="w-5 h-5" />
                Assistir tutorial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            Perguntas frequentes
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`}
                className="border border-border rounded-lg px-4"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Não encontrou o que procurava?</h2>
          <p className="opacity-80 mb-6">
            Nossa equipe está pronta para ajudar você.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="lg">
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar no WhatsApp
              </Button>
            </a>
            <a href="mailto:contato@kaleidos.ai">
              <Button variant="outline" size="lg" className="bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10">
                Enviar email
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} KAI by Kaleidos
          </p>
          <div className="flex items-center gap-6">
            <Link to="/kaleidos" className="text-sm text-muted-foreground hover:text-foreground">
              Voltar ao app
            </Link>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
              Contato
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Help;
