import { motion } from "framer-motion";
import { 
  User, 
  PenTool, 
  Image, 
  Send,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  step: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    step: "01",
    icon: User,
    title: "Entende seu perfil",
    description: "Tom de voz, objetivos e audiência. A IA aprende com cada interação.",
  },
  {
    step: "02",
    icon: PenTool,
    title: "Desenvolve conteúdo",
    description: "Textos otimizados para cada plataforma. Posts, threads, artigos.",
  },
  {
    step: "03",
    icon: Image,
    title: "Cria as imagens",
    description: "Geração visual com IA. Carrosséis, thumbnails, stories.",
  },
  {
    step: "04",
    icon: Send,
    title: "Publica direto",
    description: "Planejamento visual e publicação agendada nas suas redes.",
  },
];

const ValueProposition = () => {
  return (
    <section id="features" className="py-24 md:py-32 bg-background relative">
      {/* Subtle top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-5xl mx-auto px-6">
        {/* Header - Linear style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-4">
            Como funciona
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground tracking-tight">
            Do briefing à publicação
          </h2>
          <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">
            Automatize todo o fluxo de criação de conteúdo em 4 passos simples.
          </p>
        </motion.div>

        {/* Steps Grid - Minimal cards */}
        <div className="grid md:grid-cols-4 gap-px bg-border/50 rounded-xl overflow-hidden">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-background p-6 group hover:bg-muted/30 transition-colors"
            >
              {/* Step number */}
              <span className="text-xs font-mono text-muted-foreground mb-4 block">
                {step.step}
              </span>
              
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <step.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              {/* Content */}
              <h3 className="text-base font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-xl md:text-2xl font-medium text-foreground mb-2">
            10x mais conteúdo, menos esforço
          </p>
          <p className="text-muted-foreground">
            Enquanto você foca no que importa, o kAI cuida da produção.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ValueProposition;
