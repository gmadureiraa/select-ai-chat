import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Sparkles, Zap, Star, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

// Micro testimonials for carousel
const testimonials = [
  { text: "Economizo 3h todo dia com o kAI", author: "@joaosilva" },
  { text: "Mudou completamente minha rotina de criação", author: "@mariaprod" },
  { text: "Minha agência dobrou a produção", author: "@agenciadigital" },
  { text: "Finalmente consigo postar todos os dias", author: "@carloscriador" },
];

// Countdown hook
const useCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 2, hours: 14, minutes: 32 });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, minutes } = prev;
        minutes--;
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
        if (hours < 0) {
          hours = 23;
          days--;
        }
        if (days < 0) {
          days = 2;
          hours = 14;
          minutes = 32;
        }
        return { days, hours, minutes };
      });
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);
  
  return timeLeft;
};

const CTASection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const countdown = useCountdown();

  // Rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-24 md:py-32 bg-foreground dark:bg-card relative overflow-hidden">
      {/* Subtle pattern background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Rotating testimonials */}
          <div className="h-8 mb-8 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-2 text-background/80 dark:text-muted-foreground"
              >
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm">"{testimonials[currentTestimonial].text}"</span>
                <span className="text-background/60 dark:text-muted-foreground/60 text-sm">
                  — {testimonials[currentTestimonial].author}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-background dark:text-foreground mb-4 leading-tight">
            Pare de perder horas
            <br />
            criando conteúdo
          </h2>

          <p className="text-xl md:text-2xl text-background/80 dark:text-muted-foreground mb-8 font-light max-w-2xl mx-auto">
            Seu próximo mês de conteúdo pode começar agora.
            <span className="text-background dark:text-foreground font-semibold"> 7 dias grátis</span> para testar.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <div className="flex items-center gap-2 text-background/70 dark:text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">3h economizadas por dia</span>
            </div>
            <div className="flex items-center gap-2 text-background/70 dark:text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">IA que entende você</span>
            </div>
            <div className="flex items-center gap-2 text-background/70 dark:text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span className="text-sm">Conteúdo em minutos</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup?plan=basic">
              <Button
                size="lg"
                className="h-14 px-10 text-lg rounded-full bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground shadow-xl group"
              >
                Começar grátis por 7 dias
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Countdown Timer - subtle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className="text-sm text-background/50 dark:text-muted-foreground">Oferta expira em:</span>
            {[
              { value: countdown.days.toString().padStart(2, '0'), label: "d" },
              { value: countdown.hours.toString().padStart(2, '0'), label: "h" },
              { value: countdown.minutes.toString().padStart(2, '0'), label: "m" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-0.5 text-background/70 dark:text-muted-foreground">
                <span className="text-lg font-mono font-medium">{item.value}</span>
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Guarantee */}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-background/60 dark:text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            <span>Garantia de 14 dias ou seu dinheiro de volta</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
