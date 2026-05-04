import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTaskComments } from "@/hooks/useTaskComments";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MentionableTextarea, extractMentionedIds, type MemberOption } from "./MentionableTextarea";

interface TaskCommentsProps {
  taskId: string | null;
  readOnly?: boolean;
}

function getInitials(name?: string | null) {
  if (!name) return "👤";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "👤";
}

export function TaskComments({ taskId, readOnly }: TaskCommentsProps) {
  const { user } = useAuth();
  const { members } = useTeamMembers();
  const { comments, addComment, removeComment } = useTaskComments(taskId);
  const [text, setText] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);

  const memberMap = useMemo(() => {
    const m: Record<string, { name: string; initials: string }> = {};
    members.forEach((mem: any) => {
      const name = mem.profile?.full_name || mem.profile?.email || "Membro";
      m[mem.user_id] = { name, initials: getInitials(name) };
    });
    return m;
  }, [members]);

  const memberOptions: MemberOption[] = useMemo(
    () =>
      members.map((m: any) => ({
        user_id: m.user_id,
        name: m.profile?.full_name || m.profile?.email || "Membro",
        email: m.profile?.email,
      })),
    [members],
  );

  const handleSend = () => {
    const v = text.trim();
    if (!v || !taskId) return;
    const ids = mentionIds.length ? mentionIds : extractMentionedIds(v, memberOptions);
    addComment.mutate({ content: v, mentions: ids });
    setText("");
    setMentionIds([]);
  };

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Comentários
      </span>

      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Nenhum comentário ainda.</p>
        )}
        {comments.map((c) => {
          const author = memberMap[c.author_id];
          const isMe = c.author_id === user?.id;
          return (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-6 w-6 mt-0.5">
                <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                  {author?.initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{author?.name || "Membro"}</span>
                  <span className="text-muted-foreground" title={format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}>
                    {formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}
                  </span>
                  {isMe && !readOnly && (
                    <button
                      onClick={() => removeComment.mutate(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
                  {c.content.split(/(\s+)/).map((tok, i) =>
                    tok.startsWith("@") ? (
                      <span key={i} className="text-primary font-medium">{tok}</span>
                    ) : (
                      <span key={i}>{tok}</span>
                    ),
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && taskId && (
        <div className="flex gap-2 items-end pt-2 border-t border-border/40">
          <div className="flex-1">
            <MentionableTextarea
              value={text}
              onChange={(v, ids) => { setText(v); setMentionIds(ids); }}
              members={memberOptions}
              placeholder="Comentar… (use @nome para mencionar) — Cmd+Enter para enviar"
              rows={2}
              onSubmit={handleSend}
            />
          </div>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || addComment.isPending}
            className={cn("h-9 w-9 shrink-0")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
