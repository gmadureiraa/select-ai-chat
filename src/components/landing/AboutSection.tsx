import { motion } from "framer-motion";

const AboutSection = () => {
  return (
    <section id="about" className="py-32 bg-black relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] opacity-10"
        style={{
          background:
            "radial-gradient(ellipse, hsl(145, 80%, 42%) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
      />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Small title */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/40 text-sm uppercase tracking-widest mb-8"
          >
            Nossa Missão
          </motion.p>

          {/* Main text */}
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-light text-white leading-relaxed">
            <span className="text-white/50">Bem-vindo à </span>
            <span className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent font-medium">
              nova era
            </span>
            <span className="text-white/50"> da criação de conteúdo!</span>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-white/60 mt-10 leading-relaxed max-w-3xl mx-auto"
          >
            Somos apaixonados por{" "}
            <span className="text-white font-medium">transformar empresas</span>{" "}
            com soluções inovadoras. Nosso objetivo?{" "}
            <span className="italic">Simplificar processos</span> e liberar sua{" "}
            <span className="text-[hsl(145,80%,50%)]">criatividade</span>.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-lg text-white/40 mt-8 max-w-2xl mx-auto"
          >
            Acreditamos que coisas incríveis devem ser fáceis de acessar.
            <br />
            Vamos explorar como podemos ajudar você!
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
