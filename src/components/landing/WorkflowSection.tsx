import { motion } from "framer-motion";
import { Bot, Layout, Calendar, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import FluidWaves from "./FluidWaves";

const features = [
  {
    icon: Bot,
    title: "Task Bots Inteligentes",
    description: "Automatize tarefas repetitivas com bots que aprendem.",
  },
  {
    icon: Layout,
    title: "+100 Templates",
    description: "Templates prontos para qualquer tipo de conteúdo.",
  },
  {
    icon: Calendar,
    title: "Planejamento Automático",
    description: "Calendário inteligente que sugere horários ideais.",
  },
  {
    icon: BarChart3,
    title: "Análise de Performance",
    description: "Métricas em tempo real para otimizar resultados.",
  },
];

const WorkflowSection = () => {
  return (
    <section id="features" className="py-32 bg-black relative overflow-hidden">
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
            <div className="relative rounded-3xl overflow-hidden h-[480px] bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-white/10">
              {/* Fluid animation */}
              <FluidWaves variant="purple" />

              {/* Content overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h4 className="text-xl font-medium text-white mb-2">
                  Inteligência em Tempo Real
                </h4>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  Monitore, analise e otimize seu conteúdo com insights
                  instantâneos baseados em dados reais.
                </p>
              </div>

              {/* Arrow button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute bottom-8 right-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles className="w-4 h-4 text-[hsl(330,85%,55%)]" />
              <span className="text-sm text-white/70">Automação de Fluxo</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-light text-white mb-6 leading-tight">
              Automação de Conteúdo{" "}
              <span className="italic text-white/80">Simplificada!</span>
            </h2>

            <p className="text-white/40 text-lg font-light mb-10 max-w-md">
              Configure workflows poderosos em minutos e deixe a IA fazer o
              trabalho pesado por você.
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
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                      <feature.icon className="w-5 h-5 text-white/70" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-white/40 text-sm leading-relaxed">
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
