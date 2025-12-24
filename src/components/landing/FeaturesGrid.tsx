import { motion } from "framer-motion";
import { Plug, TrendingUp, Megaphone, Cpu } from "lucide-react";

const features = [
  {
    icon: Plug,
    title: "Integrações",
    description: "Conecte com suas ferramentas favoritas",
    gradient: "from-[hsl(220,85%,55%)] to-[hsl(250,85%,60%)]",
  },
  {
    icon: TrendingUp,
    title: "Performance",
    description: "Métricas e analytics em tempo real",
    gradient: "from-[hsl(145,80%,42%)] to-[hsl(175,75%,45%)]",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    description: "Campanhas otimizadas com IA",
    gradient: "from-[hsl(330,85%,55%)] to-[hsl(350,80%,55%)]",
  },
  {
    icon: Cpu,
    title: "Soluções com IA",
    description: "Tecnologia de ponta integrada",
    gradient: "from-[hsl(25,95%,55%)] to-[hsl(45,90%,55%)]",
  },
];

const FeaturesGrid = () => {
  return (
    <section id="features" className="py-24 bg-black relative overflow-hidden">
      {/* Central gradient orb */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
        style={{
          background:
            "radial-gradient(circle, hsl(330, 85%, 55%) 0%, hsl(25, 95%, 55%) 50%, transparent 70%)",
          filter: "blur(120px)",
          opacity: 0.2,
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-white mb-4">
            Todas as features em{" "}
            <span className="italic text-white/60">um só lugar</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Uma plataforma completa para gerenciar todo o ciclo de criação de
            conteúdo
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="relative h-full rounded-3xl bg-white/[0.03] border border-white/10 p-8 overflow-hidden hover:bg-white/[0.05] transition-colors">
                {/* Icon with gradient background */}
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-medium text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-white/50">{feature.description}</p>

                {/* Hover gradient */}
                <div
                  className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-20 transition-opacity"
                  style={{
                    background: `radial-gradient(circle, ${
                      feature.gradient.includes("330")
                        ? "hsl(330, 85%, 55%)"
                        : feature.gradient.includes("145")
                        ? "hsl(145, 80%, 42%)"
                        : feature.gradient.includes("220")
                        ? "hsl(220, 85%, 55%)"
                        : "hsl(25, 95%, 55%)"
                    } 0%, transparent 70%)`,
                    filter: "blur(30px)",
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
