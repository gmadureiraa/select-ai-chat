import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, 
  Sparkles, 
  FileOutput,
  Play,
  Link2,
  FileText,
  Image as ImageIcon,
  Type,
  Youtube,
  Instagram,
  Twitter,
  Linkedin,
  ArrowRight,
  Loader2,
  Check,
  MousePointer2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Simulated toolbar items
const toolbarItems = [
  { icon: MousePointer2, label: "Cursor" },
  { icon: Type, label: "Texto" },
  { icon: FileText, label: "Nota" },
];

// Demo content that appears in result
const demoContent = {
  carousel: "📱 Carrossel Instagram\n\n1️⃣ O que você precisa saber\n2️⃣ Como funciona na prática\n3️⃣ Resultados comprovados\n4️⃣ Próximo passo",
  thread: "🧵 Thread Twitter\n\n1/ Você já pensou em automatizar sua criação de conteúdo?\n\n2/ Com IA, você pode gerar 10x mais conteúdo...\n\n3/ E o melhor: mantendo SUA voz única.",
  article: "📝 Artigo LinkedIn\n\nComo a IA está revolucionando a criação de conteúdo para marketing digital...",
};

interface CanvasNode {
  id: string;
  type: "attachment" | "generator" | "result";
  position: { x: number; y: number };
  data: {
    activeTab?: string;
    url?: string;
    format?: string;
    platform?: string;
    content?: string;
    isGenerating?: boolean;
  };
}

const initialNodes: CanvasNode[] = [
  {
    id: "attachment",
    type: "attachment",
    position: { x: 40, y: 80 },
    data: {
      activeTab: "link",
      url: "youtube.com/watch?v=abc123",
    },
  },
  {
    id: "generator",
    type: "generator",
    position: { x: 280, y: 70 },
    data: {
      format: "carousel",
      platform: "instagram",
    },
  },
  {
    id: "result",
    type: "result",
    position: { x: 520, y: 60 },
    data: {
      content: "",
      format: "carousel",
      platform: "instagram",
    },
  },
];

// Attachment Node Component
const AttachmentNode = ({ 
  node, 
  onTabChange,
  isDragging 
}: { 
  node: CanvasNode; 
  onTabChange: (tab: string) => void;
  isDragging: boolean;
}) => {
  const tabs = [
    { id: "link", icon: Link2, label: "Link" },
    { id: "texto", icon: Type, label: "Texto" },
    { id: "imagem", icon: ImageIcon, label: "Imagem" },
  ];

  return (
    <div 
      className={cn(
        "w-[180px] rounded-lg border-2 border-blue-500/50 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background shadow-lg transition-all",
        isDragging && "shadow-xl scale-105"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <Paperclip className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium">Anexo</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={(e) => {
              e.stopPropagation();
              onTabChange(tab.id);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] transition-colors",
              node.data.activeTab === tab.id 
                ? "bg-primary/10 text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <tab.icon className="w-3 h-3" />
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-2">
        {node.data.activeTab === "link" && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted rounded text-[10px] text-muted-foreground">
            <Youtube className="w-3 h-3 text-red-500" />
            <span className="truncate">{node.data.url}</span>
          </div>
        )}
        {node.data.activeTab === "texto" && (
          <div className="px-2 py-1.5 bg-muted rounded text-[10px] text-muted-foreground">
            Cole seu texto aqui...
          </div>
        )}
        {node.data.activeTab === "imagem" && (
          <div className="h-12 flex items-center justify-center bg-muted rounded text-[10px] text-muted-foreground">
            <ImageIcon className="w-4 h-4 mr-1" />
            Drop image
          </div>
        )}
      </div>
    </div>
  );
};

// Generator Node Component
const GeneratorNode = ({ 
  node, 
  onGenerate, 
  isDragging,
  connectionCount 
}: { 
  node: CanvasNode; 
  onGenerate: () => void; 
  isDragging: boolean;
  connectionCount: number;
}) => {
  return (
    <div 
      className={cn(
        "w-[160px] rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background shadow-lg transition-all",
        isDragging && "shadow-xl scale-105",
        node.data.isGenerating && "animate-pulse"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium">Gerador</span>
        <Badge 
          variant={connectionCount > 0 ? "secondary" : "outline"} 
          className="h-4 text-[9px] px-1 ml-auto"
        >
          <Link2 className="w-2.5 h-2.5 mr-0.5" />
          {connectionCount}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-2 space-y-2">
        {/* Format selector mock */}
        <div className="px-2 py-1 bg-muted rounded text-[10px] flex items-center justify-between">
          <span className="text-muted-foreground">Formato</span>
          <span className="font-medium">Carrossel</span>
        </div>

        {/* Platform selector mock */}
        <div className="px-2 py-1 bg-muted rounded text-[10px] flex items-center justify-between">
          <span className="text-muted-foreground">Plataforma</span>
          <Instagram className="w-3 h-3 text-pink-500" />
        </div>

        {/* Generate button */}
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onGenerate();
          }}
          disabled={node.data.isGenerating}
          className="w-full h-7 text-xs bg-green-600 hover:bg-green-700"
        >
          {node.data.isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              Gerar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Result Node Component
const ResultNode = ({ 
  node, 
  isDragging 
}: { 
  node: CanvasNode; 
  isDragging: boolean;
}) => {
  const hasContent = !!node.data.content;

  return (
    <div 
      className={cn(
        "w-[180px] rounded-lg border-2 border-pink-500/50 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-background shadow-lg transition-all",
        isDragging && "shadow-xl scale-105"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="w-5 h-5 rounded bg-pink-500 flex items-center justify-center">
          <FileOutput className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium">Resultado</span>
        {hasContent && (
          <Badge variant="secondary" className="h-4 text-[9px] px-1 ml-auto">
            <Instagram className="w-2.5 h-2.5 mr-0.5" />
            Carrossel
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {hasContent ? (
          <div className="space-y-2">
            <div className="bg-muted rounded p-2 text-[10px] whitespace-pre-line max-h-[100px] overflow-hidden">
              {node.data.content}
            </div>
            <div className="flex gap-1">
              <div className="flex-1 h-6 bg-primary/10 rounded flex items-center justify-center text-[9px] text-primary">
                <Check className="w-2.5 h-2.5 mr-0.5" />
                Copiar
              </div>
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center text-[10px] text-muted-foreground bg-muted/50 rounded">
            Aguardando geração...
          </div>
        )}
      </div>
    </div>
  );
};

const InteractiveCanvasDemo = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const nodeStartPos = useRef<{ x: number; y: number } | null>(null);

  // Auto-play cursor animation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (interactionCount === 0) {
        // Simulate click on generate after delay
        handleGenerate();
        setShowCursor(false);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [interactionCount]);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingId(nodeId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    nodeStartPos.current = { ...node.position };
    setShowCursor(false);
    
    setInteractionCount(prev => prev + 1);
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !dragStartPos.current || !nodeStartPos.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    const newX = Math.max(0, Math.min(containerRect.width - 180, nodeStartPos.current.x + deltaX));
    const newY = Math.max(0, Math.min(containerRect.height - 120, nodeStartPos.current.y + deltaY));

    setNodes(prev => prev.map(node => 
      node.id === draggingId 
        ? { ...node, position: { x: newX, y: newY } }
        : node
    ));
  }, [draggingId]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    dragStartPos.current = null;
    nodeStartPos.current = null;
  }, []);

  const handleTabChange = (tab: string) => {
    setNodes(prev => prev.map(node => 
      node.id === "attachment" 
        ? { ...node, data: { ...node.data, activeTab: tab } }
        : node
    ));
    setInteractionCount(prev => prev + 1);
  };

  const handleGenerate = () => {
    // Start generation
    setNodes(prev => prev.map(node => 
      node.id === "generator" 
        ? { ...node, data: { ...node.data, isGenerating: true } }
        : node.id === "result"
        ? { ...node, data: { ...node.data, content: "" } }
        : node
    ));

    // Simulate generation delay
    setTimeout(() => {
      setNodes(prev => prev.map(node => 
        node.id === "generator" 
          ? { ...node, data: { ...node.data, isGenerating: false } }
          : node.id === "result"
          ? { ...node, data: { ...node.data, content: demoContent.carousel } }
          : node
      ));
    }, 2000);

    setInteractionCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setTimeout(() => setShowSignupDialog(true), 2500);
      }
      return newCount;
    });
  };

  // Calculate connection paths
  const attachmentNode = nodes.find(n => n.id === "attachment")!;
  const generatorNode = nodes.find(n => n.id === "generator")!;
  const resultNode = nodes.find(n => n.id === "result")!;

  const createBezierPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const controlOffset = Math.abs(to.x - from.x) * 0.4;
    return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="relative w-full h-[320px] bg-background rounded-xl border border-border overflow-hidden cursor-default select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Toolbar */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1 bg-card border border-border rounded-lg shadow-sm">
          {toolbarItems.map((item, i) => (
            <div 
              key={i}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                i === 0 && "bg-primary/10"
              )}
            >
              <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <div className="px-2 py-1 bg-blue-500/10 rounded text-[10px] font-medium text-blue-600">
            <Paperclip className="w-3 h-3 inline mr-1" />
            Anexo
          </div>
          <div className="px-2 py-1 bg-green-500/10 rounded text-[10px] font-medium text-green-600">
            <Sparkles className="w-3 h-3 inline mr-1" />
            Gerador
          </div>
        </div>

        {/* Grid background */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
        />

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Attachment to Generator */}
          <motion.path
            d={createBezierPath(
              { x: attachmentNode.position.x + 180, y: attachmentNode.position.y + 50 },
              { x: generatorNode.position.x, y: generatorNode.position.y + 60 }
            )}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />
          
          {/* Generator to Result */}
          <motion.path
            d={createBezierPath(
              { x: generatorNode.position.x + 160, y: generatorNode.position.y + 60 },
              { x: resultNode.position.x, y: resultNode.position.y + 50 }
            )}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* Animated pulse on connection when generating */}
          <AnimatePresence>
            {generatorNode.data.isGenerating && (
              <motion.circle
                r="5"
                fill="hsl(var(--primary))"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <animateMotion
                  dur="1s"
                  repeatCount="indefinite"
                  path={createBezierPath(
                    { x: generatorNode.position.x + 160, y: generatorNode.position.y + 60 },
                    { x: resultNode.position.x, y: resultNode.position.y + 50 }
                  )}
                />
              </motion.circle>
            )}
          </AnimatePresence>
        </svg>

        {/* Nodes */}
        <motion.div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{ left: attachmentNode.position.x, top: attachmentNode.position.y }}
          onMouseDown={(e) => handleMouseDown(e, "attachment")}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <AttachmentNode 
            node={attachmentNode} 
            onTabChange={handleTabChange}
            isDragging={draggingId === "attachment"}
          />
        </motion.div>

        <motion.div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{ left: generatorNode.position.x, top: generatorNode.position.y }}
          onMouseDown={(e) => handleMouseDown(e, "generator")}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GeneratorNode 
            node={generatorNode} 
            onGenerate={handleGenerate}
            isDragging={draggingId === "generator"}
            connectionCount={1}
          />
        </motion.div>

        <motion.div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{ left: resultNode.position.x, top: resultNode.position.y }}
          onMouseDown={(e) => handleMouseDown(e, "result")}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ResultNode 
            node={resultNode}
            isDragging={draggingId === "result"}
          />
        </motion.div>

        {/* Animated cursor */}
        <AnimatePresence>
          {showCursor && interactionCount === 0 && (
            <motion.div
              className="absolute pointer-events-none z-30"
              initial={{ opacity: 0, x: 200, y: 200 }}
              animate={{ 
                opacity: [0, 1, 1, 1, 1],
                x: [200, 340, 340, 340, 340],
                y: [200, 180, 180, 180, 180],
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 3,
                times: [0, 0.3, 0.5, 0.8, 1],
              }}
            >
              <MousePointer2 className="w-5 h-5 text-foreground drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint text */}
        <motion.div 
          className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Arraste os nós • Clique em Gerar para ver a mágica
        </motion.div>
      </div>

      {/* Signup Dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gostou? Crie conteúdo ilimitado!
            </DialogTitle>
            <DialogDescription className="pt-2">
              Assine o plano Canvas por apenas <span className="font-semibold text-foreground">$19.90/mês</span> e transforme qualquer fonte em 10+ formatos de conteúdo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                Canvas ilimitado
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                IA multi-agente
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                10+ formatos
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                Geração de imagens
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/signup?plan=basic" className="flex-1">
                <Button className="w-full">
                  Começar agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={() => setShowSignupDialog(false)}
                className="flex-1"
              >
                Continuar explorando
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InteractiveCanvasDemo;
