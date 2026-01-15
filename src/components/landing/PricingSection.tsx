import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, LayoutDashboard, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Gostaria+de+saber+mais+sobre+o+plano+Enterprise.&type=phone_number&app_absent=0";

const plans = [
  {
    name: "Canvas",
    price: "$19.90",
    period: "/mês",
    description: "O essencial para criar conteúdo com IA",
    icon: LayoutDashboard,
    features: [
      "1 cliente/perfil",
      "Canvas de criação ilimitado",
      "IA multi-agente especialista",
      "Templates para todos formatos",
      "Geração de imagens",
      "Suporte via email",
    ],
    cta: "Assinar agora",
    popular: false,
    planType: "basic",
    highlight: "Ideal para criadores solo",
  },
  {
    name: "Pro",
    price: "$99.90",
    period: "/mês",
    description: "Suite completa para agências",
    icon: BarChart3,
    features: [
      "Tudo do Canvas",
      "3 clientes inclusos (+$7/extra)",
      "3 membros do time (+$4/extra)",
      "Visualizadores ilimitados",
      "Planejamento Kanban",
      "Performance analytics",
      "Biblioteca de conteúdos",
      "Publicação agendada",
      "Integrações (Instagram, LinkedIn, Twitter/X, YouTube)",
      "Suporte prioritário",
    ],
    cta: "Assinar agora",
    popular: true,
    planType: "agency",
    highlight: "Mais popular",
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Soluções sob medida",
    icon: Sparkles,
    features: [
      "Clientes ilimitados",
      "Membros ilimitados",
      "White label",
      "API completa",
      "SLA garantido",
      "Treinamento dedicado",
      "Gerente de conta",
    ],
    cta: "Falar com vendas",
    popular: false,
    planType: "enterprise",
    highlight: "Para grandes times",
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Preços simples, valor real
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Comece pelo Canvas a $19.90/mês ou desbloqueie a suite completa por $99.90/mês.
            <br />
            <span className="text-foreground font-medium">Sem surpresas, cancele quando quiser.</span>
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-2xl p-6 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground scale-105 shadow-2xl"
                    : "bg-card border border-border"
                }`}
              >
                {/* Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    plan.popular 
                      ? "bg-secondary text-secondary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {plan.highlight}
                  </span>
                </div>

                <div className="mb-6 pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg ${plan.popular ? "bg-primary-foreground/10" : "bg-primary/10"}`}>
                      <Icon className={`w-5 h-5 ${plan.popular ? "text-primary-foreground" : "text-primary"}`} />
                    </div>
                    <h3 className={`text-xl font-semibold ${plan.popular ? "" : "text-foreground"}`}>
                      {plan.name}
                    </h3>
                  </div>
                  <p className={`text-sm mb-4 ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.popular ? "" : "text-primary"}`} />
                      <span className={`text-sm ${plan.popular ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.planType === "enterprise" ? (
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                    <Button
                      className="w-full"
                      variant="outline"
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </a>
                ) : (
                  <Link to={`/signup?plan=${plan.planType}`}>
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-background text-foreground hover:bg-background/90"
                          : ""
                      }`}
                      variant={plan.popular ? "secondary" : "default"}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Comparison highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-muted/50 border border-border">
            <div className="text-center sm:text-left">
              <p className="font-medium text-foreground mb-1">
                Não sabe qual escolher?
              </p>
              <p className="text-sm text-muted-foreground">
                Comece com o Canvas. Faça upgrade quando precisar de mais clientes ou analytics.
              </p>
            </div>
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                Fale conosco
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
