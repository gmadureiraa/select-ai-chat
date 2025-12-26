import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
}

const AnimatedNumber = ({ value, suffix = "", prefix = "" }: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isInView]);

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, value, {
        duration: 2,
        ease: "easeOut",
        onUpdate: (v) => setDisplayValue(Math.round(v)),
      });
      return () => controls.stop();
    }
  }, [isInView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

const stats = [
  {
    value: 50,
    suffix: "+",
    label: "Agências utilizando",
    description: "Times de conteúdo confiam no KAI",
  },
  {
    value: 500,
    suffix: "+",
    label: "Clientes gerenciados",
    description: "Organizados em uma plataforma",
  },
  {
    value: 10000,
    suffix: "+",
    label: "Conteúdos criados/mês",
    description: "Posts, newsletters, vídeos e mais",
  },
];

const StatsSection = () => {
  return (
    <section className="py-24 bg-muted/30 dark:bg-muted/10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-muted-foreground">
            Times que{" "}
            <span className="text-foreground font-medium">escalam juntos</span>
          </h2>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="rounded-3xl border border-border p-8 text-center bg-card hover:border-primary/30 hover:shadow-lg transition-all">
                <div className="text-5xl md:text-6xl font-light bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent mb-4">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {stat.label}
                </h3>
                <p className="text-muted-foreground text-sm">{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
