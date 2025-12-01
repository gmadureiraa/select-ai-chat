import { useNavigate } from "react-router-dom";
import AgentCard from "@/components/agents/AgentCard";

const Agents = () => {
  const navigate = useNavigate();

  const agents = [
    {
      title: "Engenharia Reversa",
      subtitle: "Análise e recriação de conteúdo",
      description: "Analise qualquer conteúdo de referência e recrie adaptado ao estilo único do seu cliente",
      features: [
        "Análise de Reels e vídeos",
        "Carrosséis e posts",
        "Blogs e artigos",
        "Adaptação ao cliente",
      ],
      accentColor: "accent" as const,
      onOpen: () => navigate("/reverse-engineering"),
    },
    {
      title: "Assistente kAI",
      subtitle: "Criação de conteúdo com IA",
      description: "Chat inteligente com templates personalizados para criar conteúdo estratégico",
      features: [
        "Chat contextual por cliente",
        "Templates personalizáveis",
        "Geração de imagens",
        "Automações programadas",
      ],
      accentColor: "primary" as const,
      onOpen: () => navigate("/clients"),
    },
    {
      title: "Análise de Performance",
      subtitle: "Métricas e insights automatizados",
      description: "Coleta e análise automática de dados de performance em múltiplas plataformas",
      features: [
        "Dashboards em tempo real",
        "Alertas inteligentes",
        "Relatórios automatizados",
        "Análise preditiva",
      ],
      accentColor: "accent" as const,
      onOpen: () => navigate("/performance"),
    },
    {
      title: "Automação de Conteúdo",
      subtitle: "Criação e publicação automatizada",
      description: "Geração e distribuição automática de conteúdo em múltiplos canais e formatos",
      features: [
        "Multi-plataforma",
        "Agendamento inteligente",
        "Personalização em escala",
        "Otimização por IA",
      ],
      accentColor: "secondary" as const,
      onOpen: () => navigate("/automations"),
    },
    {
      title: "Laboratório de Pesquisa",
      subtitle: "Canvas multimodal de análise",
      description: "Organize e analise vídeos, textos, áudios e imagens em um espaço visual interativo",
      features: [
        "Vídeos do YouTube",
        "Transcrição automática",
        "Chat com IA",
        "Síntese inteligente",
      ],
      accentColor: "primary" as const,
      onOpen: () => navigate("/research-lab"),
    },
  ];

  return (
    <div className="container max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header estilo webapp */}
      <header className="flex items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Agentes Kaleidos
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Escolha um agente para gerenciar clientes, automatizar conteúdos e analisar performance.
          </p>
        </div>
      </header>

      {/* Agent Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent, index) => (
          <div
            key={agent.title}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <AgentCard
              title={agent.title}
              subtitle={agent.subtitle}
              description={agent.description}
              features={agent.features}
              accentColor={agent.accentColor}
              onOpen={agent.onOpen}
            />
          </div>
        ))}
      </section>
    </div>
  );
};

export default Agents;
