import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  X, 
  Sparkles, 
  Crown,
  ArrowRight,
  Users,
  Briefcase,
  BarChart3,
  Calendar,
  Share2,
  Palette
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PlanFeature {
  name: string;
  canvas: boolean | string;
  pro: boolean | string;
  highlight?: boolean;
}

const features: PlanFeature[] = [
  { name: "Canvas visual de criação", canvas: true, pro: true },
  { name: "IA Multi-agente", canvas: true, pro: true },
  { name: "Geração de imagens", canvas: true, pro: true },
  { name: "Templates prontos", canvas: true, pro: true },
  { name: "Perfis de cliente", canvas: "1", pro: "3 (+$7/extra)", highlight: true },
  { name: "Membros do time", canvas: false, pro: "3 (+$4/extra)", highlight: true },
  { name: "Planejamento Kanban", canvas: false, pro: true, highlight: true },
  { name: "Calendário editorial", canvas: false, pro: true },
  { name: "Performance Analytics", canvas: false, pro: true, highlight: true },
  { name: "Publicação automática", canvas: false, pro: true },
  { name: "Integrações sociais", canvas: false, pro: true },
  { name: "API access", canvas: false, pro: true },
];

const canvasHighlights = [
  { icon: Palette, label: "Canvas ilimitado" },
  { icon: Sparkles, label: "IA avançada" },
  { icon: Briefcase, label: "1 perfil incluso" },
];

const proHighlights = [
  { icon: Users, label: "Time colaborativo" },
  { icon: Calendar, label: "Planejamento" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Share2, label: "Publicação" },
];

export function CanvasVsProSection() {
  return (
    <section id="pricing" className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Planos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Escolha seu plano
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece com Canvas para criação solo. Escale para PRO quando precisar de time e analytics.
          </p>
        </motion.div>

        {/* Plans Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Canvas Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-background" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Canvas</h3>
                <p className="text-sm text-muted-foreground">Para criadores solo</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$19.90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {canvasHighlights.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm"
                >
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-foreground">{item.label}</span>
                </div>
              ))}
            </div>

            <Link to="/signup?plan=basic" className="block">
              <Button className="w-full" size="lg">
                Começar com Canvas
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card border-2 border-primary rounded-2xl p-6 relative hover:shadow-xl transition-shadow"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                <Crown className="w-3 h-3" />
                Mais popular
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">kAI PRO</h3>
                <p className="text-sm text-muted-foreground">Para agências e times</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$99.90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {proHighlights.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm"
                >
                  <item.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-foreground font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            <Link to="/signup?plan=agency" className="block">
              <Button className="w-full bg-primary hover:bg-primary/90" size="lg">
                Upgrade para PRO
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Feature Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 border-b border-border">
            <div className="text-sm font-medium text-muted-foreground">Recurso</div>
            <div className="text-center text-sm font-medium text-foreground">Canvas</div>
            <div className="text-center text-sm font-medium text-primary">kAI PRO</div>
          </div>
          
          <div className="divide-y divide-border">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + index * 0.03 }}
                className={cn(
                  "grid grid-cols-3 gap-4 p-4",
                  feature.highlight && "bg-primary/5"
                )}
              >
                <div className="text-sm text-foreground">
                  {feature.name}
                  {feature.highlight && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      PRO
                    </span>
                  )}
                </div>
                <div className="flex justify-center">
                  {typeof feature.canvas === "boolean" ? (
                    feature.canvas ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/30" />
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">{feature.canvas}</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {typeof feature.pro === "boolean" ? (
                    feature.pro ? (
                      <Check className="w-5 h-5 text-primary" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/30" />
                    )
                  ) : (
                    <span className="text-sm font-medium text-primary">{feature.pro}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-muted-foreground text-sm">
            Precisa de mais perfis ou recursos enterprise?{" "}
            <a
              href="https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o plano Enterprise do kAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Fale com vendas →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default CanvasVsProSection;
