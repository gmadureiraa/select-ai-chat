import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import InteractiveCanvasDemo from "./InteractiveCanvasDemo";

const NewHeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Grid pattern - very subtle */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                           linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            IA para criadores de conteúdo
          </span>
        </motion.div>

        {/* Headline - Large and impactful */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground mb-6 leading-[1.1]"
        >
          Crie conteúdo
          <br />
          <span className="text-muted-foreground">10x mais rápido</span>
        </motion.h1>

        {/* Subtitle - Muted and concise */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-light"
        >
          O kAI entende sua marca, gera textos e imagens, e publica nas redes.
          Tudo em um fluxo visual inteligente.
        </motion.p>

        {/* CTA - Single button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link to="/signup?plan=basic">
            <Button 
              size="lg" 
              className="h-12 px-6 text-base font-medium bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 rounded-lg group"
            >
              Começar agora
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Interactive Canvas Demo */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 w-full max-w-5xl mx-auto mt-16 px-6"
      >
        <div className="relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/5 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground">
                app.kaleidos.ai/canvas
              </div>
            </div>
          </div>
          
          {/* Real Interactive Canvas */}
          <div className="p-4">
            <InteractiveCanvasDemo />
          </div>
        </div>
        
        {/* Glow effect */}
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-3xl -z-10 opacity-30" />
      </motion.div>
    </section>
  );
};

export default NewHeroSection;
