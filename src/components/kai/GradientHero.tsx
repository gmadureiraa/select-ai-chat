import { useState, useMemo } from "react";
import { Send, Sparkles, Image, FileText, Video, Mail, Palette, BarChart3, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DynamicIdeasSection } from "./home/DynamicIdeasSection";
import { WeekHighlights } from "./home/WeekHighlights";
import { UpcomingContent } from "./home/UpcomingContent";

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
  clientId?: string;
}

function getTimeGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: "Bom dia", emoji: "☀️" };
  } else if (hour >= 12 && hour < 18) {
    return { greeting: "Boa tarde", emoji: "🌤️" };
  } else {
    return { greeting: "Boa noite", emoji: "🌙" };
  }
}

export function GradientHero({ onSubmit, onQuickAction, clientName, clientId }: GradientHeroProps) {
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-hero", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = useMemo(() => {
    return userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  }, [userProfile, user]);

  const { greeting, emoji } = useMemo(() => getTimeGreeting(), []);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit(input, selectedType || undefined);
    setInput("");
  };

  const handleSelectIdea = (idea: { title: string; description: string }) => {
    setInput(`${idea.title}: ${idea.description}`);
  };

  return (
    <div className="relative h-full flex flex-col px-6 py-8 overflow-y-auto">
      {/* Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 100%, hsl(330, 100%, 35%) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 70% 90%, hsl(145, 80%, 35%) 0%, transparent 40%),
              radial-gradient(ellipse 50% 30% at 30% 95%, hsl(320, 80%, 40%) 0%, transparent 35%),
              hsl(var(--background))
            `
          }}
        />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <p className="text-muted-foreground text-sm">
            {greeting}{userName ? `, ${userName}` : ""} {emoji}
          </p>

          <h1 className="text-3xl md:text-4xl font-light text-foreground tracking-tight">
            O que vamos <span className="font-semibold text-primary">criar</span> {clientName ? `para ${clientName}` : "hoje"}?
          </h1>

          {/* Content Type Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
            {contentTypes.map((type) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all",
                  "border backdrop-blur-sm",
                  selectedType === type.id
                    ? "bg-primary/20 border-primary/50 text-primary shadow-sm"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {type.icon}
                <span>{type.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Input Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative"
        >
          <div className={cn(
            "relative rounded-2xl overflow-hidden",
            "bg-card/50 backdrop-blur-xl",
            "border border-border/50",
            "shadow-xl"
          )}>
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
                  "text-foreground placeholder:text-muted-foreground/50",
                  "text-base min-h-[50px] max-h-[120px]"
                )}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-end px-4 py-3 border-t border-border/30">
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  input.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
                <span>Criar</span>
              </button>
            </div>
          </div>
          <div 
            className="absolute -inset-1 rounded-2xl opacity-15 blur-xl -z-10"
            style={{ background: "linear-gradient(135deg, hsl(145, 100%, 40%) 0%, hsl(330, 100%, 50%) 100%)" }}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-3"
        >
          <button 
            onClick={() => onQuickAction?.("canvas")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all px-4 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50"
          >
            <Palette className="h-4 w-4 text-primary" />
            <span>Canvas</span>
          </button>
          <button 
            onClick={() => onQuickAction?.("performance")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all px-4 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50"
          >
            <BarChart3 className="h-4 w-4 text-secondary" />
            <span>Performance</span>
          </button>
          <button 
            onClick={() => onQuickAction?.("planning")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all px-4 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50"
          >
            <CalendarDays className="h-4 w-4 text-accent" />
            <span>Planejamento</span>
          </button>
        </motion.div>

        {/* Dynamic Ideas Section */}
        {clientId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <DynamicIdeasSection 
              clientId={clientId}
              clientName={clientName}
              onSelectIdea={handleSelectIdea}
            />
          </motion.div>
        )}

        {/* Week Highlights & Upcoming Content */}
        {clientId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <WeekHighlights clientId={clientId} />
            <UpcomingContent 
              clientId={clientId} 
              onViewPlanning={() => onQuickAction?.("planning")} 
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
