import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 md:py-32 bg-foreground dark:bg-card relative overflow-hidden">
      {/* Animated wave background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 w-full h-64 text-background/5"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <motion.path
            initial={{ d: "M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" }}
            animate={{
              d: [
                "M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,128L48,149.3C96,171,192,213,288,218.7C384,224,480,192,576,181.3C672,171,768,181,864,197.3C960,213,1056,235,1152,224C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                "M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              ],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent/20 blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Time saving message */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/10 border border-background/20">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-background dark:text-foreground">3h economizadas por dia</span>
            </div>
          </div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-background dark:text-foreground mb-4 leading-tight">
            Pare de perder horas{" "}
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
              criando conteúdo
            </span>
          </h2>

          <p className="text-xl md:text-2xl text-background/80 dark:text-muted-foreground mb-8 font-light max-w-2xl mx-auto">
            Comece a produzir <span className="text-background dark:text-foreground font-semibold">10x mais</span> em menos tempo. 
            Seu próximo mês de conteúdo pode começar agora.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
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
                Começar agora por $19.90/mês
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Trust message */}
          <p className="mt-6 text-sm text-background/60 dark:text-muted-foreground">
            Setup em 2 minutos • Cancele quando quiser
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
