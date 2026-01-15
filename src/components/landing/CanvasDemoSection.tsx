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
  Zap,
  Image,
  MessageSquare,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const workflowSteps = [
  {
    step: "1",
    title: "Adicione sua fonte",
    description: "URL, texto, vídeo ou briefing",
    icon: FileText,
    color: "from-blue-500 to-violet-500",
  },
  {
    step: "2",
    title: "KAI analisa e cria",
    description: "IA entende tom e objetivo",
    icon: Sparkles,
    color: "from-primary to-emerald-500",
  },
  {
    step: "3",
    title: "10 posts prontos",
    description: "Carrossel, thread, artigo",
    icon: Layers,
    color: "from-secondary to-pink-500",
  },
];

const templateFlows = [
  {
    input: "URL do YouTube",
    inputIcon: Youtube,
    output: "Carrossel + Thread + Artigo",
    outputIcons: [Instagram, Twitter, FileText],
    color: "from-red-500/20 to-pink-500/20",
    borderColor: "border-red-500/30",
  },
  {
    input: "Briefing de Campanha",
    inputIcon: FileText,
    output: "10 Posts + 5 Stories + Newsletter",
    outputIcons: [Instagram, Layers, MessageSquare],
    color: "from-blue-500/20 to-violet-500/20",
    borderColor: "border-blue-500/30",
  },
  {
    input: "Podcast Highlights",
    inputIcon: Sparkles,
    output: "LinkedIn + Twitter + Blog",
    outputIcons: [Linkedin, Twitter, FileText],
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-500/30",
  },
];

const CanvasDemoSection = () => {
  const navigate = useNavigate();

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
          className="text-center mb-16"
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
            Arraste, conecte e deixe a IA criar. Visualize todo o fluxo em tempo real.
          </p>
        </motion.div>

        {/* Workflow Steps - Visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid md:grid-cols-3 gap-4 mb-16"
        >
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Passo {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {index < workflowSteps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Canvas Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 mb-12"
        >
          {/* Mockup Grid */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative space-y-4 md:space-y-6">
            {templateFlows.map((flow, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4"
              >
                {/* Input Node */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${flow.color} border ${flow.borderColor} w-full md:min-w-[200px] md:w-auto`}>
                  <flow.inputIcon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{flow.input}</span>
                </div>

                {/* Connection Line */}
                <div className="hidden md:flex flex-1 items-center gap-2">
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-primary/50 to-primary/20 rounded" />
                  <motion.div
                    animate={{ x: [0, 8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Zap className="w-4 h-4 text-primary" />
                  </motion.div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-primary/20 to-primary/50 rounded" />
                </div>

                {/* Mobile arrow */}
                <div className="flex md:hidden items-center justify-center w-full py-1">
                  <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                </div>

                {/* Output Node */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border w-full md:min-w-[280px] md:w-auto">
                  <div className="flex -space-x-2">
                    {flow.outputIcons.map((Icon, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
                        <Icon className="w-3 h-3 text-primary" />
                      </div>
                    ))}
                  </div>
                  <span className="text-sm font-medium">{flow.output}</span>
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                </div>
              </motion.div>
            ))}
          </div>
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
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 group"
          >
            Experimente o Canvas agora
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CanvasDemoSection;
