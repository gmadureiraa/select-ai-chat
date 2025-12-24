import { motion } from "framer-motion";
import { Plug, TrendingUp, Megaphone, Brain } from "lucide-react";
import FluidWaves from "./FluidWaves";

const features = [
  {
    icon: Plug,
    title: "Integrações",
    description:
      "Conecte-se com todas as plataformas que você já usa no dia a dia.",
  },
  {
    icon: TrendingUp,
    title: "Performance",
    description:
      "Métricas detalhadas e insights para maximizar seus resultados.",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    description: "Ferramentas de marketing integradas para amplificar alcance.",
  },
  {
    icon: Brain,
    title: "Soluções com IA",
    description: "Inteligência artificial aplicada em cada etapa do processo.",
  },
];

const FeaturesGrid = () => {
  return (
    <section className="py-32 bg-black relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-white mb-4">
            Todas as{" "}
            <span className="italic text-white/80">features</span> em um só
            lugar
          </h2>
          <p className="text-white/40 text-lg font-light max-w-xl mx-auto">
            Uma plataforma completa para gerenciar todo o ciclo de vida do seu
            conteúdo.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Fluid Visual */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-3xl overflow-hidden h-[400px] bg-gradient-to-br from-amber-900/20 to-pink-900/20 border border-white/10">
              <FluidWaves variant="gold" />

              {/* Decorative elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-[hsl(330,85%,55%)]/30 to-[hsl(25,95%,55%)]/30 blur-xl"
                />
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
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white/80" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">
                  {feature.title}
                </h4>
                <p className="text-white/40 text-sm leading-relaxed">
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
