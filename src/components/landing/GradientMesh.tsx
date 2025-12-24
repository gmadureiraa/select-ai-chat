import { motion } from "framer-motion";

interface GradientMeshProps {
  className?: string;
  variant?: "hero" | "section" | "cta";
}

const GradientMesh = ({ className = "", variant = "hero" }: GradientMeshProps) => {
  const variants = {
    hero: {
      orbs: [
        {
          color: "from-pink-500/40 via-rose-500/30 to-transparent",
          size: "w-[600px] h-[600px] md:w-[800px] md:h-[800px]",
          position: "top-0 right-0 translate-x-1/4 -translate-y-1/4",
          animation: { scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, -20, 0] },
          duration: 12,
        },
        {
          color: "from-violet-500/30 via-purple-500/20 to-transparent",
          size: "w-[500px] h-[500px] md:w-[700px] md:h-[700px]",
          position: "top-1/4 right-1/4",
          animation: { scale: [1, 0.95, 1], x: [0, -20, 0], y: [0, 30, 0] },
          duration: 15,
          delay: 2,
        },
        {
          color: "from-emerald-500/20 via-green-500/10 to-transparent",
          size: "w-[400px] h-[400px] md:w-[500px] md:h-[500px]",
          position: "bottom-1/4 right-1/3",
          animation: { scale: [1, 1.05, 1], x: [0, 15, 0], y: [0, -15, 0] },
          duration: 10,
          delay: 4,
        },
      ],
    },
    section: {
      orbs: [
        {
          color: "from-pink-500/20 via-rose-500/10 to-transparent",
          size: "w-[400px] h-[400px]",
          position: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          animation: { scale: [1, 1.1, 1] },
          duration: 8,
        },
      ],
    },
    cta: {
      orbs: [
        {
          color: "from-pink-500/30 via-rose-500/20 to-transparent",
          size: "w-[500px] h-[500px]",
          position: "top-0 left-1/4 -translate-y-1/2",
          animation: { scale: [1, 1.15, 1], x: [0, 20, 0] },
          duration: 10,
        },
        {
          color: "from-emerald-500/25 via-green-500/15 to-transparent",
          size: "w-[400px] h-[400px]",
          position: "bottom-0 right-1/4 translate-y-1/2",
          animation: { scale: [1, 0.9, 1], x: [0, -15, 0] },
          duration: 12,
          delay: 3,
        },
      ],
    },
  };

  const { orbs } = variants[variant];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute ${orb.position} ${orb.size} rounded-full bg-gradient-radial ${orb.color} blur-[80px] md:blur-[120px]`}
          animate={orb.animation}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay || 0,
          }}
        />
      ))}
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default GradientMesh;
