import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { FileText, Calendar, Bot, CheckCircle, ArrowRight, Kanban, Clock, Zap } from "lucide-react";

const stages = [
  {
    icon: FileText,
    label: "Criar",
    description: "Gere conteúdo com IA",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Calendar,
    label: "Agendar",
    description: "Escolha data e hora",
    color: "from-secondary to-accent",
  },
  {
    icon: Bot,
    label: "Automatizar",
    description: "Publicação automática",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: CheckCircle,
    label: "Publicar",
    description: "Entrega garantida",
    color: "from-emerald-500 to-teal-500",
  },
];

const kanbanCards = [
  { title: "Newsletter Semanal", status: "done", platform: "Email" },
  { title: "Carrossel Instagram", status: "review", platform: "Instagram" },
  { title: "Thread Twitter", status: "progress", platform: "Twitter" },
  { title: "Vídeo YouTube", status: "todo", platform: "YouTube" },
];

const PlannerDiagramSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section id="planner" className="py-32 bg-muted/30 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
            <Kanban className="w-4 h-4 text-secondary" />
            <span className="text-sm text-foreground">Planejamento Visual</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-6">
            Do{" "}
            <span className="italic text-muted-foreground">rascunho</span> à{" "}
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
              publicação
            </span>
          </h2>

          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Planeje, organize e publique conteúdo de forma visual. 
            Kanban, calendário e automações em um só lugar.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <div ref={containerRef} className="relative">
          {/* Desktop Flow */}
          <div className="hidden lg:flex items-center justify-center gap-4 mb-20">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="flex items-center"
              >
                {/* Stage card */}
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${stage.color} opacity-20 rounded-2xl blur-xl group-hover:opacity-30 transition-opacity`} />
                  <div className="relative bg-card border border-border rounded-2xl p-6 w-[180px] hover:border-primary/30 transition-colors">
                    <motion.div
                      animate={isInView ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2, delay: index * 0.3, repeat: Infinity, repeatDelay: 3 }}
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stage.color} p-0.5 mb-4`}
                    >
                      <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                        <stage.icon className="w-6 h-6 text-foreground" />
                      </div>
                    </motion.div>
                    <h3 className="text-lg font-medium text-foreground mb-1">{stage.label}</h3>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                  </div>
                </div>

                {/* Arrow connector */}
                {index < stages.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
                    className="flex items-center px-2"
                  >
                    <div className="w-12 h-[2px] bg-gradient-to-r from-border to-primary/50" />
                    <ArrowRight className="w-5 h-5 text-primary/50 -ml-1" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Mobile Flow */}
          <div className="lg:hidden space-y-4 mb-16">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stage.color} p-0.5 flex-shrink-0`}>
                  <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                    <stage.icon className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{stage.label}</h3>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Kanban Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            {/* Glassmorphism container */}
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Kanban className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Planejamento - Dezembro 2024</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Esta semana</span>
                </div>
              </div>

              {/* Kanban columns */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["A Fazer", "Em Progresso", "Revisão", "Publicado"].map((column, colIndex) => (
                  <div key={column} className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${
                        colIndex === 0 ? "bg-muted-foreground" :
                        colIndex === 1 ? "bg-blue-500" :
                        colIndex === 2 ? "bg-amber-500" :
                        "bg-emerald-500"
                      }`} />
                      <span className="text-sm font-medium text-foreground">{column}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {kanbanCards.filter(c => 
                          (colIndex === 0 && c.status === "todo") ||
                          (colIndex === 1 && c.status === "progress") ||
                          (colIndex === 2 && c.status === "review") ||
                          (colIndex === 3 && c.status === "done")
                        ).length}
                      </span>
                    </div>

                    {/* Cards */}
                    {kanbanCards
                      .filter(card => 
                        (colIndex === 0 && card.status === "todo") ||
                        (colIndex === 1 && card.status === "progress") ||
                        (colIndex === 2 && card.status === "review") ||
                        (colIndex === 3 && card.status === "done")
                      )
                      .map((card, cardIndex) => (
                        <motion.div
                          key={card.title}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: 0.5 + cardIndex * 0.1 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          className="bg-background/80 border border-border rounded-xl p-3 cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all"
                        >
                          <p className="text-sm font-medium text-foreground mb-2">{card.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {card.platform}
                            </span>
                            {card.status === "progress" && (
                              <Zap className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                  </div>
                ))}
              </div>

              {/* Features badges */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-border"
              >
                {["Cards arrastáveis", "Calendário visual", "Filtros por cliente", "APIs integradas"].map((feature) => (
                  <span
                    key={feature}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Decorative gradient */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PlannerDiagramSection;
