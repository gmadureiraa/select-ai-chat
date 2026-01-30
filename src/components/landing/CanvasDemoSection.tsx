import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Layers,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Layers,
    title: "10+ Templates",
    description: "Carrossel, Thread, Artigo, Newsletter e mais.",
  },
  {
    icon: Sparkles,
    title: "IA Generativa",
    description: "Crie imagens personalizadas integradas.",
  },
  {
    icon: LayoutGrid,
    title: "Multi-Agente",
    description: "4 agentes refinam cada conteúdo.",
  },
];

const CanvasDemoSection = () => {
  return (
    <section id="canvas-demo" className="py-24 md:py-32 bg-muted/30 relative">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
            Multiplicação de conteúdo
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
            De uma fonte para
            <br />
            <span className="text-muted-foreground">10 conteúdos prontos.</span>
          </h2>
        </motion.div>

        {/* Visual demo - Simplified */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative mb-16"
        >
          <div className="flex items-center justify-center gap-4 md:gap-8">
            {/* Source */}
            <motion.div 
              className="flex flex-col items-center"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg">
                <span className="text-3xl md:text-4xl font-bold text-primary">1</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Vídeo</p>
            </motion.div>

            {/* Arrow */}
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-muted-foreground"
            >
              <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
            </motion.div>

            {/* Outputs */}
            <motion.div 
              className="flex flex-col items-center"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-3xl md:text-4xl font-bold">10+</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Conteúdos</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Features - Clean cards */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-xl border border-border/50 bg-card/50 text-center"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="font-medium text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link to="/signup?plan=basic">
            <Button size="lg" className="h-12 px-8 rounded-full">
              Assinar Canvas - $19.90/mês
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CanvasDemoSection;
