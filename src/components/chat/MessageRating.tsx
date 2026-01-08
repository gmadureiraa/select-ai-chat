import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMessageRating } from "@/hooks/useMessageRating";
import { cn } from "@/lib/utils";

interface MessageRatingProps {
  messageId: string;
  currentRating?: number | null;
}

const FEEDBACK_OPTIONS = [
  { value: "too_long", label: "Muito longo" },
  { value: "too_short", label: "Muito curto" },
  { value: "wrong_tone", label: "Tom inadequado" },
  { value: "not_relevant", label: "Não era o que eu precisava" },
  { value: "other", label: "Outro" },
];

export const MessageRating = ({ messageId, currentRating }: MessageRatingProps) => {
  const { rateMessage, isSubmitting } = useMessageRating();
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [pendingRating, setPendingRating] = useState<-1 | 1 | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customFeedback, setCustomFeedback] = useState("");
  const [localRating, setLocalRating] = useState<number | null>(currentRating ?? null);

  const handleRate = async (rating: -1 | 1) => {
    if (rating === 1) {
      // Positive rating - save immediately
      await rateMessage(messageId, rating);
      setLocalRating(rating);
    } else {
      // Negative rating - show feedback dialog
      setPendingRating(rating);
      setShowFeedbackDialog(true);
    }
  };

  const handleSubmitFeedback = async () => {
    if (pendingRating === null) return;

    const feedback = selectedReason === "other" ? customFeedback : selectedReason;
    await rateMessage(messageId, pendingRating, feedback);
    setLocalRating(pendingRating);
    setShowFeedbackDialog(false);
    setPendingRating(null);
    setSelectedReason("");
    setCustomFeedback("");
  };

  const handleSkipFeedback = async () => {
    if (pendingRating === null) return;
    await rateMessage(messageId, pendingRating);
    setLocalRating(pendingRating);
    setShowFeedbackDialog(false);
    setPendingRating(null);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            localRating === 1 && "text-green-500 bg-green-500/10"
          )}
          onClick={() => handleRate(1)}
          disabled={isSubmitting || localRating !== null}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            localRating === -1 && "text-red-500 bg-red-500/10"
          )}
          onClick={() => handleRate(-1)}
          disabled={isSubmitting || localRating !== null}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que poderia ser melhor?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {FEEDBACK_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {selectedReason === "other" && (
              <Textarea
                placeholder="Conte-nos mais sobre o que poderia melhorar..."
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={handleSkipFeedback} disabled={isSubmitting}>
              Pular
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || !selectedReason}
            >
              Enviar Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
