import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  ArrowRight, 
  Check,
  Crown
} from "lucide-react";
import { Link } from "react-router-dom";

const pillars = [
  {
    icon: LayoutDashboard,
    title: "Planejamento",
    description: "Kanban visual e calendário editorial para organizar todo o conteúdo.",
    features: ["Kanban drag-and-drop", "Calendário integrado", "Status customizáveis", "Filtros avançados"],
  },
  {
    icon: BarChart3,
    title: "Performance",
    description: "Analytics integrado de todas as redes sociais em um dashboard.",
    features: ["Métricas consolidadas", "Relatórios automáticos", "Insights com IA", "Comparativos"],
  },
  {
    icon: Users,
    title: "Colaboração",
    description: "Gerencie múltiplos clientes e convide membros do seu time.",
    features: ["3 clientes inclusos", "3 membros inclusos", "Permissões granulares", "Histórico"],
  },
];

export function ProShowcase() {
  return (
    <section className="py-24 md:py-32 bg-background relative">
      {/* Subtle background */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }} 
        />
      </div>
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Crown className="w-4 h-4" />
            kAI PRO
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
            Para quem vive
            <br />
            <span className="text-muted-foreground">da criação de conteúdo.</span>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Gerencie clientes, analise performance e publique em escala.
          </p>
        </motion.div>

        {/* Pillars */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-16">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                <pillar.icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              
              <h3 className="text-lg font-medium text-foreground mb-2">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground mb-5">{pillar.description}</p>
              
              <ul className="space-y-2">
                {pillar.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Testimonial */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto p-8 rounded-xl border border-border/50 bg-card/30 mb-12"
        >
          <p className="text-lg text-muted-foreground mb-6">
            "Economizamos 20h por semana na produção de conteúdo para nossos 12 clientes."
          </p>
          <footer className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
              M
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Marina Costa</p>
              <p className="text-xs text-muted-foreground">CEO, Agência Pulso Digital</p>
            </div>
          </footer>
        </motion.blockquote>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link to="/signup?plan=agency">
            <Button size="lg" className="h-12 px-8 rounded-full">
              <Crown className="mr-2 w-4 h-4" />
              Assinar PRO - $99.90/mês
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default ProShowcase;
