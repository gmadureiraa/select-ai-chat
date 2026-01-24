import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const StickyMobileCTA = () => {
  const [showSticky, setShowSticky] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      // Show after scrolling past hero section (approx 600px)
      setShowSticky(latest > 600);
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t border-border md:hidden z-50"
      initial={{ y: 100 }}
      animate={{ y: showSticky ? 0 : 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Link to="/signup?plan=basic" className="block">
        <Button className="w-full h-12 text-base bg-primary hover:bg-primary/90 shadow-lg" size="lg">
          <Sparkles className="mr-2 w-4 h-4" />
          Começar grátis por 7 dias
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </Link>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Sem cartão de crédito • Cancele quando quiser
      </p>
    </motion.div>
  );
};

export default StickyMobileCTA;
