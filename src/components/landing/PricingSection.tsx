import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Gostaria+de+saber+mais+sobre+o+plano+Enterprise.&type=phone_number&app_absent=0";

const plans = [
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    description: "Para criadores e pequenas equipes",
    features: [
      "5 clientes",
      "3 membros",
      "10.000 tokens/mês",
      "Acesso a todos os modelos IA",
      "Biblioteca completa",
      "Performance analytics",
      "Suporte prioritário",
    ],
    cta: "Começar 14 dias grátis",
    popular: false,
    planType: "starter",
  },
  {
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    description: "Para agências e empresas",
    features: [
      "20 clientes",
      "10 membros",
      "50.000 tokens/mês",
      "Tudo do Starter",
      "Integrações avançadas",
      "API completa",
      "Gerente de sucesso dedicado",
    ],
    cta: "Começar 14 dias grátis",
    popular: true,
    planType: "pro",
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Soluções sob medida para grandes operações",
    features: [
      "Clientes ilimitados",
      "Membros ilimitados",
      "Tokens ilimitados",
      "Infraestrutura dedicada",
      "SLA garantido",
      "Treinamento personalizado",
      "Integrações customizadas",
      "Suporte 24/7",
    ],
    cta: "Falar com Vendas",
    popular: false,
    planType: "enterprise",
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-32 bg-muted/30 relative overflow-hidden">
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
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">14 dias grátis em todos os planos</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            Planos que{" "}
            <span className="italic text-muted-foreground">escalam</span> com você
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-xl mx-auto">
            Teste grátis por 14 dias. Sem compromisso, cancele quando quiser.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? "bg-primary text-primary-foreground border-2 border-primary"
                  : "bg-card border border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-xl font-semibold mb-2 ${plan.popular ? "" : "text-foreground"}`}>
                  {plan.name}
                </h3>
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
                  </Button>
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        {/* FAQ teaser */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-16"
        >
          <p className="text-muted-foreground">
            Tem dúvidas?{" "}
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Fale conosco
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
