import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Circle, Sparkles, Users, Instagram, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClients } from "@/hooks/useClients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: () => void;
}

interface ProgressChecklistProps {
  collapsed?: boolean;
  onNavigate?: (tab: string) => void;
  selectedClientId?: string | null;
}

export function ProgressChecklist({ 
  collapsed, 
  onNavigate,
  selectedClientId 
}: ProgressChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { clients } = useClients();

  // Check if has content in library
  const { data: libraryContent } = useQuery({
    queryKey: ["library-content-check", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase
        .from("client_content_library")
        .select("id")
        .eq("client_id", selectedClientId)
        .limit(1);
      return data;
    },
    enabled: !!selectedClientId,
  });

  // Check if has social credentials
  const { data: socialCredentials } = useQuery({
    queryKey: ["social-credentials-check", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase
        .from("client_social_credentials")
        .select("id")
        .eq("client_id", selectedClientId)
        .limit(1);
      return data;
    },
    enabled: !!selectedClientId,
  });

  // Check if has planning items
  const { data: planningItems } = useQuery({
    queryKey: ["planning-items-check", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase
        .from("planning_items")
        .select("id")
        .eq("client_id", selectedClientId)
        .limit(1);
      return data;
    },
    enabled: !!selectedClientId,
  });

  const hasClient = clients && clients.length > 0;
  const hasContent = libraryContent && libraryContent.length > 0;
  const hasSocial = socialCredentials && socialCredentials.length > 0;
  const hasPlanning = planningItems && planningItems.length > 0;

  const items: ChecklistItem[] = [
    {
      id: "client",
      label: "Criar cliente",
      description: "Configure seu primeiro cliente",
      icon: <Users className="h-3.5 w-3.5" />,
      completed: hasClient || false,
      action: () => onNavigate?.("clients"),
    },
    {
      id: "content",
      label: "Criar conteúdo",
      description: "Gere seu primeiro conteúdo",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      completed: hasContent || false,
      action: () => onNavigate?.("assistant"),
    },
    {
      id: "social",
      label: "Conectar rede social",
      description: "Integre suas redes",
      icon: <Instagram className="h-3.5 w-3.5" />,
      completed: hasSocial || false,
      action: () => onNavigate?.("performance"),
    },
    {
      id: "planning",
      label: "Agendar postagem",
      description: "Planeje sua publicação",
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      completed: hasPlanning || false,
      action: () => onNavigate?.("planning"),
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;
  const allCompleted = completedCount === items.length;

  // Hide if all completed
  if (allCompleted) return null;

  // Collapsed view
  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div className="flex flex-col items-center gap-1">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted/30"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-primary"
                strokeDasharray={`${progress * 0.754} 75.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
              {completedCount}/{items.length}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-medium">Setup</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {completedCount}/{items.length}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="px-3 pb-2">
          <Progress value={progress} className="h-1" />
        </div>

        {/* Items */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-0.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.action}
                    disabled={item.completed}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors",
                      item.completed
                        ? "opacity-60 cursor-default"
                        : "hover:bg-muted/50 cursor-pointer"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border",
                        item.completed
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {item.completed ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-muted-foreground">{item.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-xs font-medium truncate",
                          item.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
