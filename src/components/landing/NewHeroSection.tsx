import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, Brain, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import RollingText from "./RollingText";
import { useEffect, useRef } from "react";

const featureCards = [
  {
    icon: Users,
    title: "Multi-clientes",
    description: "Gerenciar vários clientes mantendo identidade única",
  },
  {
    icon: Brain,
    title: "IA que aprende",
    description: "Cada cliente tem sua identidade preservada",
  },
  {
    icon: LayoutDashboard,
    title: "Tudo em um só lugar",
    description: "Criação + Planejamento + Analytics em um lugar",
  },
];

const rollingWords = ["Agências", "Creators", "Equipes", "Startups", "Marcas"];

// Floating particles component
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
      const count = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          speedX: (Math.random() - 0.5) * 0.3,
          speedY: (Math.random() - 0.5) * 0.3,
          opacity: Math.random() * 0.5 + 0.2,
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
      className="absolute inset-0 pointer-events-none opacity-60"
    />
  );
};

const NewHeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background pt-20 pb-12">
      {/* Floating Particles */}
      <FloatingParticles />
      
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Gradient blur effects */}
      <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-20 left-1/4 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Novo: IA para conteúdo com Kai Features
          </span>
          <ArrowRight className="w-4 h-4 text-primary" />
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight"
        >
          A plataforma de conteúdo
          <br />
          feita para{" "}
          <RollingText words={rollingWords} />
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Produza, automatize, programe, organize e veja os resultados de tudo criado.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-base font-semibold rounded-full group"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Começar agora
            </Button>
          </Link>
          <a href="#features">
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-base font-medium rounded-full border-border hover:bg-muted"
            >
              Ver funcionalidades
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </a>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
        >
          {featureCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <card.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground text-sm">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default NewHeroSection;
