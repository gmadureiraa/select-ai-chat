import { motion } from "framer-motion";
import { MessageSquare, Palette, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import FluidWaves from "./FluidWaves";

const features = [
  {
    icon: MessageSquare,
    title: "Assistente IA",
    description: "Converse e crie conteúdo em segundos com contexto do cliente.",
  },
  {
    icon: Palette,
    title: "Contexto de Marca",
    description: "A IA aprende o tom de voz e estilo de cada cliente.",
  },
  {
    icon: BarChart3,
    title: "Métricas em Tempo Real",
    description: "Instagram, YouTube e Newsletter em um dashboard.",
  },
];

const WorkflowSection = () => {
  return (
    <section id="workflow" className="py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left side - Fluid Visual Card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative rounded-3xl overflow-hidden h-[480px] bg-gradient-to-br from-violet-500/10 to-secondary/10 border border-border">
              {/* Fluid animation */}
              <FluidWaves variant="purple" />

              {/* Content overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent dark:from-black/90 dark:via-black/40" />

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h4 className="text-xl font-medium text-foreground mb-2">
                  Inteligência em Tempo Real
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Monitore, analise e otimize seu conteúdo com insights
                  instantâneos baseados em dados reais.
                </p>
              </div>

              {/* Arrow button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute bottom-8 right-8 w-12 h-12 rounded-full bg-primary/10 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-primary/20 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>

          {/* Right side - Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-sm text-foreground/80">Criação com IA</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-light text-foreground mb-6 leading-tight">
              Conteúdo com{" "}
              <span className="italic text-muted-foreground">Contexto!</span>
            </h2>

            <p className="text-muted-foreground text-lg font-light mb-10 max-w-md">
              A IA entende cada cliente, seu tom de voz e histórico para criar 
              conteúdo personalizado.
            </p>

            {/* Features grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0 group-hover:bg-muted transition-colors">
                      <feature.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-foreground font-medium mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
