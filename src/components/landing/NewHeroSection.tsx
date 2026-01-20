import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play, Paperclip, Instagram, Twitter, Linkedin, FileText, Headphones, Link2, Type, Image as ImageIcon, MousePointer2, StickyNote, Loader2, Copy, Check, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

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

// Real Canvas Demo - Identical to the actual product
const HeroCanvasDemo = () => {
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlTyped, setUrlTyped] = useState("");
  const [showExtraction, setShowExtraction] = useState(false);

  const fullUrl = "youtube.com/watch?v=dQw4w9W";

  // Animation sequence
  useEffect(() => {
    let isMounted = true;
    
    const runSequence = async () => {
      if (!isMounted) return;
      
      // Reset
      setStep(0);
      setIsGenerating(false);
      setShowResult(false);
      setCopied(false);
      setUrlTyped("");
      setShowExtraction(false);

      // Step 1: Show attachment node
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setStep(1);

      // Step 2: Type URL
      await new Promise(r => setTimeout(r, 500));
      if (!isMounted) return;
      
      for (let i = 0; i <= fullUrl.length; i++) {
        if (!isMounted) return;
        setUrlTyped(fullUrl.slice(0, i));
        await new Promise(r => setTimeout(r, 50));
      }

      // Step 3: Show extraction (thumbnail + title)
      await new Promise(r => setTimeout(r, 400));
      if (!isMounted) return;
      setShowExtraction(true);

      // Step 4: Show generator node
      await new Promise(r => setTimeout(r, 600));
      if (!isMounted) return;
      setStep(2);

      // Step 5: Draw connection
      await new Promise(r => setTimeout(r, 400));
      if (!isMounted) return;
      setStep(3);

      // Step 6: Generate
      await new Promise(r => setTimeout(r, 800));
      if (!isMounted) return;
      setIsGenerating(true);

      // Step 7: Show result
      await new Promise(r => setTimeout(r, 2200));
      if (!isMounted) return;
      setIsGenerating(false);
      setShowResult(true);

      // Step 8: Copy animation
      await new Promise(r => setTimeout(r, 1800));
      if (!isMounted) return;
      setCopied(true);

      // Wait and restart
      await new Promise(r => setTimeout(r, 3500));
      if (isMounted) runSequence();
    };

    runSequence();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative w-full aspect-[16/9] bg-background rounded-lg overflow-hidden">
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Real Toolbar */}
      <motion.div 
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
          {/* Left tools */}
          <div className="flex items-center gap-0.5 px-1">
            <div className="p-1.5 rounded bg-primary/10 text-primary">
              <MousePointer2 className="h-3 w-3" />
            </div>
            <div className="p-1.5 rounded hover:bg-muted text-muted-foreground">
              <Type className="h-3 w-3" />
            </div>
            <div className="p-1.5 rounded hover:bg-muted text-muted-foreground">
              <StickyNote className="h-3 w-3" />
            </div>
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          {/* AI Nodes */}
          <div className="flex items-center gap-1 px-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">
              <Paperclip className="h-2.5 w-2.5" />
              <span>Anexo</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-medium">
              <Sparkles className="h-2.5 w-2.5" />
              <span>Gerador</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Connection SVG Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <linearGradient id="heroConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(217, 91%, 60%)" />
            <stop offset="100%" stopColor="hsl(142, 71%, 45%)" />
          </linearGradient>
          <linearGradient id="heroResultGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(142, 71%, 45%)" />
            <stop offset="100%" stopColor="hsl(330, 81%, 60%)" />
          </linearGradient>
        </defs>

        {/* Attachment → Generator connection */}
        {step >= 3 && (
          <motion.path
            d="M 205 130 C 230 130, 250 125, 275 125"
            stroke="url(#heroConnectionGradient)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}

        {/* Generator → Result connection */}
        {showResult && (
          <motion.path
            d="M 410 125 C 440 125, 460 120, 490 120"
            stroke="url(#heroResultGradient)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}

        {/* Animated particle during generation */}
        {isGenerating && (
          <motion.circle
            cx="0"
            cy="0"
            r="4"
            fill="hsl(142, 71%, 45%)"
            style={{ filter: "drop-shadow(0 0 6px hsl(142, 71%, 45%))" }}
            animate={{
              cx: [205, 230, 260, 290, 320, 350, 380, 410],
              cy: [130, 128, 126, 125, 125, 124, 124, 125],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </svg>

      {/* Attachment Node */}
      <AnimatePresence>
        {step >= 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-[30px] top-[55px] z-20"
          >
            <div className="w-[175px] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-blue-500/5">
                <div className="p-1 rounded bg-blue-500/10">
                  <Paperclip className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <span className="text-xs font-medium">Anexo</span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                <div className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] bg-primary/5 text-primary border-b-2 border-primary">
                  <Link2 className="h-2.5 w-2.5" />
                </div>
                <div className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
                  <Type className="h-2.5 w-2.5" />
                </div>
                <div className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
                  <ImageIcon className="h-2.5 w-2.5" />
                </div>
              </div>

              {/* Content */}
              <div className="p-2.5 space-y-2">
                {/* URL Input */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded text-[10px]">
                  <Youtube className="h-3 w-3 text-red-500 flex-shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {urlTyped || "Cole uma URL..."}
                    {urlTyped.length > 0 && urlTyped.length < fullUrl.length && (
                      <span className="animate-pulse ml-0.5">|</span>
                    )}
                  </span>
                </div>

                {/* Extracted content preview */}
                <AnimatePresence>
                  {showExtraction && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-1.5"
                    >
                      <div className="relative rounded overflow-hidden">
                        <div className="aspect-video bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg">
                            <Play className="h-3 w-3 text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                      </div>
                      <motion.div 
                        className="text-[9px] text-muted-foreground line-clamp-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Como criar conteúdo viral usando IA em 2024...
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Connection handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-background shadow-sm" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generator Node */}
      <AnimatePresence>
        {step >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-[275px] top-[50px] z-20"
          >
            <div className="w-[135px] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-emerald-500/5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded bg-emerald-500/10">
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                  </div>
                  <span className="text-xs font-medium">Gerador</span>
                </div>
                {step >= 3 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/10 rounded text-[8px] text-blue-500 font-medium"
                  >
                    <Link2 className="h-2 w-2" />
                    <span>1</span>
                  </motion.div>
                )}
              </div>

              {/* Content */}
              <div className="p-2 space-y-1.5">
                {/* Format select */}
                <div className="space-y-0.5">
                  <span className="text-[8px] text-muted-foreground">Formato</span>
                  <div className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-[10px]">
                    <span>Carrossel</span>
                  </div>
                </div>

                {/* Platform */}
                <div className="space-y-0.5">
                  <span className="text-[8px] text-muted-foreground">Plataforma</span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-[10px]">
                    <Instagram className="h-2.5 w-2.5 text-pink-500" />
                    <span>Instagram</span>
                  </div>
                </div>

                {/* Generate button */}
                <motion.button
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium text-white transition-colors ${
                    isGenerating ? 'bg-emerald-600' : 'bg-emerald-500'
                  }`}
                  animate={!isGenerating && step >= 3 ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.6, repeat: !isGenerating ? 2 : 0 }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-2.5 w-2.5" fill="white" />
                      <span>Gerar</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Connection handles */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Node */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-[490px] top-[40px] z-20"
          >
            <div className="w-[155px] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-pink-500/5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded bg-pink-500/10">
                    <Sparkles className="h-3 w-3 text-pink-500" />
                  </div>
                  <span className="text-xs font-medium">Resultado</span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-500/10 rounded text-[8px] text-pink-500 font-medium">
                  <ImageIcon className="h-2 w-2" />
                  <span>6</span>
                </div>
              </div>

              {/* Content preview */}
              <div className="p-2 space-y-1.5">
                <div className="space-y-1 text-[9px]">
                  {[
                    "O que você precisa saber...",
                    "Como aplicar na prática...",
                    "Resultados esperados..."
                  ].map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="flex items-start gap-1.5"
                    >
                      <span className="flex-shrink-0 w-3.5 h-3.5 rounded bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground line-clamp-1">{text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Copy button */}
                <motion.button
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors ${
                    copied 
                      ? 'bg-emerald-500/10 text-emerald-600' 
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                  animate={copied ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {copied ? (
                    <>
                      <Check className="h-2.5 w-2.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-2.5 w-2.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Connection handle */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-background shadow-sm" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom input types hint */}
      <motion.div
        className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[9px] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {[
          { icon: Link2, label: "URL" },
          { icon: Youtube, label: "YouTube", color: "text-red-500" },
          { icon: FileText, label: "PDF" },
          { icon: ImageIcon, label: "Imagem" },
          { icon: Headphones, label: "Áudio" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded">
            <item.icon className={`h-2.5 w-2.5 ${item.color || ''}`} />
            <span>{item.label}</span>
          </div>
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
