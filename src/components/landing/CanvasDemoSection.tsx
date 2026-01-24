import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Sparkles,
  Layers,
  Image,
  Youtube,
  LayoutGrid,
  MessageSquare,
  FileEdit,
  BookOpen,
  Mail,
  Video,
  Instagram,
  Twitter,
  Linkedin,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Output formats that the source transforms into
const outputFormats = [
  { icon: LayoutGrid, label: "Carrossel", color: "bg-primary", delay: 0 },
  { icon: MessageSquare, label: "Thread", color: "bg-primary/90", delay: 0.1 },
  { icon: FileEdit, label: "Artigo", color: "bg-primary/80", delay: 0.2 },
  { icon: BookOpen, label: "Stories", color: "bg-primary/70", delay: 0.3 },
  { icon: Mail, label: "Newsletter", color: "bg-primary/90", delay: 0.4 },
  { icon: Video, label: "Roteiro", color: "bg-primary/80", delay: 0.5 },
  { icon: FileText, label: "Resumo", color: "bg-primary/70", delay: 0.6 },
  { icon: Instagram, label: "Caption", color: "bg-primary", delay: 0.7 },
  { icon: Twitter, label: "Tweet", color: "bg-primary/90", delay: 0.8 },
  { icon: Linkedin, label: "LinkedIn", color: "bg-primary/80", delay: 0.9 },
];

// Animated connection line component with smooth curved path
const ConnectionLine = ({ delay, angle }: { delay: number; angle: number }) => (
  <motion.div
    className="absolute left-1/2 top-1/2 origin-left"
    style={{ transform: `rotate(${angle}deg)` }}
    initial={{ scaleX: 0, opacity: 0 }}
    whileInView={{ scaleX: 1, opacity: 1 }}
    viewport={{ once: true }}
    transition={{ delay: delay + 0.3, duration: 0.5, ease: "easeOut" }}
  >
    <div className="h-[1px] w-[100px] md:w-[140px] bg-gradient-to-r from-primary/40 via-primary/60 to-primary/20" />
  </motion.div>
);

// Output format node component
const OutputNode = ({ 
  format, 
  index, 
  total 
}: { 
  format: typeof outputFormats[0]; 
  index: number; 
  total: number;
}) => {
  // Calculate position in a circle
  const angle = (index / total) * 360 - 90; // Start from top
  const radius = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 180;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ 
        x: x - 40, 
        y: y - 20,
      }}
      initial={{ opacity: 0, scale: 0 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ 
        delay: 0.8 + format.delay,
        type: "spring",
        stiffness: 200,
        damping: 15
      }}
    >
      <motion.div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${format.color} text-primary-foreground shadow-md cursor-default`}
        whileHover={{ scale: 1.1, y: -4 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <format.icon className="w-4 h-4" />
        <span className="text-xs font-medium whitespace-nowrap">{format.label}</span>
      </motion.div>
    </motion.div>
  );
};

// Main visualization component
const SourceToOutputsVisualization = () => {
  return (
    <div className="relative w-full h-[400px] md:h-[500px] flex items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-primary/10 blur-[80px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>
      
      {/* Connection lines */}
      {outputFormats.map((format, index) => {
        const angle = (index / outputFormats.length) * 360 - 90;
        return (
          <ConnectionLine key={format.label} delay={format.delay} angle={angle} />
        );
      })}
      
      {/* Center source node */}
      <motion.div
        className="relative z-20"
        initial={{ scale: 0, rotate: -180 }}
        whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.2 
        }}
      >
        {/* Pulsing rings */}
        <motion.div
          className="absolute -inset-4 rounded-full border-2 border-primary/30"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute -inset-8 rounded-full border border-primary/20"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        
        {/* Main source card */}
        <motion.div
          className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-red-500 shadow-xl flex flex-col items-center justify-center gap-2"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Youtube className="w-8 h-8 md:w-10 md:h-10 text-white" />
          <span className="text-[10px] md:text-xs font-bold text-white/90">1 Vídeo</span>
        </motion.div>
      </motion.div>
      
      {/* Output nodes arranged in circle */}
      {outputFormats.map((format, index) => (
        <OutputNode 
          key={format.label} 
          format={format} 
          index={index} 
          total={outputFormats.length} 
        />
      ))}
      
      {/* Counter badge */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 2 }}
      >
        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg">
          <motion.span 
            className="text-2xl font-bold text-primary"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
          >
            1
          </motion.span>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <motion.span 
            className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 2.2 }}
          >
            10+
          </motion.span>
          <span className="text-sm text-muted-foreground">conteúdos</span>
        </div>
      </motion.div>
    </div>
  );
};

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
          className="text-center mb-8"
        >
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Multiplicação de Conteúdo
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            De uma fonte para{" "}
            <span className="text-primary">10 conteúdos</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-2xl mx-auto">
            Um único vídeo, artigo ou documento se transforma em múltiplos formatos prontos para publicar
          </p>
        </motion.div>

        {/* Source to Outputs Visualization */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-12"
        >
          <SourceToOutputsVisualization />
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
              whileHover={{ y: -4, scale: 1.02 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all text-center group"
            >
              <motion.div 
                className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
                whileHover={{ rotate: 10, scale: 1.1 }}
              >
                <feature.icon className="w-6 h-6 text-primary" />
              </motion.div>
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA with glow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="relative inline-block">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full" />
            <Link to="/signup?plan=basic">
              <Button
                size="lg"
                className="relative h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 group"
              >
                Assinar Canvas - $19.90/mês
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CanvasDemoSection;
