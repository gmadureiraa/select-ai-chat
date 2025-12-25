import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Bot, Check, Sparkles, FileText, Palette, CheckCircle2 } from "lucide-react";

const agentSteps = [
  {
    name: "Agente de Análise",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
    task: "Analisando briefing e contexto do cliente...",
    result: "Tom de voz identificado: profissional e descontraído",
  },
  {
    name: "Agente de Criação",
    icon: Palette,
    color: "from-secondary to-accent",
    task: "Gerando conteúdo personalizado...",
    result: "Rascunho criado com 3 variações",
  },
  {
    name: "Agente de Revisão",
    icon: CheckCircle2,
    color: "from-emerald-500 to-teal-500",
    task: "Refinando linguagem e aplicando guidelines...",
    result: "Conteúdo pronto para publicar!",
  },
];

const TypewriterText = ({ text, delay = 0, onComplete }: { text: string; delay?: number; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let charIndex = 0;

    const startTyping = () => {
      if (charIndex < text.length) {
        timeout = setTimeout(() => {
          setDisplayedText(text.slice(0, charIndex + 1));
          charIndex++;
          startTyping();
        }, 30);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    const delayTimeout = setTimeout(startTyping, delay);

    return () => {
      clearTimeout(timeout);
      clearTimeout(delayTimeout);
    };
  }, [text, delay, onComplete]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
};

const AgentFlowSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (isInView && activeStep === -1) {
      setActiveStep(0);
    }
  }, [isInView, activeStep]);

  useEffect(() => {
    if (activeStep >= 0 && activeStep < agentSteps.length) {
      const timer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, activeStep]);
        if (activeStep < agentSteps.length - 1) {
          setTimeout(() => setActiveStep(activeStep + 1), 500);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeStep]);

  return (
    <section id="agent-flow" className="py-32 bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">IA Especializada</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-light text-foreground mb-6 leading-tight">
              Como nosso{" "}
              <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-medium">
                Assistente IA
              </span>
              <br />
              funciona
            </h2>

            <p className="text-muted-foreground text-lg mb-8 max-w-md">
              Cada formato de conteúdo passa por um conjunto de agentes especializados, 
              garantindo qualidade e mantendo a linguagem única de cada cliente.
            </p>

            <div className="space-y-6">
              {agentSteps.map((step, index) => (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                    completedSteps.includes(index)
                      ? "bg-primary/5 border border-primary/20"
                      : activeStep === index
                      ? "bg-muted/50 border border-border"
                      : "opacity-50"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} p-0.5`}>
                    <div className="w-full h-full rounded-[10px] bg-background flex items-center justify-center">
                      {completedSteps.includes(index) ? (
                        <Check className="w-5 h-5 text-primary" />
                      ) : (
                        <step.icon className="w-5 h-5 text-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">{step.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {completedSteps.includes(index) ? step.result : step.task}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right side - Terminal Animation */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Terminal window */}
            <div className="bg-[#1a1b26] rounded-2xl overflow-hidden border border-[#2d2e3d] shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#24253a] border-b border-[#2d2e3d]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[#6b7280] text-sm ml-2 font-mono">kai-agent-pipeline</span>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm space-y-4 min-h-[400px]">
                {isInView && (
                  <>
                    <div className="text-[#7aa2f7]">
                      <TypewriterText text="$ kai run content-pipeline --client=defiverso" delay={0} />
                    </div>

                    {activeStep >= 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                        <div className="text-[#9ece6a]">
                          <span className="text-[#bb9af7]">→</span> Iniciando pipeline de conteúdo...
                        </div>

                        {agentSteps.map((step, index) => (
                          activeStep >= index && (
                            <motion.div
                              key={step.name}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                              className="space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`${
                                  completedSteps.includes(index) 
                                    ? "text-[#9ece6a]" 
                                    : activeStep === index 
                                    ? "text-[#7aa2f7] animate-pulse" 
                                    : "text-[#565f89]"
                                }`}>
                                  {completedSteps.includes(index) ? "✓" : activeStep === index ? "●" : "○"}
                                </span>
                                <span className="text-[#c0caf5]">{step.name}</span>
                              </div>
                              {activeStep === index && !completedSteps.includes(index) && (
                                <div className="pl-6 text-[#565f89]">
                                  <TypewriterText text={step.task} delay={100} />
                                </div>
                              )}
                              {completedSteps.includes(index) && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="pl-6 text-[#9ece6a]"
                                >
                                  {step.result}
                                </motion.div>
                              )}
                            </motion.div>
                          )
                        ))}

                        {completedSteps.length === agentSteps.length && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="pt-4 border-t border-[#2d2e3d]"
                          >
                            <div className="text-[#9ece6a] flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              Pipeline concluído com sucesso!
                            </div>
                            <div className="text-[#565f89] mt-2">
                              Tempo total: 2.3s | Tokens usados: 1,247
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-secondary/20 to-transparent rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AgentFlowSection;
