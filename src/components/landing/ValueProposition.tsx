import { motion } from "framer-motion";
import { 
  User, 
  PenTool, 
  Image, 
  Send,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const pillars = [
  {
    step: "1",
    icon: User,
    title: "Entende seu perfil",
    description: "Tom de voz, objetivos e audiência. KAI aprende com cada interação.",
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-500/10",
  },
  {
    step: "2",
    icon: PenTool,
    title: "Desenvolve conteúdo",
    description: "Textos otimizados para cada plataforma. Posts, threads, artigos.",
    color: "from-primary to-emerald-500",
    bgColor: "bg-primary/10",
  },
  {
    step: "3",
    icon: Image,
    title: "Cria as imagens",
    description: "Geração de imagens com IA. Carrosséis, thumbnails, stories.",
    color: "from-secondary to-pink-500",
    bgColor: "bg-secondary/10",
  },
  {
    step: "4",
    icon: Send,
    title: "Publica direto",
    description: "Planejamento visual e publicação agendada nas suas redes.",
    color: "from-accent to-orange-500",
    bgColor: "bg-accent/10",
  },
];

const ValueProposition = () => {
  return (
    <section className="py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/3 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-secondary/3 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-6 bg-secondary/10 text-secondary border-secondary/20">
            Tudo em um só lugar
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Como o <span className="text-primary">KAI</span> funciona
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-2xl mx-auto">
            Do entendimento do seu perfil até a publicação. Automatize seu fluxo de conteúdo.
          </p>
        </motion.div>

        {/* Pillars Grid */}
        <div className="grid md:grid-cols-4 gap-6 relative">
          {/* Connection line - Desktop */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-primary/40 to-accent/20 -translate-y-1/2 z-0" />
          
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative z-10"
            >
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all h-full text-center group">
                {/* Step indicator */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${pillar.color} flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <pillar.icon className="w-8 h-8 text-white" />
                </div>
                
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-3 inline-block">
                  Passo {pillar.step}
                </span>
                
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
              
              {/* Arrow connector - Desktop */}
              {index < pillars.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-20">
                  <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-primary" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border border-border text-center"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Resultado: <span className="text-primary">10x mais conteúdo</span> em <span className="text-secondary">menos tempo</span>
          </h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Enquanto você foca no que importa, KAI cuida da produção. Menos trabalho manual, mais presença online.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ValueProposition;
