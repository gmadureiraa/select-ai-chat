import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Gradient blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">Comece gratuitamente</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-light text-foreground mb-6 leading-tight">
            Pronto para{" "}
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
              escalar
            </span>{" "}
            sua produção?
          </h2>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Junte-se a mais de 50 agências que já estão gerenciando clientes e 
            criando conteúdo de forma mais inteligente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90 px-10 py-7 text-lg rounded-full group"
              >
                Criar Minha Conta
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a 
              href="https://wa.me/5511999999999?text=Olá! Gostaria de agendar uma demonstração do KAI."
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-7 text-lg rounded-full border-border hover:bg-muted"
              >
                Agendar Demo
              </Button>
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-12 text-muted-foreground text-sm flex-wrap">
            <span>✓ Sem cartão de crédito</span>
            <span>✓ Acesso completo por 14 dias</span>
            <span>✓ Convide seu time</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
