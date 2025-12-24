import { motion } from "framer-motion";
import { Brain, Users, Zap, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";

const services = [
  {
    title: "Insights com IA",
    description:
      "Obtenha insights acionáveis dos seus dados com nossa engine de analytics inteligente. Descubra padrões e oportunidades.",
    icon: Brain,
    gradient: "from-[hsl(250,85%,55%)] to-[hsl(280,85%,55%)]",
  },
  {
    title: "Gestão de Clientes",
    description:
      "Organize todos os seus clientes, marcas e diretrizes em um só lugar. Nunca perca o contexto de uma marca.",
    icon: Users,
    gradient: "from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)]",
  },
  {
    title: "Automações",
    description:
      "Configure uma vez, execute para sempre. Workflows inteligentes que trabalham enquanto você dorme.",
    icon: Zap,
    gradient: "from-[hsl(145,80%,42%)] to-[hsl(185,75%,45%)]",
  },
];

const ServicesCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToCard = (index: number) => {
    setActiveIndex(index);
    if (containerRef.current) {
      const cardWidth = containerRef.current.scrollWidth / services.length;
      containerRef.current.scrollTo({
        left: cardWidth * index,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20"
        style={{
          background:
            "radial-gradient(ellipse, hsl(330, 85%, 55%) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-light text-white mb-4">
            Serviços Inteligentes,{" "}
            <span className="italic text-white/60">Construídos com IA</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Ferramentas poderosas que transformam como agências e empresas criam
            conteúdo
          </p>
        </motion.div>

        {/* Cards Container */}
        <div
          ref={containerRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 w-full md:w-[calc(33.333%-16px)] snap-start"
            >
              <div
                className={`relative h-[400px] rounded-3xl p-8 overflow-hidden group cursor-pointer bg-gradient-to-br ${service.gradient}`}
              >
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-black/20" />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                    <service.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-2xl font-semibold text-white mb-3">
                    {service.title}
                  </h3>
                  <p className="text-white/80 text-base leading-relaxed flex-1">
                    {service.description}
                  </p>

                  <div className="flex items-center gap-2 text-white/90 group-hover:text-white transition-colors mt-6">
                    <span className="text-sm font-medium">Explorar</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mt-8 md:hidden">
          {services.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToCard(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                activeIndex === index
                  ? "bg-white w-6"
                  : "bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesCarousel;
