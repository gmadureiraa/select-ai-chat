import { motion } from "framer-motion";

const stats = [
  {
    value: "50+",
    label: "Agências utilizando",
    description: "Times de conteúdo confiam no KAI",
  },
  {
    value: "500+",
    label: "Clientes gerenciados",
    description: "Organizados em uma plataforma",
  },
  {
    value: "10k+",
    label: "Conteúdos criados/mês",
    description: "Posts, newsletters, vídeos e mais",
  },
];

const StatsSection = () => {
  return (
    <section className="py-24 bg-muted/30 dark:bg-muted/10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-muted-foreground">
            Times que{" "}
            <span className="text-foreground font-medium">escalam juntos</span>
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
              <div className="rounded-3xl border border-border p-8 text-center bg-card hover:border-primary/30 hover:shadow-lg transition-all">
                <motion.div
                  initial={{ scale: 0.5 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                  className="text-5xl md:text-6xl font-light bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent mb-4"
                >
                  {stat.value}
                </motion.div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {stat.label}
                </h3>
                <p className="text-muted-foreground text-sm">{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
