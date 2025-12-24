import { motion } from "framer-motion";
import { Users, FolderOpen, FlaskConical, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Acesso por Time",
    description:
      "Cada membro do time acessa os clientes atribuídos com permissões personalizadas.",
  },
  {
    icon: FolderOpen,
    title: "Clientes Organizados",
    description:
      "Briefings, brand guidelines, histórico de conversas e arquivos em um só lugar.",
  },
  {
    icon: FlaskConical,
    title: "Research Lab",
    description: "Canvas visual para pesquisar e organizar referências em projetos.",
  },
  {
    icon: BarChart3,
    title: "Performance",
    description: "Dashboard com métricas de todos os clientes e canais integrados.",
  },
];

const FeaturesGrid = () => {
  return (
    <section id="features" className="py-32 bg-muted/30 dark:bg-muted/10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            Como seu{" "}
            <span className="italic text-muted-foreground">time</span> vai trabalhar
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-xl mx-auto">
            Uma plataforma onde cada pessoa vê o que precisa, sem confusão.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Visual */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-3xl overflow-hidden h-[400px] bg-gradient-to-br from-violet-500/10 to-secondary/10 border border-border">
              {/* Gradient blob */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/20 blur-[80px]" />

              {/* Decorative workflow illustration */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="flex flex-col gap-4 w-full max-w-xs">
                  {["Agência", "Time", "Clientes"].map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + index * 0.15 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-secondary to-accent" />
                      <div className="flex-1 h-12 rounded-xl bg-card border border-border flex items-center px-4">
                        <span className="text-muted-foreground text-sm">{item}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right side - Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 order-1 lg:order-2">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-lg font-medium text-foreground mb-2">
                  {feature.title}
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
