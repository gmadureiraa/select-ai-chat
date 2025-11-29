import { useNavigate } from "react-router-dom";
import AgentCard from "@/components/agents/AgentCard";

const Agents = () => {
  const navigate = useNavigate();

  const agents = [
    {
      title: "Assistente de Clientes",
      subtitle: "Gerenciamento contextual de clientes",
      description: "Sistema completo para gerenciar contexto e criar conteúdo estratégico para cada cliente",
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
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
