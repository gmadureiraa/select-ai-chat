import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Maria Silva",
    role: "CEO, Agência Digital",
    avatar: "MS",
    content:
      "O KAI revolucionou nossa produção de conteúdo. Economizamos mais de 20 horas por semana e a qualidade só aumentou.",
    rating: 5,
  },
  {
    name: "João Santos",
    role: "Head de Marketing",
    avatar: "JS",
    content:
      "A integração com todas as plataformas é perfeita. Finalmente temos uma visão unificada de todas as métricas.",
    rating: 5,
  },
  {
    name: "Ana Costa",
    role: "Content Manager",
    avatar: "AC",
    content:
      "As automações são incríveis. Configurei uma vez e agora o conteúdo é gerado automaticamente seguindo nossa identidade.",
    rating: 5,
  },
];

const clientLogos = [
  "TechCorp",
  "StartupX",
  "GrowthLab",
  "MediaPro",
  "ContentHub",
  "DigiAgency",
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] opacity-15"
        style={{
          background:
            "radial-gradient(ellipse, hsl(145, 80%, 42%) 0%, transparent 60%)",
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
            O que nossos clientes{" "}
            <span className="italic text-white/60">dizem</span>
          </h2>
          <p className="text-white/50 text-lg">
            Histórias reais de transformação digital
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-3xl bg-white/[0.03] border border-white/10 p-8 hover:bg-white/[0.05] transition-colors"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-[hsl(45,90%,55%)] text-[hsl(45,90%,55%)]"
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-white/70 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{testimonial.name}</p>
                  <p className="text-white/40 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Client Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-12 border-t border-white/10"
        >
          <p className="text-center text-white/30 text-sm uppercase tracking-widest mb-8">
            Empresas que confiam em nós
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {clientLogos.map((logo, index) => (
              <motion.div
                key={logo}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="text-white/20 text-lg font-medium hover:text-white/40 transition-colors"
              >
                {logo}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
