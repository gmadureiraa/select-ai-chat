import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -right-40 -bottom-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(330, 85%, 55%) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute -left-20 bottom-20 w-[400px] h-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(145, 80%, 42%) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
          >
            <Sparkles className="w-4 h-4 text-[hsl(330,85%,55%)]" />
            <span className="text-sm text-white/80">
              Nova Era do Conteúdo com IA
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-light text-white leading-tight mb-6"
          >
            Liberte o Poder da{" "}
            <span className="font-semibold bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] bg-clip-text text-transparent">
              IA
            </span>{" "}
            para seu{" "}
            <span className="italic font-light">Conteúdo</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Nossa plataforma inteligente automatiza, analisa e acelera a criação
            de conteúdo para que você foque no que realmente importa.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[hsl(330,85%,55%)] to-[hsl(25,95%,55%)] hover:opacity-90 text-white border-0 px-8 py-6 text-lg group"
              >
                Agendar Demo
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 px-8 py-6 text-lg"
              >
                Saiba mais
              </Button>
            </a>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          animate={{
            y: [0, -20, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 right-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(330,85%,55%)]/20 to-transparent border border-white/10 backdrop-blur-sm hidden lg:block"
        />
        <motion.div
          animate={{
            y: [0, 15, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-1/4 left-10 w-16 h-16 rounded-xl bg-gradient-to-br from-[hsl(145,80%,42%)]/20 to-transparent border border-white/10 backdrop-blur-sm hidden lg:block"
        />
      </div>
    </section>
  );
};

export default HeroSection;
