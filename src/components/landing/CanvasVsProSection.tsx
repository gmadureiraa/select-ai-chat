import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Palette,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { addDays, format } from "date-fns";

// Social network icons as SVG components
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

interface PlanFeature {
  name: string;
  canvas: boolean | string;
  pro: boolean | string;
  highlight?: boolean;
  showSocialIcons?: boolean;
  isBasic?: boolean;
}

const features: PlanFeature[] = [
  { name: "Canvas visual de criação", canvas: true, pro: true, isBasic: true },
  { name: "IA Multi-agente", canvas: true, pro: true, isBasic: true },
  { name: "Geração de imagens", canvas: true, pro: true, isBasic: true },
  { name: "Templates prontos", canvas: true, pro: true, isBasic: true },
  { name: "Perfis de cliente", canvas: "1", pro: "3 (+$7/extra)", highlight: true, isBasic: true },
  { name: "Membros do time", canvas: false, pro: "3 (+$4/extra)", highlight: true },
  { name: "Planejamento Kanban", canvas: false, pro: true, highlight: true },
  { name: "Calendário editorial", canvas: false, pro: true },
  { name: "Performance Analytics", canvas: false, pro: true, highlight: true },
  { name: "Publicação automática", canvas: false, pro: true, showSocialIcons: true },
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
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  
  const basicFeatures = features.filter(f => f.isBasic);
  const advancedFeatures = features.filter(f => !f.isBasic);
  const displayedFeatures = showAllFeatures ? features : basicFeatures;

  return (
    <section id="pricing" className="py-28 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Urgency Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <Badge variant="destructive" className="animate-pulse px-4 py-2">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Oferta válida até {format(addDays(new Date(), 3), "dd/MM")}
          </Badge>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 text-primary text-sm font-medium mb-5">
            Planos
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5">
            Escolha seu plano
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
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
            className="bg-gradient-to-br from-card to-card/80 border border-border rounded-2xl p-7 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-background" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">Canvas</h3>
                <p className="text-sm text-muted-foreground">Para criadores solo</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-lg text-muted-foreground line-through mr-2">$29.90</span>
              <span className="text-5xl font-bold text-foreground">$19.90</span>
              <span className="text-muted-foreground text-lg">/mês</span>
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
              <Button className="w-full h-12 text-base" size="lg">
                Começar grátis por 7 dias
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>

            {/* Guarantee */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Garantia de 14 dias</span>
            </div>
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-card to-card/80 border-2 border-primary rounded-2xl p-7 relative hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300"
          >
            {/* Popular badge - Animated */}
            <motion.div 
              className="absolute -top-3.5 left-1/2 -translate-x-1/2"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-purple-500 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/30">
                <Sparkles className="w-3.5 h-3.5" />
                Mais popular
              </span>
            </motion.div>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">kAI PRO</h3>
                <p className="text-sm text-muted-foreground">Para agências e times</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-lg text-muted-foreground line-through mr-2">$149.90</span>
              <span className="text-5xl font-bold text-foreground">$99.90</span>
              <span className="text-muted-foreground text-lg">/mês</span>
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
              <Button className="w-full h-12 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" size="lg">
                Começar grátis por 7 dias
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>

            {/* Guarantee */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Garantia de 14 dias</span>
            </div>
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
          <div className="grid grid-cols-3 gap-4 p-5 bg-muted/50 border-b border-border">
            <div className="text-sm font-semibold text-muted-foreground">Recurso</div>
            <div className="text-center text-sm font-semibold text-foreground">Canvas</div>
            <div className="text-center text-sm font-semibold text-primary">kAI PRO</div>
          </div>
          
          <div className="divide-y divide-border">
            <AnimatePresence mode="sync">
              {displayedFeatures.map((feature, index) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className={cn(
                    "grid grid-cols-3 gap-4 p-4",
                    feature.highlight && "bg-primary/5"
                  )}
                >
                  <div className="text-sm text-foreground flex items-center gap-2">
                    {feature.name}
                    {feature.highlight && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                        PRO
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center items-center">
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
                  <div className="flex justify-center items-center gap-2">
                    {feature.showSocialIcons ? (
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 rounded bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                          <InstagramIcon />
                        </div>
                        <div className="p-1 rounded bg-foreground text-background">
                          <TwitterIcon />
                        </div>
                        <div className="p-1 rounded bg-blue-600 text-white">
                          <LinkedInIcon />
                        </div>
                        <div className="p-1 rounded bg-blue-500 text-white">
                          <FacebookIcon />
                        </div>
                        <div className="p-1 rounded bg-foreground text-background">
                          <TikTokIcon />
                        </div>
                      </div>
                    ) : typeof feature.pro === "boolean" ? (
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
            </AnimatePresence>
          </div>

          {/* Expand/Collapse Button */}
          <div className="p-4 border-t border-border bg-muted/30">
            <button
              onClick={() => setShowAllFeatures(!showAllFeatures)}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {showAllFeatures ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver todos recursos ({advancedFeatures.length} mais)
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-10"
        >
        <p className="text-muted-foreground text-sm">
          Precisa de mais perfis ou recursos enterprise?{" "}
          <a
            href="https://api.whatsapp.com/send/?phone=12936180547&text=Olá! Gostaria de saber mais sobre o plano Enterprise do kAI"
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
