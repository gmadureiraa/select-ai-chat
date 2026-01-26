import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play, Paperclip, Instagram, Twitter, FileText, Headphones, Link2, Type, Image as ImageIcon, MousePointer2, StickyNote, Loader2, Copy, Check, Youtube, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

// Scenario configurations
const scenarios = [
  {
    id: 'youtube-carousel',
    attachment: {
      type: 'url',
      icon: Youtube,
      iconColor: 'text-red-500',
      label: 'youtube.com/watch?v=...',
      extraction: { title: 'Como criar conteúdo viral...', duration: '12:34', views: '45K' }
    },
    generator: { format: 'Carrossel', platform: 'instagram', platformIcon: Instagram, platformColor: 'text-pink-500' },
    result: {
      type: 'carousel',
      badge: 'Carrossel',
      badgeIcon: ImageIcon,
      slides: ['O que é marketing de...', 'Como funciona na...', 'Estratégias para...', 'Resultados esperados']
    }
  },
  {
    id: 'image-generation',
    attachment: {
      type: 'image+text',
      icon: ImageIcon,
      iconColor: 'text-purple-500',
      label: 'referencia_visual.jpg',
      briefing: 'Crie uma imagem minimalista com tons pastéis...'
    },
    generator: { format: 'Imagem', platform: null, platformIcon: null, platformColor: '' },
    result: {
      type: 'image',
      badge: 'Imagem',
      badgeIcon: ImageIcon,
      gradient: 'from-purple-500/30 via-pink-500/20 to-orange-500/30'
    }
  },
  {
    id: 'pdf-thread',
    attachment: {
      type: 'pdf',
      icon: FileText,
      iconColor: 'text-orange-500',
      label: 'relatorio_2024.pdf',
      extraction: { pages: '24 páginas', size: '2.4 MB' }
    },
    generator: { format: 'Thread', platform: 'twitter', platformIcon: Twitter, platformColor: 'text-sky-500' },
    result: {
      type: 'thread',
      badge: 'Thread',
      badgeIcon: Twitter,
      tweets: ['1/5 Principais insights do...', '2/5 O mercado mostrou...', '3/5 Tendências para 2025...']
    }
  },
  {
    id: 'audio-newsletter',
    attachment: {
      type: 'audio',
      icon: Headphones,
      iconColor: 'text-cyan-500',
      label: 'podcast_ep42.mp3',
      extraction: { duration: '45:22', format: 'MP3' }
    },
    generator: { format: 'Newsletter', platform: 'email', platformIcon: Mail, platformColor: 'text-blue-500' },
    result: {
      type: 'newsletter',
      badge: 'Newsletter',
      badgeIcon: Mail,
      content: { title: 'Weekly Insights #42', preview: 'Nesta edição, exploramos as principais tendências...' }
    }
  }
];

// Node widths for connection calculations
const NODE_WIDTHS = {
  attachment: 175,
  generator: 135,
  result: 165
};

const GAP = 60; // Gap between nodes

// Real Canvas Demo - Multiple scenarios with centralized layout
const HeroCanvasDemo = () => {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [animationStep, setAnimationStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios[currentScenario];

  // Animation timeline for each scenario
  useEffect(() => {
    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];

    const runScenario = () => {
      if (!isMounted) return;

      // Reset
      setAnimationStep(0);
      setCopied(false);

      const schedule = (step: number, delay: number) => {
        const timeout = setTimeout(() => {
          if (isMounted) {
            if (step === 0) {
              // Move to next scenario
              setCurrentScenario((prev) => (prev + 1) % scenarios.length);
              runScenario();
            } else {
              setAnimationStep(step);
              if (step === 7) setCopied(true);
            }
          }
        }, delay);
        timeouts.push(timeout);
      };

      schedule(1, 500);   // Attachment appears
      schedule(2, 1200);  // Content fills in
      schedule(3, 2000);  // Generator appears + edge
      schedule(4, 3000);  // Generating...
      schedule(5, 4500);  // Result edge
      schedule(6, 5000);  // Result appears
      schedule(7, 6500);  // Interaction (copy)
      schedule(0, 8000);  // Next scenario
    };

    runScenario();

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, [currentScenario]);

  // Calculate total width of all visible nodes
  const getTotalWidth = () => {
    let width = NODE_WIDTHS.attachment;
    if (animationStep >= 3) width += GAP + NODE_WIDTHS.generator;
    if (animationStep >= 6) width += GAP + NODE_WIDTHS.result;
    return width;
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-[16/9] bg-background rounded-lg overflow-hidden">
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

      {/* CENTERED Nodes Container with proper positioning */}
      <div className="absolute inset-0 flex items-center justify-center pt-8">
        <div className="relative flex items-start" style={{ gap: `${GAP}px` }}>
          {/* Attachment Node */}
          <AnimatePresence mode="wait">
            {animationStep >= 1 && (
              <motion.div
                key={`attachment-${scenario.id}`}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="relative"
                style={{ width: NODE_WIDTHS.attachment }}
              >
                <div className="w-full bg-background border border-border rounded-lg shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-blue-500/5">
                    <div className="p-1 rounded bg-blue-500/10">
                      <Paperclip className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <span className="text-xs font-medium">Anexo</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-border">
                    <div className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px]",
                      scenario.attachment.type === 'url' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}>
                      <Link2 className="h-2.5 w-2.5" />
                    </div>
                    <div className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px]",
                      scenario.attachment.type === 'pdf' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}>
                      <FileText className="h-2.5 w-2.5" />
                    </div>
                    <div className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px]",
                      scenario.attachment.type === 'image+text' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}>
                      <ImageIcon className="h-2.5 w-2.5" />
                    </div>
                    <div className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px]",
                      scenario.attachment.type === 'audio' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground"
                    )}>
                      <Headphones className="h-2.5 w-2.5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-2.5 space-y-2">
                    {/* Input display */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded text-[10px]">
                      <scenario.attachment.icon className={cn("h-3 w-3 flex-shrink-0", scenario.attachment.iconColor)} />
                      <span className="text-muted-foreground truncate">
                        {animationStep >= 2 ? scenario.attachment.label : "Carregando..."}
                        {animationStep === 1 && (
                          <span className="animate-pulse ml-0.5">|</span>
                        )}
                      </span>
                    </div>

                    {/* Extracted content preview */}
                    <AnimatePresence>
                      {animationStep >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-1.5"
                        >
                          {/* YouTube type - Enhanced with progress bar */}
                          {scenario.attachment.type === 'url' && scenario.attachment.extraction && (
                            <>
                              <div className="relative rounded overflow-hidden">
                                <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                                  {/* Thumbnail effect */}
                                  <div className="absolute inset-0 bg-red-500/10" />
                                  {/* Play button with pulse */}
                                  <motion.div 
                                    className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg z-10"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  >
                                    <Play className="h-3 w-3 text-white ml-0.5" fill="white" />
                                  </motion.div>
                                  {/* Progress bar */}
                                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700">
                                    <motion.div
                                      className="h-full bg-red-500"
                                      initial={{ width: "0%" }}
                                      animate={{ width: "100%" }}
                                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="text-[9px] text-muted-foreground line-clamp-2">
                                {scenario.attachment.extraction.title}
                              </div>
                              <div className="text-[8px] text-muted-foreground/70">
                                {scenario.attachment.extraction.duration} • {scenario.attachment.extraction.views} views
                              </div>
                            </>
                          )}

                          {/* Image + Briefing type - Enhanced with scan effect */}
                          {scenario.attachment.type === 'image+text' && (
                            <>
                              <div className="w-full h-12 bg-purple-500/10 rounded relative overflow-hidden flex items-center justify-center">
                                <div className="absolute inset-1 border-2 border-dashed border-purple-500/30 rounded flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-purple-400/50" />
                                </div>
                                {/* Scan effect */}
                                <motion.div
                                  className="absolute left-0 right-0 h-4 bg-purple-500/20"
                                  animate={{ top: ["-16px", "48px"] }}
                                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                                />
                              </div>
                              <div className="text-[9px] text-muted-foreground line-clamp-2">
                                {scenario.attachment.briefing}
                              </div>
                            </>
                          )}

                          {/* PDF type - Enhanced with page scan */}
                          {scenario.attachment.type === 'pdf' && scenario.attachment.extraction && (
                            <div className="relative p-2 bg-orange-500/10 rounded overflow-hidden">
                              <div className="flex items-center gap-2 relative z-10">
                                <FileText className="w-5 h-5 text-orange-500" />
                                <div>
                                  <div className="text-[10px] font-medium">{scenario.attachment.extraction.pages}</div>
                                  <div className="text-[8px] text-muted-foreground">{scenario.attachment.extraction.size}</div>
                                </div>
                              </div>
                              {/* Scanning line effect */}
                              <motion.div
                                className="absolute left-0 right-0 h-3 bg-orange-500/20"
                                animate={{ top: ["-12px", "100%"] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
                              />
                            </div>
                          )}

                          {/* Audio type - Enhanced waveform */}
                          {scenario.attachment.type === 'audio' && scenario.attachment.extraction && (
                            <div className="p-2 bg-cyan-500/10 rounded">
                              <div className="flex items-center gap-0.5 h-8 mb-1.5">
                                {[...Array(16)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="w-0.5 rounded-full bg-cyan-500"
                                    animate={{
                                      height: [4, 16 + Math.random() * 12, 4],
                                      opacity: [0.5, 1, 0.5],
                                    }}
                                    transition={{
                                      duration: 0.6 + Math.random() * 0.4,
                                      repeat: Infinity,
                                      delay: i * 0.03,
                                      ease: "easeInOut",
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-medium text-cyan-600">{scenario.attachment.extraction.duration}</div>
                                <div className="text-[8px] text-muted-foreground">{scenario.attachment.extraction.format}</div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Connection handle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-background shadow-sm z-10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection Line 1: Attachment → Generator */}
          <AnimatePresence>
            {animationStep >= 3 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-primary/60 z-0"
                style={{
                  left: NODE_WIDTHS.attachment + 5,
                  width: GAP - 10
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
          </AnimatePresence>

          {/* Generator Node */}
          <AnimatePresence mode="wait">
            {animationStep >= 3 && (
              <motion.div
                key={`generator-${scenario.id}`}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="relative"
                style={{ width: NODE_WIDTHS.generator }}
              >
                <div className="w-full bg-background border border-border rounded-lg shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-emerald-500/5">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded bg-emerald-500/10">
                        <Sparkles className="h-3 w-3 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium">Gerador</span>
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/10 rounded text-[8px] text-blue-500 font-medium"
                    >
                      <Link2 className="h-2 w-2" />
                      <span>1</span>
                    </motion.div>
                  </div>

                  {/* Content */}
                  <div className="p-2 space-y-1.5">
                    {/* Format select */}
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-muted-foreground">Formato</span>
                      <div className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-[10px]">
                        <span>{scenario.generator.format}</span>
                      </div>
                    </div>

                    {/* Platform */}
                    {scenario.generator.platformIcon && (
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-muted-foreground">Plataforma</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-[10px]">
                          <scenario.generator.platformIcon className={cn("h-2.5 w-2.5", scenario.generator.platformColor)} />
                          <span className="capitalize">{scenario.generator.platform}</span>
                        </div>
                      </div>
                    )}

                    {/* Generate button */}
                    <motion.button
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium text-white transition-colors",
                        animationStep === 4 ? 'bg-emerald-600' : 'bg-emerald-500'
                      )}
                      animate={animationStep === 3 ? { scale: [1, 1.03, 1] } : {}}
                      transition={{ duration: 0.6, repeat: animationStep === 3 ? 2 : 0 }}
                    >
                      {animationStep === 4 ? (
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
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm z-10" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm z-10" />
                </div>

                {/* Generating particle animation */}
                {animationStep === 4 && (
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 z-20"
                    style={{ right: -GAP/2 }}
                    animate={{
                      x: [0, GAP/2 + 20, GAP - 10],
                      opacity: [1, 1, 0],
                      scale: [1, 1.2, 0.8]
                    }}
                    transition={{ 
                      duration: 1.2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection Line 2: Generator → Result */}
          <AnimatePresence>
            {animationStep >= 5 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-primary/60 z-0"
                style={{
                  left: NODE_WIDTHS.attachment + GAP + NODE_WIDTHS.generator + 5,
                  width: GAP - 10
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
          </AnimatePresence>

          {/* Result Node */}
          <AnimatePresence mode="wait">
            {animationStep >= 6 && (
              <motion.div
                key={`result-${scenario.id}`}
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="relative"
                style={{ width: NODE_WIDTHS.result }}
              >
                <div className="w-full bg-background border border-border rounded-lg shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-pink-500/5">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded bg-pink-500/10">
                        <Sparkles className="h-3 w-3 text-pink-500" />
                      </div>
                      <span className="text-xs font-medium">Resultado</span>
                    </div>
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-500/10 rounded text-[8px] text-pink-500 font-medium">
                      <scenario.result.badgeIcon className="h-2 w-2" />
                      <span>{scenario.result.badge}</span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <div className="p-2 space-y-1.5">
                    {/* Carousel slides */}
                    {scenario.result.type === 'carousel' && scenario.result.slides?.map((text, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        className="flex items-start gap-1.5 text-[9px]"
                      >
                        <span className="flex-shrink-0 w-3.5 h-3.5 rounded bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground line-clamp-1">{text}</span>
                      </motion.div>
                    ))}

                    {/* Image result */}
                    {scenario.result.type === 'image' && (
                      <motion.div
                        className={cn("w-full h-16 rounded bg-gradient-to-br", scenario.result.gradient)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-white/50" />
                        </div>
                      </motion.div>
                    )}

                    {/* Thread tweets */}
                    {scenario.result.type === 'thread' && scenario.result.tweets?.map((tweet, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        className="p-1.5 bg-sky-500/10 rounded text-[9px] text-muted-foreground"
                      >
                        {tweet}
                      </motion.div>
                    ))}

                    {/* Newsletter */}
                    {scenario.result.type === 'newsletter' && scenario.result.content && (
                      <motion.div
                        className="p-2 bg-blue-500/10 rounded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-[10px] font-medium mb-1">{scenario.result.content.title}</div>
                        <div className="text-[8px] text-muted-foreground line-clamp-2">{scenario.result.content.preview}</div>
                      </motion.div>
                    )}

                    {/* Copy button */}
                    <motion.button
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors",
                        copied 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      )}
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
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-background shadow-sm z-10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scenario indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {scenarios.map((s, index) => (
          <motion.div
            key={s.id}
            className={cn(
              "w-2 h-2 rounded-full transition-colors duration-300",
              index === currentScenario ? "bg-primary" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
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
      {/* Main Headline - Quantified benefit */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight"
        >
          Transforme <span className="text-primary">1 vídeo</span>
          <br />
          em <span className="text-primary">10 conteúdos</span> prontos
        </motion.h1>

        {/* Subtitle with clear value */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Canvas visual de criação com IA. Cole um vídeo do YouTube, PDF ou texto
          e gere carrosséis, threads, artigos e mais em minutos.
        </motion.p>

        {/* CTAs with urgency */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
        >
          <Link to="/signup?plan=basic">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base font-semibold rounded-full group min-w-[280px] shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Começar agora
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

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Sem cartão de crédito
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
            Setup em 2 minutos
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
            Cancele quando quiser
          </span>
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

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 rounded-full bg-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default NewHeroSection;
