import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import GradientMesh from "./GradientMesh";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Gradient Mesh Animation */}
      <GradientMesh variant="hero" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm"
          >
            <Building2 className="w-4 h-4 text-[hsl(330,85%,55%)]" />
            <span className="text-sm text-white/80">
              Para Agências e Times de Conteúdo
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-light text-white leading-[1.1] mb-8"
          >
            A plataforma que seu{" "}
            <span className="font-semibold bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent">
              time
            </span>{" "}
            precisa para criar{" "}
            <span className="italic font-light text-white/90">conteúdo em escala</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/50 max-w-xl mb-12 leading-relaxed font-light"
          >
            Centralize clientes, organize briefings, automatize entregas e dê acesso 
            ao seu time e clientes. Tudo em um só lugar.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            <Link to="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] hover:opacity-90 text-white border-0 px-8 py-6 text-base font-medium group rounded-full"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/5 px-8 py-6 text-base font-light rounded-full"
              >
                Ver Funcionalidades
              </Button>
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 pt-8 border-t border-white/10"
          >
            <p className="text-white/30 text-sm mb-4">Usado por times de conteúdo em</p>
            <div className="flex items-center gap-8 text-white/40">
              <span className="text-lg font-light">Agências</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-lg font-light">Produtoras</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-lg font-light">Startups</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating decorative elements */}
      <motion.div
        animate={{
          y: [0, -15, 0],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 left-[15%] w-2 h-2 rounded-full bg-[hsl(330,85%,55%)] blur-[1px] hidden lg:block"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute bottom-1/3 left-[10%] w-1.5 h-1.5 rounded-full bg-[hsl(145,80%,50%)] blur-[1px] hidden lg:block"
      />
    </section>
  );
};

export default HeroSection;
