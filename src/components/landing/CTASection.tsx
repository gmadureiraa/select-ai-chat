import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import GradientMesh from "./GradientMesh";

const CTASection = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Gradient Mesh Background */}
      <GradientMesh variant="cta" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <Building2 className="w-4 h-4 text-[hsl(145,80%,50%)]" />
            <span className="text-sm text-white/80">Comece gratuitamente</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-light text-white mb-6 leading-tight">
            Pronto para{" "}
            <span className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent font-medium">
              escalar
            </span>{" "}
            sua produção?
          </h2>

          <p className="text-lg md:text-xl text-white/50 mb-10 max-w-2xl mx-auto">
            Junte-se a mais de 50 agências que já estão gerenciando clientes e 
            criando conteúdo de forma mais inteligente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] hover:opacity-90 text-white border-0 px-10 py-7 text-lg group"
              >
                Criar Minha Conta
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10 px-8 py-7 text-lg"
            >
              Agendar Demo
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-12 text-white/30 text-sm flex-wrap">
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
