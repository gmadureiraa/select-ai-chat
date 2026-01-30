import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 md:py-32 bg-foreground dark:bg-card relative overflow-hidden">
      {/* Subtle pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-background dark:text-foreground mb-4 tracking-tight leading-tight">
            Pare de perder horas
            <br />
            criando conteúdo
          </h2>

          <p className="text-lg md:text-xl text-background/70 dark:text-muted-foreground mb-10 max-w-xl mx-auto">
            Seu próximo mês de conteúdo pode começar agora.
          </p>

          <Link to="/signup?plan=basic">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-medium rounded-lg bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground group"
            >
              Começar agora
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>

          <p className="text-sm text-background/50 dark:text-muted-foreground mt-6">
            Garantia de 14 dias • Cancele quando quiser
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
