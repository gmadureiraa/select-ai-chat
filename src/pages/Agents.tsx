import { useNavigate } from "react-router-dom";
import AgentCard from "@/components/agents/AgentCard";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

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
      onRun: () => console.log("Run agent 1"),
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
      onOpen: () => console.log("Open agent 2"),
      onRun: () => console.log("Run agent 2"),
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
      onOpen: () => console.log("Open agent 3"),
      onRun: () => console.log("Run agent 3"),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex flex-col items-center gap-6 mb-16 animate-fade-in">
        <img 
          src={kaleidosLogo} 
          alt="Kaleidos" 
          className="h-12 w-12 object-contain" 
        />
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">
            Agentes Kaleidos
          </h1>
          <p className="text-muted-foreground text-base font-light max-w-2xl">
            Escolha um agente para começar a trabalhar
          </p>
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
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
              onRun={agent.onRun}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Agents;
