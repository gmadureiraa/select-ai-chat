import { motion } from "framer-motion";
import {
  Instagram,
  Youtube,
  Mail,
  Twitter,
  Linkedin,
  Zap,
  Shield,
  Clock,
  BarChart3,
  TrendingUp,
  Globe,
} from "lucide-react";

const orbitItems = [
  { icon: Instagram, label: "Instagram", angle: 0 },
  { icon: Youtube, label: "YouTube", angle: 60 },
  { icon: Mail, label: "Newsletter", angle: 120 },
  { icon: Twitter, label: "Twitter/X", angle: 180 },
  { icon: Linkedin, label: "LinkedIn", angle: 240 },
  { icon: Globe, label: "Website", angle: 300 },
];

const benefits = [
  { icon: Zap, title: "Eficiência Potencializada" },
  { icon: Shield, title: "Experiência Aprimorada" },
  { icon: Clock, title: "Economia de Tempo" },
  { icon: BarChart3, title: "Análise de Dados" },
  { icon: TrendingUp, title: "Crescimento & Flexibilidade" },
  { icon: Globe, title: "Acesso 24/7" },
];

const IntegrationsOrbit = () => {
  return (
    <section id="integrations" className="py-24 bg-black relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-light text-white mb-4">
            Conexões Fluidas{" "}
            <span className="italic text-white/60">Entre Plataformas</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Integre todas as suas plataformas favoritas em um único lugar
          </p>
        </motion.div>

        {/* Orbit Visual */}
        <div className="flex justify-center mb-20">
          <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
            {/* Central gradient orb */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, hsl(330, 85%, 55%) 0%, hsl(25, 95%, 55%) 100%)",
                boxShadow: "0 0 80px 20px hsla(330, 85%, 55%, 0.3)",
              }}
            />

            {/* KAI Logo in center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <span className="text-2xl md:text-3xl font-bold text-white">KAI</span>
            </div>

            {/* Orbit ring */}
            <div className="absolute inset-0 rounded-full border border-white/10" />

            {/* Orbiting icons */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0"
            >
              {orbitItems.map((item, index) => {
                const radius = 150; // Half of container width minus padding
                const mdRadius = 200;
                const angle = (item.angle * Math.PI) / 180;

                return (
                  <motion.div
                    key={item.label}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${Math.cos(angle) * radius}px - 20px)`,
                      top: `calc(50% + ${Math.sin(angle) * radius}px - 20px)`,
                    }}
                    whileHover={{ scale: 1.2 }}
                  >
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{
                        duration: 30,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                      <item.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <benefit.icon className="w-5 h-5 text-[hsl(330,85%,55%)]" />
              <span className="text-sm text-white/80">{benefit.title}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsOrbit;
