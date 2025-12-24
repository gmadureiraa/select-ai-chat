import { motion } from "framer-motion";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    author: "Maria Santos",
    role: "CEO, Studio Criativo",
    content:
      "O KAI transformou completamente nossa operação de conteúdo. Conseguimos aumentar nossa produção em 300% mantendo a qualidade.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
  },
  {
    author: "Pedro Lima",
    role: "Head de Marketing, TechBR",
    content:
      "A melhor ferramenta de IA para criação de conteúdo que já utilizei. Interface intuitiva e resultados impressionantes desde o primeiro dia.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
  },
  {
    author: "Ana Costa",
    role: "Diretora de Conteúdo, Agência Nova",
    content:
      "Reduzimos nosso tempo de produção pela metade e os clientes nunca estiveram tão satisfeitos. O ROI foi imediato.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
  },
];

const clientLogos = [
  "TechCorp",
  "InnovateBR",
  "Digital First",
  "CreativeHub",
  "NextLevel",
  "FutureMedia",
];

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(1);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : testimonials.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < testimonials.length - 1 ? prev + 1 : 0));
  };

  return (
    <section className="py-32 bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,29,155,0.08)_0%,transparent_70%)]" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-16"
        >
          <div>
            <h2 className="text-4xl md:text-5xl font-light text-white mb-2">
              O que nossos{" "}
              <span className="italic text-white/80">clientes</span> dizem
            </h2>
            <p className="text-white/40 text-lg font-light">
              Histórias reais de transformação
            </p>
          </div>
          <div className="hidden md:flex gap-3">
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

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl transition-all duration-300 ${
                index === activeIndex
                  ? "bg-gradient-to-br from-[hsl(330,85%,55%)]/20 to-[hsl(25,95%,55%)]/10 border-2 border-[hsl(35,95%,55%)]/50"
                  : "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-white/10 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      index === activeIndex
                        ? "text-[hsl(35,95%,55%)] fill-[hsl(35,95%,55%)]"
                        : "text-white/30 fill-white/30"
                    }`}
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-white/70 text-base leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.image}
                  alt={testimonial.author}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                />
                <div>
                  <h4 className="text-white font-medium">
                    {testimonial.author}
                  </h4>
                  <p className="text-white/40 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Client logos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap justify-center gap-4"
        >
          {clientLogos.map((logo, index) => (
            <motion.div
              key={logo}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="px-8 py-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-white/40 font-medium text-sm tracking-wide">
                {logo}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
