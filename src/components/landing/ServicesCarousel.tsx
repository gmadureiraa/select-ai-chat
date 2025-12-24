import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Brain, Users, Zap, ArrowRight } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

const services = [
  {
    title: "Insights com IA",
    description:
      "Obtenha insights acionáveis dos seus dados com nossa engine de analytics inteligente que aprende com seu conteúdo.",
    icon: Brain,
    gradientStart: "#6366F1",
    gradientEnd: "#8B5CF6",
  },
  {
    title: "Gestão de Clientes",
    description:
      "Organize todos os seus clientes, marcas e diretrizes de conteúdo em um só lugar centralizado e inteligente.",
    icon: Users,
    gradientStart: "#E11D9B",
    gradientEnd: "#F97316",
  },
  {
    title: "Automações",
    description:
      "Configure uma vez, execute para sempre. Workflows inteligentes que trabalham enquanto você dorme.",
    icon: Zap,
    gradientStart: "#10B981",
    gradientEnd: "#06B6D4",
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
    <section className="py-32 bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          {/* Left side - Title and navigation */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-light text-white mb-4 leading-tight">
              Serviços{" "}
              <span className="italic text-white/80">Inteligentes</span>,
              <br />
              <span className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent font-medium">
                Construídos com IA
              </span>
            </h2>
            <p className="text-white/40 text-lg font-light mb-8 max-w-sm">
              Ferramentas poderosas para transformar sua criação de conteúdo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePrev}
                className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all hover:bg-white/5"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all hover:bg-white/5"
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
                <div className="relative rounded-3xl overflow-hidden h-[420px] group">
                  {/* Fluid gradient background */}
                  <div className="absolute inset-0">
                    <svg
                      viewBox="0 0 400 500"
                      className="w-full h-full"
                      preserveAspectRatio="xMidYMid slice"
                    >
                      <defs>
                        <linearGradient
                          id={`cardGrad${index}`}
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor={service.gradientStart} />
                          <stop offset="100%" stopColor={service.gradientEnd} />
                        </linearGradient>
                        <filter id={`blur${index}`}>
                          <feGaussianBlur stdDeviation="30" />
                        </filter>
                      </defs>
                      <motion.ellipse
                        cx="200"
                        cy="250"
                        rx="180"
                        ry="200"
                        fill={`url(#cardGrad${index})`}
                        filter={`url(#blur${index})`}
                        animate={{
                          rx: [180, 200, 180],
                          ry: [200, 180, 200],
                          cx: [200, 220, 200],
                        }}
                        transition={{
                          duration: 8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </svg>
                  </div>

                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-end p-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4 border border-white/10">
                      <service.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-medium text-white mb-2">
                      {service.title}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-6">
                      {service.description}
                    </p>
                    <Button
                      variant="ghost"
                      className="w-fit text-white/80 hover:text-white p-0 h-auto font-normal group/btn"
                    >
                      Explorar
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
                activeIndex === index ? "bg-white w-6" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesCarousel;
