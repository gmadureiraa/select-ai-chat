import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Users, Shield, Zap, ArrowRight, BarChart3, Target, MoveHorizontal, PenTool, Image, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

const services = [
  {
    title: "Assistente IA Inteligente",
    description:
      "Converse com a IA que aprende o tom de voz de cada cliente. Gere conteúdo, analise referências e receba sugestões personalizadas.",
    icon: Zap,
    colorClass: "from-primary to-cyan-500",
    targetSection: "canvas-demo",
  },
  {
    title: "Canvas de Criação",
    description:
      "Arraste fontes, conecte nós e deixe a IA criar múltiplos conteúdos. Visualize todo o fluxo em tempo real.",
    icon: PenTool,
    colorClass: "from-secondary to-pink-500",
    targetSection: "canvas-demo",
  },
  {
    title: "Geração de Imagens",
    description:
      "Crie imagens personalizadas com IA. Carrosséis, thumbnails, stories. Tudo integrado ao seu fluxo.",
    icon: Image,
    colorClass: "from-violet-500 to-purple-500",
    targetSection: "canvas-demo",
  },
  {
    title: "Performance Analytics",
    description:
      "Métricas de Instagram, YouTube e Newsletter em um só lugar. Dashboards visuais e insights para cada cliente.",
    icon: BarChart3,
    colorClass: "from-emerald-500 to-teal-500",
    targetSection: "features",
  },
  {
    title: "Planejamento & Publicação",
    description:
      "Kanban visual para organizar seu conteúdo. Agende e publique diretamente nas suas redes sociais.",
    icon: Send,
    colorClass: "from-accent to-orange-500",
    targetSection: "pricing",
  },
  {
    title: "Gestão de Perfis",
    description:
      "Organize todos os seus perfis com briefings, brand guidelines e histórico centralizado.",
    icon: Users,
    colorClass: "from-blue-500 to-indigo-500",
    targetSection: "features",
  },
];

const ServicesCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showDragHint, setShowDragHint] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowDragHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const scrollToCard = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = 320;
      const gap = 20;
      scrollRef.current.scrollTo({
        left: index * (cardWidth + gap),
        behavior: "smooth",
      });
      setActiveIndex(index);
    }
  };

  const handlePrev = () => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : services.length - 1;
    scrollToCard(newIndex);
  };

  const handleNext = () => {
    const newIndex = activeIndex < services.length - 1 ? activeIndex + 1 : 0;
    scrollToCard(newIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
    setShowDragHint(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
    setShowDragHint(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0].pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  return (
    <section id="features" className="py-24 md:py-32 bg-muted/30 dark:bg-muted/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8 lg:gap-12 items-start">
          {/* Left side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
              Tudo que você{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                precisa
              </span>
            </h2>
            <p className="text-muted-foreground text-lg font-light mb-8 max-w-sm">
              Ferramentas pensadas para quem produz conteúdo em escala.
            </p>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all hover:bg-muted active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all hover:bg-muted active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground ml-2">
                {activeIndex + 1} / {services.length}
              </span>
            </div>
            
            {/* Desktop dots */}
            <div className="hidden lg:flex gap-1.5 mt-6">
              {services.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToCard(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeIndex === index 
                      ? "bg-primary w-6" 
                      : "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right side - Cards */}
          <div className="relative">
            {showDragHint && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 right-4 -translate-y-1/2 z-20 flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 pointer-events-none"
              >
                <MoveHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Arraste</span>
              </motion.div>
            )}
            
            <div
              ref={scrollRef}
              className={`flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onScroll={(e) => {
                const scrollLeftPos = e.currentTarget.scrollLeft;
                const cardWidth = 320 + 20;
                const newIndex = Math.round(scrollLeftPos / cardWidth);
                if (newIndex !== activeIndex && newIndex >= 0 && newIndex < services.length) {
                  setActiveIndex(newIndex);
                }
              }}
            >
              {services.map((service, index) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex-shrink-0 w-[320px] snap-start select-none"
                >
                  <div className="relative rounded-2xl overflow-hidden h-[360px] group bg-card border border-border hover:border-primary/30 transition-colors">
                    <div className={`absolute inset-0 bg-gradient-to-br ${service.colorClass} opacity-10`} />
                    
                    <motion.div
                      className={`absolute top-1/2 left-1/2 w-[250px] h-[250px] rounded-full bg-gradient-to-r ${service.colorClass} blur-[80px] opacity-20`}
                      animate={{
                        scale: [1, 1.1, 1],
                        x: ["-50%", "-45%", "-50%"],
                        y: ["-50%", "-55%", "-50%"],
                      }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent dark:from-black/90 dark:via-black/50" />

                    <div className="relative z-10 h-full flex flex-col justify-end p-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.colorClass} flex items-center justify-center mb-4 shadow-lg`}>
                        <service.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                        {service.description}
                      </p>
                      <Button
                        variant="ghost"
                        className="w-fit text-muted-foreground hover:text-foreground p-0 h-auto font-normal group/btn pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetElement = document.getElementById(service.targetSection);
                          if (targetElement) {
                            targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                      >
                        Saiba mais
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile dots */}
        <div className="flex justify-center gap-1.5 mt-6 lg:hidden">
          {services.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "bg-primary w-5" : "bg-muted-foreground/30 w-2"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesCarousel;
