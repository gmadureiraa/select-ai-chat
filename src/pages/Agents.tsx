import { useNavigate } from "react-router-dom";
import AgentCard from "@/components/agents/AgentCard";
import { PageHeader } from "@/components/PageHeader";

const Agents = () => {
  const navigate = useNavigate();

  const agents = [
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
      onOpen: () => navigate("/assistant"),
    },
    {
      title: "Agent Builder",
      subtitle: "Crie workflows de IA visuais",
      description: "Monte pipelines de agentes interconectados com drag-and-drop para automações avançadas",
      features: [
        "Canvas visual",
        "Multi-agentes",
        "Templates prontos",
        "Execução automática",
      ],
      accentColor: "emerald" as const,
      onOpen: () => navigate("/agent-builder"),
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
      accentColor: "white" as const,
      onOpen: () => navigate("/research-lab"),
    },
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
      accentColor: "purple" as const,
      onOpen: () => navigate("/reverse-engineering"),
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
      title: "Publicador Social",
      subtitle: "Publique no Twitter e LinkedIn",
      description: "Publique conteúdo diretamente nas redes sociais dos seus clientes integrados",
      features: [
        "Twitter/X integrado",
        "LinkedIn (em breve)",
        "Publicação direta",
        "Por cliente",
      ],
      accentColor: "yellow" as const,
      onOpen: () => navigate("/social-publisher"),
    },
    {
      title: "Automações",
      subtitle: "Rodar e criar automações",
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
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <PageHeader 
        title="Agentes Kaleidos" 
        subtitle="Escolha um agente para gerenciar clientes, automatizar conteúdos e analisar performance."
      />

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
