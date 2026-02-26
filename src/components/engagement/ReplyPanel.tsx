import { useState } from "react";
import { EngagementOpportunity } from "@/hooks/useEngagementFeed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Sparkles, Send, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { UseMutationResult } from "@tanstack/react-query";

interface ReplyPanelProps {
  opportunity: EngagementOpportunity;
  clientId: string;
  onClose: () => void;
  onReplyGenerated: (text: string) => void;
  onReplyPosted: () => void;
  generateReply: UseMutationResult<any, Error, { opportunityId: string; tone: string }>;
  postReply: UseMutationResult<any, Error, { opportunityId: string; replyText: string }>;
}

const tones = [
  { value: 'insightful', label: '💡 Insightful', desc: 'Analítico e perspicaz' },
  { value: 'bold', label: '🔥 Bold', desc: 'Ousado e direto' },
  { value: 'supportive', label: '🤝 Supportive', desc: 'Construtivo e encorajador' },
];

export function ReplyPanel({
  opportunity,
  clientId,
  onClose,
  onReplyGenerated,
  onReplyPosted,
  generateReply,
  postReply,
}: ReplyPanelProps) {
  const [replyText, setReplyText] = useState(opportunity.reply_text || '');
  const [selectedTone, setSelectedTone] = useState('insightful');
  const charCount = replyText.length;
  const isOverLimit = charCount > 280;

  const handleGenerate = async () => {
    const result = await generateReply.mutateAsync({
      opportunityId: opportunity.id,
      tone: selectedTone,
    });
    if (result?.replyText) {
      setReplyText(result.replyText);
      onReplyGenerated(result.replyText);
    }
  };

  const handlePost = async () => {
    if (!replyText.trim() || isOverLimit) return;
    await postReply.mutateAsync({
      opportunityId: opportunity.id,
      replyText: replyText.trim(),
    });
    onReplyPosted();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium">Responder</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Original tweet */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={opportunity.author_avatar || undefined} />
            <AvatarFallback className="text-[10px]">
              {opportunity.author_username?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{opportunity.author_name}</span>
          <span className="text-xs text-muted-foreground">@{opportunity.author_username}</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{opportunity.tweet_text}</p>
      </div>

      {/* Tone selector */}
      <div className="p-3 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Tom da resposta</p>
        <div className="flex gap-1">
          {tones.map((tone) => (
            <Button
              key={tone.value}
              variant={selectedTone === tone.value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setSelectedTone(tone.value)}
            >
              {tone.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Reply composer */}
      <div className="flex-1 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGenerate}
            disabled={generateReply.isPending}
          >
            {generateReply.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : replyText ? (
              <RefreshCw className="h-3 w-3 mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {replyText ? 'Regenerar' : 'Gerar com IA'}
          </Button>
          <span className={cn(
            "text-xs",
            isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
          )}>
            {charCount}/280
          </span>
        </div>

        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Escreva sua reply ou gere com IA..."
          className="flex-1 resize-none text-sm min-h-[120px]"
        />

        {opportunity.status === 'replied' && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            ✅ Reply já publicada
          </p>
        )}
      </div>

      {/* Post button */}
      <div className="p-3 border-t border-border">
        <Button
          className="w-full"
          onClick={handlePost}
          disabled={!replyText.trim() || isOverLimit || postReply.isPending || opportunity.status === 'replied'}
        >
          {postReply.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Publicar Reply
        </Button>
      </div>
    </div>
  );
}
