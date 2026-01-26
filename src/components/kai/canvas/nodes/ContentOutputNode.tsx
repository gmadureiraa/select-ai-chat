import { memo, useState, useMemo, useDeferredValue, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileOutput, X, Copy, RefreshCw, Check, Edit3, Save, Download, Image, ExternalLink, Maximize2, Minimize2, Lock, Sparkles, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { OutputNodeData, ContentFormat, Platform, ContentVersion, NodeComment as NodeCommentType, ApprovalStatus } from "../hooks/useCanvasState";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { VersionHistory } from "../components/VersionHistory";
import { ApprovalStatus as ApprovalStatusComponent } from "../components/ApprovalStatus";
import { NodeComment } from "../components/NodeComment";
import { StreamingPreview } from "../components/StreamingPreview";

// Platform character limits
const PLATFORM_LIMITS: Record<Platform, number | null> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  youtube: null,
  tiktok: 2200,
  other: null,
};

interface ContentOutputNodeProps extends NodeProps<OutputNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<OutputNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onSendToPlanning?: (nodeId: string) => void;
  onRegenerate?: (nodeId: string) => void;
  onCreateRemix?: (nodeId: string) => void;
}

const FORMAT_LABELS: Record<ContentFormat, string> = {
  carousel: "Carrossel",
  thread: "Thread",
  reel_script: "Roteiro",
  post: "Post",
  stories: "Stories",
  newsletter: "Newsletter",
  image: "Imagem"
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter/X",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Outro"
};

const MAX_VERSIONS = 5;

function ContentOutputNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete,
  onSendToPlanning,
  onRegenerate,
  onCreateRemix
}: ContentOutputNodeProps) {
  const { toast } = useToast();
  const { hasPlanning } = usePlanFeatures();
  const { showUpgradePrompt } = useUpgradePrompt();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(data.content);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use deferred value for content to avoid blocking renders
  const deferredContent = useDeferredValue(data.content);

  const handleSendToPlanning = () => {
    // Only allow sending if approved or draft
    if (data.approvalStatus === "rejected") {
      toast({
        title: "Conteúdo rejeitado",
        description: "Aprove o conteúdo antes de enviar para planejamento",
        variant: "destructive",
      });
      return;
    }
    
    if (!hasPlanning) {
      showUpgradePrompt("planning_locked");
      return;
    }
    onSendToPlanning?.(id);
  };

  // Calculate content stats
  const contentStats = useMemo(() => {
    if (data.isImage || !data.content) return null;
    const charCount = data.content.length;
    const wordCount = data.content.trim().split(/\s+/).filter(Boolean).length;
    const platformLimit = PLATFORM_LIMITS[data.platform];
    const isOverLimit = platformLimit ? charCount > platformLimit : false;
    return { charCount, wordCount, platformLimit, isOverLimit };
  }, [data.content, data.platform, data.isImage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.content);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(data.content);
  };

  const handleSave = () => {
    // Save current version to history before updating
    const newVersion: ContentVersion = {
      id: `v-${Date.now()}`,
      content: data.content,
      createdAt: new Date().toISOString(),
      label: `Edição ${(data.versions?.length || 0) + 1}`,
    };
    
    const updatedVersions = [newVersion, ...(data.versions || [])].slice(0, MAX_VERSIONS);
    
    onUpdateData?.(id, { 
      content: editedContent, 
      isEditing: false,
      versions: updatedVersions,
    });
    setIsEditing(false);
    toast({
      title: "Salvo!",
      description: "Alterações salvas com sucesso",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(data.content);
  };

  // Version history handlers
  const handleRestoreVersion = useCallback((version: ContentVersion) => {
    // Save current as a version before restoring
    const currentVersion: ContentVersion = {
      id: `v-${Date.now()}`,
      content: data.content,
      createdAt: new Date().toISOString(),
      label: "Antes da restauração",
    };
    
    const updatedVersions = [currentVersion, ...(data.versions || [])].slice(0, MAX_VERSIONS);
    
    onUpdateData?.(id, { 
      content: version.content,
      versions: updatedVersions,
    });
    
    toast({
      title: "Versão restaurada",
      description: "O conteúdo foi restaurado para a versão anterior",
    });
  }, [id, data.content, data.versions, onUpdateData, toast]);

  const handleClearVersions = useCallback(() => {
    onUpdateData?.(id, { versions: [] });
    toast({
      title: "Histórico limpo",
      description: "Todas as versões anteriores foram removidas",
    });
  }, [id, onUpdateData, toast]);

  // Comment handlers
  const handleAddComment = useCallback((text: string) => {
    const newComment: NodeCommentType = {
      id: `c-${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    
    const updatedComments = [...(data.comments || []), newComment];
    onUpdateData?.(id, { comments: updatedComments });
  }, [id, data.comments, onUpdateData]);

  const handleResolveComment = useCallback((commentId: string) => {
    const updatedComments = (data.comments || []).map(c => 
      c.id === commentId ? { ...c, resolved: true } : c
    );
    onUpdateData?.(id, { comments: updatedComments });
  }, [id, data.comments, onUpdateData]);

  const handleDeleteComment = useCallback((commentId: string) => {
    const updatedComments = (data.comments || []).filter(c => c.id !== commentId);
    onUpdateData?.(id, { comments: updatedComments });
  }, [id, data.comments, onUpdateData]);

  // Approval handler
  const handleApprovalChange = useCallback((status: ApprovalStatus) => {
    onUpdateData?.(id, { approvalStatus: status });
    
    const statusLabels: Record<ApprovalStatus, string> = {
      draft: "Rascunho",
      pending: "Aguardando revisão",
      approved: "Aprovado",
      rejected: "Rejeitado",
    };
    
    toast({
      title: `Status: ${statusLabels[status]}`,
      description: status === "approved" 
        ? "Conteúdo pronto para planejamento" 
        : status === "rejected"
          ? "Conteúdo marcado para revisão"
          : "Status atualizado",
    });
  }, [id, onUpdateData, toast]);

  // Remix handler - create new generator connected to this output
  const handleRemix = useCallback(() => {
    onCreateRemix?.(id);
  }, [id, onCreateRemix]);

  const cardWidth = isExpanded ? "w-[500px]" : "w-[350px]";
  const scrollHeight = isExpanded ? "h-[320px]" : "h-[160px]";

// Border color based on approval status
  const borderColor = data.addedToPlanning 
    ? "border-primary/50" 
    : data.approvalStatus === "approved"
      ? "border-primary/30"
      : data.approvalStatus === "rejected"
        ? "border-destructive/30"
        : "border-primary/30";

  return (
    <Card className={cn(
      cardWidth,
      "shadow-lg rounded-xl transition-all duration-200 border-2 relative overflow-hidden",
      selected ? "border-primary ring-2 ring-primary/20 shadow-primary/10" : borderColor,
      "hover:shadow-xl"
    )}>
      {/* Shimmer effect during streaming */}
      <AnimatePresence>
        {data.isStreaming && (
          <motion.div
            className="absolute inset-0 z-10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CardHeader className={cn(
        "pb-2 pt-3 px-3 flex-row items-center justify-between rounded-t-xl border-b",
        "bg-blue-500/5 dark:bg-blue-500/10",
        "border-blue-500/15 dark:border-blue-500/20"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center transition-all",
            data.addedToPlanning 
              ? "bg-primary shadow-sm shadow-primary/30" 
              : "bg-blue-500/80 dark:bg-blue-500"
          )}>
            {data.addedToPlanning ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <FileOutput className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <span className="font-medium text-sm">Resultado</span>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-5">
              {FORMAT_LABELS[data.format]}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {PLATFORM_LABELS[data.platform]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Comments button */}
          <NodeComment
            comments={data.comments || []}
            onAddComment={handleAddComment}
            onResolve={handleResolveComment}
            onDelete={handleDeleteComment}
          />
          
          {/* Version history */}
          {!data.isImage && (data.versions?.length || 0) > 0 && (
            <VersionHistory
              versions={data.versions || []}
              currentContent={data.content}
              onRestore={handleRestoreVersion}
              onClear={handleClearVersions}
              maxVersions={MAX_VERSIONS}
            />
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimizar" : "Expandir"}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete?.(id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-2">
        {/* Approval status */}
        {!data.isImage && data.content && (
          <div className="flex items-center justify-between">
            <ApprovalStatusComponent
              status={data.approvalStatus || "draft"}
              onStatusChange={handleApprovalChange}
              compact
            />
          </div>
        )}

        {/* Image output */}
        {data.isImage ? (
          <div className="space-y-2">
            <div className={cn(
              "relative rounded-md border overflow-hidden bg-muted/30",
              isExpanded ? "max-h-[300px]" : "max-h-[200px]"
            )}>
              {data.content ? (
                <img 
                  src={data.content} 
                  alt="Generated image" 
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="h-[150px] flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground animate-pulse" />
                </div>
              )}
            </div>
            {data.content && (
              <div className="flex gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar URL
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = data.content;
                    link.download = `image-${id}.png`;
                    link.click();
                  }}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onRegenerate?.(id)}
                  className="h-7 text-xs px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ) : isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={cn(
                "text-xs resize-none",
                isExpanded ? "min-h-[300px]" : "min-h-[200px]"
              )}
              rows={isExpanded ? 15 : 10}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1 gap-1">
                <Save className="h-3 w-3" />
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className={cn(scrollHeight, "rounded-md border p-2 bg-muted/30")}>
              <StreamingPreview
                content={deferredContent}
                isStreaming={data.isStreaming || false}
                progress={data.streamProgress || 0}
              />
            </ScrollArea>

            {/* Content stats */}
            {contentStats && data.content && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>{contentStats.wordCount} palavras</span>
                <span className={cn(
                  contentStats.isOverLimit && "text-destructive font-medium"
                )}>
                  {contentStats.charCount}
                  {contentStats.platformLimit && (
                    <span>/{contentStats.platformLimit}</span>
                  )}
                  {contentStats.isOverLimit && " ⚠️"}
                </span>
              </div>
            )}

            {data.content && (
              <div className="flex gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleEdit}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleRemix}
                        className="h-7 text-xs px-2"
                      >
                        <GitBranch className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Remix: criar novo gerador usando este conteúdo
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onRegenerate?.(id)}
                  className="h-7 text-xs px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}

            {data.content && !data.addedToPlanning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleSendToPlanning}
                      className={cn(
                        "w-full h-8 gap-1.5 text-xs",
                        !hasPlanning && "bg-muted hover:bg-muted/80",
                        data.approvalStatus === "rejected" && "opacity-50"
                      )}
                      variant={hasPlanning ? "default" : "outline"}
                      disabled={data.approvalStatus === "rejected"}
                    >
                      {hasPlanning ? (
                        data.approvalStatus === "approved" ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {data.approvalStatus === "approved" 
                        ? "Enviar (Aprovado)" 
                        : "Enviar para Planejamento"
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {data.approvalStatus === "rejected"
                        ? "Aprove o conteúdo antes de enviar"
                        : hasPlanning 
                          ? "Abre o editor para revisar antes de salvar" 
                          : "Disponível no plano Pro"
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {data.addedToPlanning && (
              <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Adicionado ao planejamento
              </div>
            )}
          </>
        )}
      </CardContent>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!w-3 !h-3 transition-all duration-200",
          "!bg-blue-500 !border-2 !border-background",
          "hover:!scale-125 hover:!shadow-md hover:!shadow-blue-500/30"
        )}
        title="Entrada de conteúdo"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!w-3 !h-3 transition-all duration-200 cursor-crosshair",
          "!bg-primary !border-2 !border-background",
          "hover:!scale-125 hover:!shadow-md hover:!shadow-primary/30"
        )}
        title="Arraste para conectar a outro Gerador (Remix)"
      />
    </Card>
  );
}

export const ContentOutputNode = memo(ContentOutputNodeComponent);
