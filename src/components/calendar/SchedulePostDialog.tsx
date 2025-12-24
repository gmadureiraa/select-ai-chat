import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Twitter, Linkedin, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScheduledPosts, ScheduledPost } from "@/hooks/useScheduledPosts";
import { useClients } from "@/hooks/useClients";
import { cn } from "@/lib/utils";

interface SchedulePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  editingPost: ScheduledPost | null;
  clientId?: string;
}

export function SchedulePostDialog({
  open,
  onOpenChange,
  selectedDate,
  editingPost,
  clientId: defaultClientId,
}: SchedulePostDialogProps) {
  const { createPost, updatePost, deletePost } = useScheduledPosts();
  const { clients } = useClients();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<'twitter' | 'linkedin'>('twitter');
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [status, setStatus] = useState<'draft' | 'scheduled'>('scheduled');
  const [clientId, setClientId] = useState(defaultClientId || "");

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setPlatform(editingPost.platform);
      const date = new Date(editingPost.scheduled_at);
      setScheduledDate(format(date, "yyyy-MM-dd"));
      setScheduledTime(format(date, "HH:mm"));
      setStatus(editingPost.status === 'draft' ? 'draft' : 'scheduled');
      setClientId(editingPost.client_id);
    } else if (selectedDate) {
      setTitle("");
      setContent("");
      setPlatform('twitter');
      setScheduledDate(format(selectedDate, "yyyy-MM-dd"));
      setScheduledTime("09:00");
      setStatus('scheduled');
      setClientId(defaultClientId || "");
    }
  }, [editingPost, selectedDate, defaultClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

    if (editingPost) {
      await updatePost.mutateAsync({
        id: editingPost.id,
        title,
        content,
        platform,
        scheduled_at: scheduledAt,
        status,
      });
    } else {
      await createPost.mutateAsync({
        client_id: clientId,
        title,
        content,
        platform,
        scheduled_at: scheduledAt,
        status,
      });
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (editingPost) {
      await deletePost.mutateAsync(editingPost.id);
      onOpenChange(false);
    }
  };

  const isSubmitting = createPost.isPending || updatePost.isPending;
  const isDeleting = deletePost.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingPost ? "Editar Post" : "Agendar Post"}</DialogTitle>
          <DialogDescription>
            {editingPost ? "Atualize as informações do post agendado" : "Crie um novo post para publicar nas redes sociais"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!defaultClientId && (
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do post"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o conteúdo do post..."
              rows={5}
              required
            />
            {platform === 'twitter' && content.length > 0 && (
              <p className={cn(
                "text-xs",
                content.length > 280 ? "text-destructive" : "text-muted-foreground"
              )}>
                {content.length}/280 caracteres
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Plataforma</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={platform === 'twitter' ? 'default' : 'outline'}
                onClick={() => setPlatform('twitter')}
                className="flex-1"
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter/X
              </Button>
              <Button
                type="button"
                variant={platform === 'linkedin' ? 'default' : 'outline'}
                onClick={() => setPlatform('linkedin')}
                className="flex-1"
              >
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'scheduled')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-4">
            {editingPost && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPost ? "Salvar" : "Agendar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
