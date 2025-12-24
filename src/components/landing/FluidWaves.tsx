import { motion } from "framer-motion";

interface FluidWavesProps {
  className?: string;
  variant?: "hero" | "purple" | "gold";
}

const FluidWaves = ({ className = "", variant = "hero" }: FluidWavesProps) => {
  const gradients = {
    hero: {
      colors: ["#E11D9B", "#7C3AED", "#F59E0B", "#E11D9B"],
      id: "heroGradient",
    },
    purple: {
      colors: ["#7C3AED", "#E11D9B", "#A855F7", "#7C3AED"],
      id: "purpleGradient",
    },
    gold: {
      colors: ["#F59E0B", "#E11D9B", "#7C3AED", "#F59E0B"],
      id: "goldGradient",
    },
  };

  const { colors, id } = gradients[variant];

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`${id}1`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0.8" />
            <stop offset="50%" stopColor={colors[1]} stopOpacity="0.6" />
            <stop offset="100%" stopColor={colors[2]} stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={`${id}2`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors[1]} stopOpacity="0.7" />
            <stop offset="50%" stopColor={colors[2]} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors[0]} stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={`${id}3`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={colors[2]} stopOpacity="0.6" />
            <stop offset="50%" stopColor={colors[0]} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors[1]} stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="20" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wave 1 - Back layer */}
        <motion.path
          fill={`url(#${id}1)`}
          filter="url(#glow)"
          initial={{ d: "M0,300 Q200,200 400,300 T800,300 L800,600 L0,600 Z" }}
          animate={{
            d: [
              "M0,300 Q200,200 400,300 T800,300 L800,600 L0,600 Z",
              "M0,350 Q200,250 400,350 T800,280 L800,600 L0,600 Z",
              "M0,280 Q200,350 400,280 T800,350 L800,600 L0,600 Z",
              "M0,300 Q200,200 400,300 T800,300 L800,600 L0,600 Z",
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Wave 2 - Middle layer */}
        <motion.path
          fill={`url(#${id}2)`}
          filter="url(#glow)"
          initial={{ d: "M0,350 Q150,280 350,350 T750,320 L800,600 L0,600 Z" }}
          animate={{
            d: [
              "M0,350 Q150,280 350,350 T750,320 L800,600 L0,600 Z",
              "M0,320 Q150,380 350,320 T750,380 L800,600 L0,600 Z",
              "M0,380 Q150,300 350,380 T750,300 L800,600 L0,600 Z",
              "M0,350 Q150,280 350,350 T750,320 L800,600 L0,600 Z",
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />

        {/* Wave 3 - Front layer */}
        <motion.path
          fill={`url(#${id}3)`}
          filter="url(#glow)"
          initial={{ d: "M0,400 Q100,350 300,400 T600,380 L800,600 L0,600 Z" }}
          animate={{
            d: [
              "M0,400 Q100,350 300,400 T600,380 L800,600 L0,600 Z",
              "M0,380 Q100,420 300,380 T600,420 L800,600 L0,600 Z",
              "M0,420 Q100,360 300,420 T600,360 L800,600 L0,600 Z",
              "M0,400 Q100,350 300,400 T600,380 L800,600 L0,600 Z",
            ],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />

        {/* Floating orbs */}
        <motion.circle
          cx="600"
          cy="200"
          r="80"
          fill={`url(#${id}1)`}
          filter="url(#glow)"
          animate={{
            cx: [600, 650, 580, 600],
            cy: [200, 250, 180, 200],
            r: [80, 90, 75, 80],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.circle
          cx="200"
          cy="150"
          r="50"
          fill={`url(#${id}2)`}
          filter="url(#glow)"
          animate={{
            cx: [200, 180, 220, 200],
            cy: [150, 180, 130, 150],
            r: [50, 55, 45, 50],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        <motion.circle
          cx="700"
          cy="400"
          r="60"
          fill={`url(#${id}3)`}
          filter="url(#glow)"
          animate={{
            cx: [700, 720, 680, 700],
            cy: [400, 380, 420, 400],
            r: [60, 70, 55, 60],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
        />
      </svg>
    </div>
  );
};

export default FluidWaves;
