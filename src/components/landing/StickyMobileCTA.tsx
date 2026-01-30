import { motion, useScroll } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const StickyMobileCTA = () => {
  const [showSticky, setShowSticky] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      setShowSticky(latest > 600);
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background/90 backdrop-blur-lg border-t border-border md:hidden z-50"
      initial={{ y: 100 }}
      animate={{ y: showSticky ? 0 : 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Link to="/signup?plan=basic" className="block">
        <Button className="w-full h-11 text-sm font-medium" size="lg">
          Começar — $19.90/mês
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </Link>
    </motion.div>
  );
};

export default StickyMobileCTA;
