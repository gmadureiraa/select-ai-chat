import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Palette, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SendToCanvasButtonProps {
  content: string;
  clientId?: string;
  clientName?: string;
  format?: string;
  disabled?: boolean;
}

export function SendToCanvasButton({ 
  content, 
  clientId, 
  clientName,
  format = "post",
  disabled = false 
}: SendToCanvasButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { isCanvas } = usePlanFeatures();

  // Don't show for short content or if no client
  if (!content || content.length < 100 || !clientId) {
    return null;
  }

  const handleSendToCanvas = async () => {
    if (!user?.id || !workspace?.id || !clientId) {
      toast({
        title: "Erro",
        description: "Dados do usuário ou cliente não disponíveis.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Check for existing canvas or create new one
      const { data: existingCanvas } = await supabase
        .from("content_canvas")
        .select("id, nodes, edges")
        .eq("client_id", clientId)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let canvasId = existingCanvas?.id;
      let currentNodes = existingCanvas?.nodes as any[] || [];
      let currentEdges = existingCanvas?.edges as any[] || [];

      // Generate unique ID for the new node
      const nodeId = `output-${Date.now()}`;
      
      // Calculate position (offset from last node or center)
      const lastNode = currentNodes[currentNodes.length - 1];
      const newPosition = lastNode 
        ? { x: (lastNode.position?.x || 0) + 50, y: (lastNode.position?.y || 0) + 50 }
        : { x: 400, y: 200 };

      // Create the new output node (using modern "output" type, legacy "contentOutput" is deprecated)
      const newNode = {
        id: nodeId,
        type: "output",
        position: newPosition,
        data: {
          type: "output",
          content,
          format: format || "post",
          platform: "instagram",
          isEditing: false,
          addedToPlanning: false,
          approvalStatus: "pending" as const,
        },
      };

      if (canvasId) {
        // Update existing canvas
        const updatedNodes = [...currentNodes, newNode];
        
        await supabase
          .from("content_canvas")
          .update({
            nodes: updatedNodes,
            edges: currentEdges,
            updated_at: new Date().toISOString(),
          })
          .eq("id", canvasId);
      } else {
        // Create new canvas
        const { data: newCanvas, error } = await supabase
          .from("content_canvas")
          .insert({
            name: `Canvas - ${clientName || "Novo"}`,
            client_id: clientId,
            user_id: user.id,
            workspace_id: workspace.id,
            nodes: [newNode],
            edges: [],
          })
          .select()
          .single();

        if (error) throw error;
        canvasId = newCanvas?.id;
      }

      setSent(true);
      toast({
        title: "Enviado ao Canvas!",
        description: "O conteúdo foi adicionado ao seu Canvas.",
      });

      // Optional: Navigate to canvas
      setTimeout(() => {
        if (slug && canvasId) {
          navigate(`/${slug}?client=${clientId}&tab=canvas`);
        }
      }, 1500);

    } catch (error) {
      console.error("Error sending to canvas:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o conteúdo ao Canvas.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="gap-1.5 text-xs text-green-600"
      >
        <Check className="h-3.5 w-3.5" />
        Enviado
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSendToCanvas}
          disabled={disabled || isSending}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {isSending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Palette className="h-3.5 w-3.5" />
          )}
          Canvas
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Enviar conteúdo ao Canvas</p>
      </TooltipContent>
    </Tooltip>
  );
}
