import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon,
  Calendar,
  Sparkles,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types for different response cards
export interface CreatedCardInfo {
  id: string;
  title: string;
  format: string;
  column: string;
}

export interface SuccessCardPayload {
  type: "cards_created";
  message: string;
  clientName: string;
  column: string;
  format: string | null;
  cards: CreatedCardInfo[];
  totalCount: number;
}

export interface ErrorCardPayload {
  type: "error";
  message: string;
  details?: string;
}

export interface LoadingCardPayload {
  type: "loading";
  message: string;
  step?: string;
}

export interface InfoCardPayload {
  type: "info";
  title: string;
  message: string;
  actions?: { label: string; onClick: () => void }[];
}

export type ResponseCardPayload = 
  | SuccessCardPayload 
  | ErrorCardPayload 
  | LoadingCardPayload 
  | InfoCardPayload;

// Format icon mapping
const formatIcons: Record<string, React.ReactNode> = {
  carrossel: <ImageIcon className="h-3.5 w-3.5" />,
  post: <FileText className="h-3.5 w-3.5" />,
  reels: <Sparkles className="h-3.5 w-3.5" />,
  stories: <Sparkles className="h-3.5 w-3.5" />,
  newsletter: <FileText className="h-3.5 w-3.5" />,
};

// Success Card Component
function SuccessCard({ payload, onViewPlanning }: { 
  payload: SuccessCardPayload; 
  onViewPlanning?: () => void;
}) {
  const displayedCards = payload.cards.slice(0, 3);
  const remainingCount = payload.cards.length - 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            {payload.totalCount} {payload.totalCount === 1 ? "Card Criado" : "Cards Criados"}
          </p>
          <p className="text-xs text-muted-foreground">
            {payload.clientName} • {payload.column}
          </p>
        </div>
      </div>

      {/* Cards List */}
      <div className="p-4 space-y-2">
        {displayedCards.map((card, index) => (
          <div 
            key={card.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{card.title}</p>
            </div>
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              {formatIcons[card.format] || <FileText className="h-3 w-3" />}
              {card.format}
            </Badge>
          </div>
        ))}
        
        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground text-center py-1">
            + {remainingCount} mais
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border px-4 py-3 flex gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1"
          onClick={onViewPlanning}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Ver no Planejamento
        </Button>
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Error Card Component
function ErrorCard({ payload }: { payload: ErrorCardPayload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-destructive/30 rounded-xl overflow-hidden shadow-sm"
    >
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center">
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-medium text-foreground">Erro</p>
          <p className="text-sm text-muted-foreground">{payload.message}</p>
        </div>
      </div>
      
      {payload.details && (
        <div className="p-4">
          <p className="text-xs text-muted-foreground">{payload.details}</p>
        </div>
      )}
    </motion.div>
  );
}

// Loading Card Component
function LoadingCard({ payload }: { payload: LoadingCardPayload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
    >
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </div>
        <div>
          <p className="font-medium text-foreground">{payload.message}</p>
          {payload.step && (
            <p className="text-xs text-muted-foreground">{payload.step}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Info Card Component
function InfoCard({ payload }: { payload: InfoCardPayload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
    >
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className="font-medium text-foreground">{payload.title}</p>
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-sm text-muted-foreground">{payload.message}</p>
      </div>

      {payload.actions && payload.actions.length > 0 && (
        <div className="border-t border-border px-4 py-3 flex gap-2">
          {payload.actions.map((action, index) => (
            <Button 
              key={index}
              variant={index === 0 ? "default" : "outline"} 
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Main ResponseCard Component
interface ResponseCardProps {
  payload: ResponseCardPayload;
  onViewPlanning?: () => void;
}

export function ResponseCard({ payload, onViewPlanning }: ResponseCardProps) {
  switch (payload.type) {
    case "cards_created":
      return <SuccessCard payload={payload} onViewPlanning={onViewPlanning} />;
    case "error":
      return <ErrorCard payload={payload} />;
    case "loading":
      return <LoadingCard payload={payload} />;
    case "info":
      return <InfoCard payload={payload} />;
    default:
      return null;
  }
}

// Helper to check if a message has a response card payload
export function hasResponseCardPayload(message: { payload?: unknown }): message is { payload: ResponseCardPayload } {
  const payload = message.payload as { type?: string } | undefined;
  return !!payload && typeof payload === "object" && "type" in payload && 
    ["cards_created", "error", "loading", "info"].includes(payload.type as string);
}
