import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play, Paperclip, FileOutput, Instagram, Twitter, Linkedin, FileText, Headphones, Link2, Type, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Floating particles - subtle background effect
const FloatingParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 25000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: (Math.random() - 0.5) * 0.15,
          opacity: Math.random() * 0.3 + 0.1,
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(280, 70%, 60%, ${particle.opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    resize();
    createParticles();
    animate();

    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-40"
    />
  );
};

// Animated canvas demo in hero
const HeroCanvasDemo = () => {
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 1500));
      setStep(1); // Show attachment
      await new Promise(r => setTimeout(r, 800));
      setStep(2); // Show generator
      await new Promise(r => setTimeout(r, 800));
      setStep(3); // Connect
      await new Promise(r => setTimeout(r, 600));
      setIsGenerating(true);
      await new Promise(r => setTimeout(r, 1500));
      setIsGenerating(false);
      setShowResults(true);
      await new Promise(r => setTimeout(r, 4000));
      // Reset
      setStep(0);
      setShowResults(false);
    };

    sequence();
    const interval = setInterval(sequence, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full aspect-[16/9] bg-muted/30 rounded-xl overflow-hidden">
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Toolbar simulation */}
      <motion.div 
        className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-card/80 backdrop-blur-sm border border-border rounded-lg z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="p-1 rounded bg-primary/10">
          <Type className="w-3 h-3 text-primary" />
        </div>
        <div className="p-1 rounded hover:bg-muted">
          <FileText className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-px h-3 bg-border mx-0.5" />
        <div className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[8px] font-medium text-blue-600">
          Anexo
        </div>
        <div className="px-1.5 py-0.5 rounded bg-green-500/10 text-[8px] font-medium text-green-600">
          Gerador
        </div>
      </motion.div>

      {/* Attachment Node */}
      <motion.div
        className="absolute left-[8%] top-[30%] w-[120px] md:w-[140px]"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: step >= 1 ? 1 : 0, x: step >= 1 ? 0 : -30 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-lg border-2 border-blue-500/50 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background shadow-lg p-2">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center">
              <Paperclip className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-medium">Anexo</span>
          </div>
          <div className="flex gap-0.5 mb-1.5">
            <div className="flex-1 py-0.5 bg-primary/10 rounded text-[7px] text-center text-primary">Link</div>
            <div className="flex-1 py-0.5 bg-muted rounded text-[7px] text-center text-muted-foreground">Texto</div>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-1 bg-muted rounded text-[8px] text-muted-foreground">
            <Link2 className="w-2.5 h-2.5" />
            <span className="truncate">youtube.com/watch...</span>
          </div>
        </div>
      </motion.div>

      {/* Generator Node */}
      <motion.div
        className="absolute left-[38%] top-[25%] w-[100px] md:w-[120px]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 30 }}
        transition={{ duration: 0.5 }}
      >
        <div className={`rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background shadow-lg p-2 ${isGenerating ? 'animate-pulse' : ''}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-medium">Gerador</span>
            <Badge variant="secondary" className="h-3 text-[7px] px-1 ml-auto">1</Badge>
          </div>
          <div className="space-y-1">
            <div className="px-1.5 py-0.5 bg-muted rounded text-[7px] flex justify-between">
              <span className="text-muted-foreground">Formato</span>
              <span>Carrossel</span>
            </div>
            <motion.div 
              className="h-5 bg-green-600 rounded flex items-center justify-center text-white text-[8px] font-medium"
              animate={isGenerating ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.5, repeat: isGenerating ? Infinity : 0 }}
            >
              {isGenerating ? "Gerando..." : "▶ Gerar"}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Result Nodes */}
      <motion.div
        className="absolute right-[8%] top-[15%] space-y-2"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: showResults ? 1 : 0, x: showResults ? 0 : 30 }}
        transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {[
          { icon: Instagram, label: "Carrossel", color: "pink" },
          { icon: Twitter, label: "Thread", color: "sky" },
          { icon: Linkedin, label: "Artigo", color: "blue" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: showResults ? 1 : 0, x: showResults ? 0 : 20 }}
            transition={{ delay: i * 0.15 }}
            className="w-[90px] md:w-[110px] rounded-lg border-2 border-pink-500/50 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-background shadow-lg p-1.5"
          >
            <div className="flex items-center gap-1 mb-1">
              <div className="w-3 h-3 rounded bg-pink-500 flex items-center justify-center">
                <FileOutput className="w-2 h-2 text-white" />
              </div>
              <item.icon className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[8px] font-medium truncate">{item.label}</span>
            </div>
            <div className="space-y-0.5">
              <div className="h-1 bg-muted rounded w-full" />
              <div className="h-1 bg-muted rounded w-3/4" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid meet">
        {/* Attachment to Generator */}
        <motion.path
          d="M 28% 45% Q 33% 45% 38% 40%"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: step >= 3 ? 1 : 0, 
            opacity: step >= 3 ? 0.6 : 0 
          }}
          transition={{ duration: 0.5 }}
        />
        
        {/* Generator to Results */}
        <motion.path
          d="M 52% 38% Q 60% 30% 72% 25%"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: showResults ? 1 : 0, 
            opacity: showResults ? 0.6 : 0 
          }}
          transition={{ duration: 0.4 }}
        />
        <motion.path
          d="M 52% 42% Q 62% 42% 72% 42%"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: showResults ? 1 : 0, 
            opacity: showResults ? 0.6 : 0 
          }}
          transition={{ duration: 0.4, delay: 0.1 }}
        />
        <motion.path
          d="M 52% 46% Q 60% 55% 72% 60%"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: showResults ? 1 : 0, 
            opacity: showResults ? 0.6 : 0 
          }}
          transition={{ duration: 0.4, delay: 0.2 }}
        />

        {/* Animated pulse during generation */}
        {isGenerating && (
          <motion.circle
            r="4"
            fill="hsl(var(--primary))"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <animateMotion
              dur="0.8s"
              repeatCount="indefinite"
              path="M 52% 38% Q 60% 30% 72% 25%"
            />
          </motion.circle>
        )}
      </svg>

      {/* Input types floating badges */}
      <motion.div
        className="absolute bottom-3 left-3 flex gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        {[
          { icon: Link2, label: "URL" },
          { icon: FileText, label: "PDF" },
          { icon: ImageIcon, label: "Imagem" },
          { icon: Headphones, label: "Áudio" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-background/80 backdrop-blur-sm border border-border rounded text-[7px] text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 + i * 0.1 }}
          >
            <item.icon className="w-2.5 h-2.5" />
            {item.label}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

const NewHeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden bg-background pt-20 pb-16">
      {/* Floating Particles */}
      <FloatingParticles />
      
      {/* Gradient blur effects */}
      <div className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-20 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Target audience badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border mb-8"
        >
          <span className="text-sm text-muted-foreground">Para criadores de conteúdo e pequenas agências</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight"
        >
          Crie conteúdo visual
          <br />
          em <span className="text-primary">10 minutos</span> com IA
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Canvas visual de criação. Conecte fontes, arraste nós, 
          gere conteúdo em batch. Simples assim.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link to="/signup?plan=basic">
            <Button
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-base font-semibold rounded-full group min-w-[260px]"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Assinar Canvas - $19.90/mês
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <a href="#canvas-demo">
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-base font-medium rounded-full border-border hover:bg-muted min-w-[180px]"
            >
              <Play className="mr-2 w-4 h-4" />
              Ver demo
            </Button>
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Setup em 2 minutos
          </span>
          <span className="hidden sm:block">•</span>
          <span className="hidden sm:block">Cancele quando quiser</span>
        </motion.div>
      </div>

      {/* Canvas Preview - Animated Demo */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="relative z-10 w-full max-w-5xl mx-auto mt-16 px-6"
      >
        <div className="relative rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-2xl">
          {/* Browser-like header */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 rounded-lg bg-muted text-xs text-muted-foreground">
                kai.kaleidos.app/canvas
              </div>
            </div>
          </div>

          {/* Animated Canvas Demo */}
          <HeroCanvasDemo />
        </div>
      </motion.div>
    </section>
  );
};

export default NewHeroSection;
