import { motion } from "framer-motion";

const AboutSection = () => {
  return (
    <section id="about" className="py-32 bg-background relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] opacity-10"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--primary)) 0%, transparent 60%)",
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
            className="text-muted-foreground text-sm uppercase tracking-widest mb-8"
          >
            Por que o KAI?
          </motion.p>

          {/* Main text */}
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-light text-foreground leading-relaxed">
            <span className="text-muted-foreground">Criamos o KAI para </span>
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
              agências e times
            </span>
            <span className="text-muted-foreground"> que precisam escalar.</span>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-muted-foreground mt-10 leading-relaxed max-w-3xl mx-auto"
          >
            Seu{" "}
            <span className="text-foreground font-medium">time acessa os clientes</span>.{" "}
            Seus{" "}
            <span className="text-foreground font-medium">clientes acompanham as entregas</span>.{" "}
            Você{" "}
            <span className="text-primary">mantém o controle</span>.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-lg text-muted-foreground/70 mt-8 max-w-2xl mx-auto"
          >
            Chega de planilhas, pastas compartilhadas e ferramentas desconectadas.
            <br />
            Uma plataforma, todos os clientes, todo o time.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
