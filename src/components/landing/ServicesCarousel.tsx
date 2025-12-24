import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Users, Shield, Zap, ArrowRight } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

const services = [
  {
    title: "Gestão de Clientes",
    description:
      "Organize todos os seus clientes com briefings, brand guidelines e histórico centralizado. Cada cliente tem seu espaço dedicado.",
    icon: Users,
    colorClass: "from-secondary to-accent",
  },
  {
    title: "Time Colaborativo",
    description:
      "Convide seu time e clientes com permissões granulares. Cada membro vê apenas o que precisa, mantendo tudo organizado.",
    icon: Shield,
    colorClass: "from-violet-500 to-purple-500",
  },
  {
    title: "IA Integrada",
    description:
      "Gere conteúdo, analise performance e automatize tarefas repetitivas. A IA aprende o tom de voz de cada cliente.",
    icon: Zap,
    colorClass: "from-primary to-cyan-500",
  },
];

const ServicesCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToCard = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = 380;
      const gap = 24;
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

  return (
    <section className="py-32 bg-muted/30 dark:bg-muted/10 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          {/* Left side - Title and navigation */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4 leading-tight">
              Tudo que sua{" "}
              <span className="italic text-muted-foreground">agência</span>
              <br />
              <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
                precisa
              </span>
            </h2>
            <p className="text-muted-foreground text-lg font-light mb-8 max-w-sm">
              Ferramentas pensadas para times que produzem conteúdo em escala.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePrev}
                className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all hover:bg-muted"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all hover:bg-muted"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Right side - Cards */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex-shrink-0 w-[340px] snap-start"
              >
                <div className="relative rounded-3xl overflow-hidden h-[420px] group bg-card border border-border">
                  {/* Fluid gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.colorClass} opacity-20`} />
                  
                  {/* Animated blob */}
                  <motion.div
                    className={`absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-r ${service.colorClass} blur-[80px] opacity-30`}
                    animate={{
                      scale: [1, 1.2, 1],
                      x: ["-50%", "-40%", "-50%"],
                      y: ["-50%", "-60%", "-50%"],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Dark overlay for contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent dark:from-black/80 dark:via-black/40" />

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-end p-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 backdrop-blur-sm flex items-center justify-center mb-4 border border-border">
                      <service.icon className="w-7 h-7 text-foreground" />
                    </div>
                    <h3 className="text-2xl font-medium text-foreground mb-2">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {service.description}
                    </p>
                    <Button
                      variant="ghost"
                      className="w-fit text-muted-foreground hover:text-foreground p-0 h-auto font-normal group/btn"
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

        {/* Mobile dots */}
        <div className="flex justify-center gap-2 mt-6 lg:hidden">
          {services.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToCard(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                activeIndex === index ? "bg-foreground w-6" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesCarousel;
