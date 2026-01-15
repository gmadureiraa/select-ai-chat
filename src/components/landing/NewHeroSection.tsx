import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, LayoutDashboard, Zap, MousePointer2, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

// Simple animated text component
const AnimatedWord = ({ words }: { words: string[] }) => {
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <span className="relative inline-block min-w-[200px]">
      {words.map((word, i) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: i === index ? 1 : 0, 
            y: i === index ? 0 : -20 
          }}
          transition={{ duration: 0.3 }}
          className={`${i === index ? "relative" : "absolute left-0"} text-primary`}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

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
      const count = Math.floor((canvas.width * canvas.height) / 20000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2,
          opacity: Math.random() * 0.4 + 0.1,
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
      className="absolute inset-0 pointer-events-none opacity-50"
    />
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

        {/* Main Headline - Simple and direct like isla.to */}
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

        {/* Subtitle - Value proposition */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Canvas visual de criação. Conecte fontes, arraste nós, 
          gere conteúdo em batch. Simples assim.
        </motion.p>

        {/* CTAs - Primary action clear */}
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

        {/* Social proof - Simple */}
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

      {/* Canvas Preview - Visual demonstration */}
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

          {/* Canvas content preview */}
          <div className="relative aspect-[16/9] bg-muted/50 rounded-xl overflow-hidden">
            {/* Grid background */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
            
            {/* Canvas nodes preview */}
            <div className="absolute inset-0 p-6">
              {/* Source node */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="absolute top-1/4 left-[10%] bg-card border border-border rounded-lg p-3 shadow-lg w-32"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                    <LayoutDashboard className="w-3 h-3 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium">Fonte</span>
                </div>
                <div className="h-2 bg-muted rounded w-full" />
              </motion.div>

              {/* AI node */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded-lg p-4 shadow-lg w-36"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-medium">IA Multi-Agente</span>
                </div>
                <div className="flex gap-1">
                  <div className="h-1.5 bg-primary-foreground/30 rounded flex-1" />
                  <div className="h-1.5 bg-primary-foreground/30 rounded flex-1" />
                </div>
              </motion.div>

              {/* Output nodes */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.3 }}
                className="absolute top-[20%] right-[10%] bg-card border border-border rounded-lg p-3 shadow-lg w-28"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 text-green-500" />
                  </div>
                  <span className="text-xs">Post 1</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                className="absolute top-[45%] right-[10%] bg-card border border-border rounded-lg p-3 shadow-lg w-28"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 text-green-500" />
                  </div>
                  <span className="text-xs">Post 2</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="absolute top-[70%] right-[10%] bg-card border border-border rounded-lg p-3 shadow-lg w-28"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 text-green-500" />
                  </div>
                  <span className="text-xs">Post 3</span>
                </div>
              </motion.div>

              {/* Connection lines - using percentage-based positioning */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Source to AI */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ delay: 1, duration: 0.6 }}
                  d="M 22 30 C 35 30 40 50 50 50"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeDasharray="2 1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* AI to Output 1 */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                  d="M 60 50 C 70 50 75 25 85 25"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeDasharray="2 1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* AI to Output 2 */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ delay: 1.3, duration: 0.4 }}
                  d="M 60 50 C 70 50 75 50 85 50"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeDasharray="2 1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* AI to Output 3 */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ delay: 1.4, duration: 0.4 }}
                  d="M 60 50 C 70 50 75 75 85 75"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeDasharray="2 1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Floating cursor */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 1, 1, 0],
                  x: [100, 200, 400, 500],
                  y: [150, 100, 180, 100]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  repeatDelay: 1 
                }}
                className="absolute"
              >
                <MousePointer2 className="w-5 h-5 text-primary" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default NewHeroSection;
