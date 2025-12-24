import { motion } from "framer-motion";
import { Sparkles, Bot, LayoutTemplate, Calendar, BarChart3, Check } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Task Bots Inteligentes",
    description: "Automatize tarefas repetitivas com IA",
  },
  {
    icon: LayoutTemplate,
    title: "+100 Templates de Conteúdo",
    description: "Pronto para usar em segundos",
  },
  {
    icon: Calendar,
    title: "Planejamento Automático",
    description: "Calendário editorial inteligente",
  },
  {
    icon: BarChart3,
    title: "Análise de Performance",
    description: "Insights em tempo real",
  },
];

const WorkflowSection = () => {
  return (
    <section id="workflow" className="py-24 bg-black relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20"
        style={{
          background:
            "radial-gradient(circle, hsl(25, 95%, 55%) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles className="w-4 h-4 text-[hsl(25,95%,55%)]" />
              <span className="text-sm text-white/80">Automação de Fluxo</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-light text-white mb-6 leading-tight">
              Automação de Conteúdo{" "}
              <span className="bg-gradient-to-r from-[hsl(25,95%,55%)] to-[hsl(330,85%,55%)] bg-clip-text text-transparent font-medium">
                Simplificada!
              </span>
            </h2>

            <p className="text-lg text-white/50 mb-10 leading-relaxed">
              Configure workflows inteligentes uma vez e deixe a IA fazer o
              trabalho pesado. Desde ideação até publicação, tudo automatizado.
            </p>

            {/* Features List */}
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                    <feature.icon className="w-5 h-5 text-white/70" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-white/50 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-8 overflow-hidden">
              {/* Workflow Visual */}
              <div className="space-y-4">
                {[
                  { step: "1", label: "Definir objetivo", status: "done" },
                  { step: "2", label: "IA gera ideias", status: "done" },
                  { step: "3", label: "Revisar e aprovar", status: "active" },
                  { step: "4", label: "Publicar automaticamente", status: "pending" },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      item.status === "active"
                        ? "bg-gradient-to-r from-[hsl(330,85%,55%)]/20 to-transparent border border-[hsl(330,85%,55%)]/30"
                        : "bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        item.status === "done"
                          ? "bg-[hsl(145,80%,42%)] text-black"
                          : item.status === "active"
                          ? "bg-[hsl(330,85%,55%)] text-white"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      {item.status === "done" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        item.step
                      )}
                    </div>
                    <span
                      className={`${
                        item.status === "pending"
                          ? "text-white/40"
                          : "text-white"
                      }`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Decorative gradient */}
              <div
                className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full opacity-30"
                style={{
                  background:
                    "radial-gradient(circle, hsl(330, 85%, 55%) 0%, transparent 70%)",
                  filter: "blur(40px)",
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
