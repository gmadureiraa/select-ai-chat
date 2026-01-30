import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  ArrowRight,
  Sparkles,
  Crown
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
  { name: "Planejamento Kanban", canvas: false, pro: true },
  { name: "Calendário editorial", canvas: false, pro: true },
  { name: "Performance Analytics", canvas: false, pro: true, highlight: true },
  { name: "Publicação automática", canvas: false, pro: true },
];

export function CanvasVsProSection() {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-muted/30 relative">
      {/* Subtle border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-border" />
      
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-4">
            Preços
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground tracking-tight">
            Escolha seu plano
          </h2>
          <p className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto">
            Comece com Canvas para criação solo. Escale para PRO quando precisar de time.
          </p>
        </motion.div>

        {/* Plans Grid - Linear style */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Canvas Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-xl p-6 hover:border-border/80 transition-colors"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Canvas</h3>
                <p className="text-sm text-muted-foreground">Para criadores solo</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-foreground">$19.90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="line-through">$29.90</span>
                <span className="ml-2 text-primary font-medium">33% off</span>
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              {features.filter(f => f.canvas).slice(0, 5).map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{feature.name}</span>
                  {typeof feature.canvas === 'string' && (
                    <span className="text-muted-foreground ml-auto">{feature.canvas}</span>
                  )}
                </li>
              ))}
            </ul>

            <Link to="/signup?plan=basic" className="block">
              <Button className="w-full h-11" variant="outline">
                Começar com Canvas
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-card border-2 border-primary rounded-xl p-6 relative"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                Popular
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">kAI PRO</h3>
                <p className="text-sm text-muted-foreground">Para agências e times</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-foreground">$99.90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="line-through">$149.90</span>
                <span className="ml-2 text-primary font-medium">33% off</span>
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                Tudo do Canvas, mais:
              </li>
              {features.filter(f => !f.canvas || f.highlight).slice(0, 6).map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">{feature.name}</span>
                  {typeof feature.pro === 'string' && (
                    <span className="text-muted-foreground ml-auto text-xs">{feature.pro}</span>
                  )}
                </li>
              ))}
            </ul>

            <Link to="/signup?plan=agency" className="block">
              <Button className="w-full h-11">
                Começar com PRO
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Comparison table toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground">
            Garantia de 14 dias • Cancele quando quiser •{" "}
            <a
              href="https://api.whatsapp.com/send/?phone=12936180547&text=Olá! Gostaria de saber mais sobre o plano Enterprise do kAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              Fale sobre Enterprise →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default CanvasVsProSection;
