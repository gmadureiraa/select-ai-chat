import { motion } from "framer-motion";

const logos = [
  { name: "Startup A", initials: "SA" },
  { name: "Digital Co", initials: "DC" },
  { name: "Tech Labs", initials: "TL" },
  { name: "Media Pro", initials: "MP" },
  { name: "Brand X", initials: "BX" },
  { name: "Creative Inc", initials: "CI" },
  { name: "Growth Co", initials: "GC" },
  { name: "Agência Y", initials: "AY" },
];

export function SocialProofMarquee() {
  return (
    <section className="py-12 border-y border-border/30 bg-muted/20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Usado por criadores e agências que levam conteúdo a sério
        </p>
        
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          
          {/* Marquee */}
          <div className="flex overflow-hidden">
            <motion.div
              className="flex gap-12 items-center"
              animate={{ x: [0, -50 * logos.length * 2] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 30,
                  ease: "linear",
                },
              }}
            >
              {/* Double the logos for seamless loop */}
              {[...logos, ...logos, ...logos, ...logos].map((logo, i) => (
                <div
                  key={`${logo.name}-${i}`}
                  className="flex items-center gap-3 flex-shrink-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted border border-border/50 flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {logo.initials}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {logo.name}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SocialProofMarquee;
