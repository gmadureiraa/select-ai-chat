import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  ArrowRight, 
  Youtube, 
  FileText, 
  Instagram, 
  Twitter, 
  Linkedin,
  Sparkles,
  Layers,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const templateFlows = [
  {
    input: "URL do YouTube",
    inputIcon: Youtube,
    output: "Carrossel + Thread + Artigo",
    outputIcons: [Instagram, Twitter, FileText],
    color: "from-red-500/20 to-pink-500/20",
  },
  {
    input: "Briefing de Campanha",
    inputIcon: FileText,
    output: "10 Posts + 5 Stories + Newsletter",
    outputIcons: [Instagram, Layers, FileText],
    color: "from-blue-500/20 to-violet-500/20",
  },
  {
    input: "Podcast Highlights",
    inputIcon: Sparkles,
    output: "LinkedIn + Twitter + Blog",
    outputIcons: [Linkedin, Twitter, FileText],
    color: "from-emerald-500/20 to-teal-500/20",
  },
];

const CanvasDemoSection = () => {
  return (
    <section id="canvas-demo" className="py-32 bg-background relative overflow-hidden">
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
          className="text-center mb-16"
        >
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
            O Diferencial do kAI
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Canvas de Criação{" "}
            <span className="text-primary">Visual</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-2xl mx-auto">
            Arraste fontes, conecte nós e deixe a IA criar múltiplos conteúdos automaticamente. 
            Visualize todo o fluxo em tempo real.
          </p>
        </motion.div>

        {/* Canvas Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden border border-border bg-card/50 backdrop-blur-sm p-8 mb-16"
        >
          {/* Mockup Grid */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative space-y-6">
            {templateFlows.map((flow, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="flex items-center gap-4"
              >
                {/* Input Node */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${flow.color} border border-border/50 min-w-[200px]`}>
                  <flow.inputIcon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{flow.input}</span>
                </div>

                {/* Connection Line */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-primary/50 to-primary/20 rounded" />
                  <motion.div
                    animate={{ x: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Zap className="w-4 h-4 text-primary" />
                  </motion.div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-primary/20 to-primary/50 rounded" />
                </div>

                {/* Output Node */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border/50 min-w-[280px]">
                  <div className="flex -space-x-2">
                    {flow.outputIcons.map((Icon, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-background">
                        <Icon className="w-3 h-3 text-primary" />
                      </div>
                    ))}
                  </div>
                  <span className="text-sm font-medium">{flow.output}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Layers,
              title: "10+ Templates Prontos",
              description: "Carrossel, Thread, Artigo, Newsletter e mais. Comece em segundos.",
            },
            {
              icon: Zap,
              title: "Geração em Batch",
              description: "Crie até 10 variações de conteúdo com um único clique.",
            },
            {
              icon: Sparkles,
              title: "IA Multi-Agente",
              description: "4 agentes especializados refinam cada conteúdo automaticamente.",
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
      </div>
    </section>
  );
};

export default CanvasDemoSection;
