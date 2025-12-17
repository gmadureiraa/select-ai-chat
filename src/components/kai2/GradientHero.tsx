import { useState } from "react";
import { Send, Sparkles, Image, FileText, Video, Mail, Paperclip, Layers, BarChart3, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ContentTypeChip {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const contentTypes: ContentTypeChip[] = [
  { id: "text", label: "Tweet/Thread", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "carousel", label: "Carrossel", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "video", label: "Roteiro", icon: <Video className="h-3.5 w-3.5" /> },
  { id: "newsletter", label: "Newsletter", icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "image", label: "Imagem", icon: <Image className="h-3.5 w-3.5" /> },
];

interface GradientHeroProps {
  onSubmit: (message: string, contentType?: string) => void;
  onQuickAction?: (action: string) => void;
  clientName?: string;
}

export function GradientHero({ onSubmit, onQuickAction, clientName }: GradientHeroProps) {
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit(input, selectedType || undefined);
    setInput("");
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-8">
      {/* Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 100%, hsl(330, 100%, 35%) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 70% 90%, hsl(30, 100%, 45%) 0%, transparent 40%),
              radial-gradient(ellipse 50% 30% at 30% 95%, hsl(280, 80%, 40%) 0%, transparent 35%),
              hsl(0, 0%, 4%)
            `
          }}
        />
        {/* Noise overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Tagline */}
        <h1 className="text-4xl md:text-5xl font-light text-center text-white mb-3 tracking-tight">
          O que vamos <span className="font-semibold text-primary">criar</span> hoje?
        </h1>
        
        {clientName && (
          <p className="text-center text-white/50 mb-8 text-lg">
            Trabalhando com <span className="text-white/70 font-medium">{clientName}</span>
          </p>
        )}

        {!clientName && (
          <p className="text-center text-white/40 mb-8">
            Seu assistente de conteúdo inteligente
          </p>
        )}

        {/* Content Type Pills */}
        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
          {contentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                "border backdrop-blur-sm",
                selectedType === type.id
                  ? "bg-white/15 border-white/30 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}
            >
              {type.icon}
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Input Container - Glassmorphism */}
        <div className="relative">
          <div 
            className={cn(
              "relative rounded-2xl overflow-hidden",
              "bg-white/[0.08] backdrop-blur-xl",
              "border border-white/10",
              "shadow-2xl shadow-black/20"
            )}
          >
            {/* Input Area */}
            <div className="p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Descreva o conteúdo que você quer criar..."
                className={cn(
                  "w-full bg-transparent resize-none outline-none",
                  "text-white placeholder:text-white/30",
                  "text-base min-h-[60px] max-h-[200px]"
                )}
                rows={2}
              />
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Anexar</span>
                </button>
                <button 
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
                  onClick={() => onQuickAction?.("templates")}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Templates</span>
                </button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  input.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
                <span>Criar</span>
              </button>
            </div>
          </div>

          {/* Glow effect */}
          <div 
            className="absolute -inset-1 rounded-2xl opacity-30 blur-xl -z-10"
            style={{
              background: "linear-gradient(135deg, hsl(145, 100%, 40%) 0%, hsl(330, 100%, 50%) 50%, hsl(30, 100%, 50%) 100%)"
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button 
            onClick={() => onQuickAction?.("assistant")}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <Sparkles className="h-4 w-4" />
            <span>Chat livre</span>
          </button>
          <span className="text-white/20">•</span>
          <button 
            onClick={() => onQuickAction?.("performance")}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Ver métricas</span>
          </button>
          <span className="text-white/20">•</span>
          <button 
            onClick={() => onQuickAction?.("library")}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <Library className="h-4 w-4" />
            <span>Biblioteca</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
