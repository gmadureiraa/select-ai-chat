import { motion } from "framer-motion";
import {
  Instagram,
  Youtube,
  Mail,
  AtSign,
  Code,
  Shield,
  Zap,
  Clock,
  BarChart3,
  TrendingUp,
  Headphones,
} from "lucide-react";

const orbitItems = [
  { icon: AtSign, label: "@", angle: 180 },
  { icon: Code, label: "</>" , angle: 150 },
  { icon: Shield, label: "Shield", angle: 120 },
  { icon: BarChart3, label: "Chart", angle: 90 },
  { icon: Instagram, label: "Instagram", angle: 60 },
  { icon: Youtube, label: "YouTube", angle: 30 },
  { icon: Mail, label: "Email", angle: 0 },
];

const benefits = [
  { icon: Zap, title: "Eficiência Potencializada" },
  { icon: Shield, title: "Segurança Garantida" },
  { icon: Clock, title: "Economia de Tempo" },
  { icon: BarChart3, title: "Análise de Dados" },
  { icon: TrendingUp, title: "Crescimento Contínuo" },
  { icon: Headphones, title: "Acesso 24/7" },
];

const IntegrationsOrbit = () => {
  return (
    <section id="integrations" className="py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            Conexões{" "}
            <span className="italic text-muted-foreground">Fluidas</span> Entre
            Plataformas
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-xl mx-auto">
            Integre todas as suas ferramentas favoritas em um único ecossistema
            inteligente.
          </p>
        </motion.div>

        {/* Orbit visual */}
        <div className="relative h-[400px] mb-20">
          {/* Central orb */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-40 h-40 rounded-full bg-gradient-to-br from-secondary to-accent blur-[60px]"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-2xl">K</span>
              </div>
            </div>
          </div>

          {/* Semicircular orbits */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--border))" />
                <stop offset="50%" stopColor="hsl(var(--border) / 0.5)" />
                <stop offset="100%" stopColor="hsl(var(--border))" />
              </linearGradient>
            </defs>

            {/* Orbit lines */}
            <motion.path
              d="M 150 200 A 250 200 0 0 1 650 200"
              fill="none"
              stroke="url(#orbitGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5 }}
            />
            <motion.path
              d="M 200 200 A 200 160 0 0 1 600 200"
              fill="none"
              stroke="url(#orbitGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.2 }}
            />
            <motion.path
              d="M 250 200 A 150 120 0 0 1 550 200"
              fill="none"
              stroke="url(#orbitGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.4 }}
            />
          </svg>

          {/* Orbit icons */}
          {orbitItems.map((item, index) => {
            const radius = 120 + (index % 3) * 60;
            const angle = (item.angle * Math.PI) / 180;
            const x = 50 + Math.cos(angle) * (radius / 4);
            const y = 50 - Math.sin(angle) * (radius / 5);

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <motion.div
                  animate={{
                    y: [0, -8, 0],
                  }}
                  transition={{
                    duration: 3 + index * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center backdrop-blur-sm hover:bg-muted transition-colors cursor-pointer"
                >
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col items-center text-center p-4"
            >
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-3">
                <benefit.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground text-sm font-light">
                {benefit.title}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsOrbit;
