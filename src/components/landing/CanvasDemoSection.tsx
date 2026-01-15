import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  ArrowRight, 
  Sparkles,
  Layers,
  Image,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import InteractiveCanvasDemo from "./InteractiveCanvasDemo";

const CanvasDemoSection = () => {
  return (
    <section id="canvas-demo" className="py-24 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
            Canvas de Criação Visual
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            De uma fonte para{" "}
            <span className="text-primary">10 conteúdos</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-2xl mx-auto">
            Arraste, conecte e deixe a IA criar. Experimente abaixo!
          </p>
        </motion.div>

        {/* Interactive Canvas Demo */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-12"
        >
          <InteractiveCanvasDemo />
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: Layers,
              title: "10+ Templates Prontos",
              description: "Carrossel, Thread, Artigo, Newsletter e mais.",
            },
            {
              icon: Image,
              title: "Geração de Imagens",
              description: "Crie imagens personalizadas com IA integrada.",
            },
            {
              icon: Sparkles,
              title: "IA Multi-Agente",
              description: "4 agentes especializados refinam cada conteúdo.",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
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
            <Button
              size="lg"
              className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 group"
            >
              Assinar Canvas - $19.90/mês
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CanvasDemoSection;
