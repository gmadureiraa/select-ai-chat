import { motion } from "framer-motion";

const stats = [
  {
    value: "50+",
    label: "Clientes atendidos",
    description: "Empresas que confiam em nós",
  },
  {
    value: "10.000+",
    label: "Conteúdos criados",
    description: "Posts, newsletters e mais",
  },
  {
    value: "500+",
    label: "Horas economizadas/mês",
    description: "Tempo médio economizado",
  },
];

const StatsSection = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-white/50">
            Nada grandioso é feito{" "}
            <span className="text-white font-medium">sozinho</span>
          </h2>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="rounded-3xl border border-white/10 p-8 text-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <motion.div
                  initial={{ scale: 0.5 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                  className="text-5xl md:text-6xl font-light bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent mb-4"
                >
                  {stat.value}
                </motion.div>
                <h3 className="text-lg font-medium text-white mb-2">
                  {stat.label}
                </h3>
                <p className="text-white/40 text-sm">{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
