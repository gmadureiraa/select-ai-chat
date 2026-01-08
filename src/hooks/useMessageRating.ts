import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Rating = -1 | 0 | 1;

interface RatingData {
  messageId: string;
  rating: Rating;
  feedback?: string;
}

export const useMessageRating = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratingMutation = useMutation({
    mutationFn: async ({ messageId, rating, feedback }: RatingData) => {
      const { error } = await supabase
        .from("messages")
        .update({
          rating,
          rating_feedback: feedback || null,
          rated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) throw error;
      return { messageId, rating };
    },
    onSuccess: ({ rating }) => {
      toast({
        title: rating === 1 ? "Obrigado pelo feedback! 👍" : "Obrigado pelo feedback!",
        description: "Seu feedback nos ajuda a melhorar as respostas.",
      });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar feedback",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const rateMessage = async (messageId: string, rating: Rating, feedback?: string) => {
    setIsSubmitting(true);
    try {
      await ratingMutation.mutateAsync({ messageId, rating, feedback });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    rateMessage,
    isSubmitting,
  };
};
