import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Sparkles, 
  Instagram, 
  Twitter, 
  Linkedin,
  Play,
  GripVertical,
  ArrowRight
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

interface Node {
  id: string;
  type: "source" | "ai" | "output";
  label: string;
  icon: React.ElementType;
  position: { x: number; y: number };
  color: string;
}

const initialNodes: Node[] = [
  {
    id: "source",
    type: "source",
    label: "URL do YouTube",
    icon: FileText,
    position: { x: 50, y: 120 },
    color: "from-blue-500/20 to-violet-500/20",
  },
  {
    id: "ai",
    type: "ai",
    label: "IA Multi-Agente",
    icon: Sparkles,
    position: { x: 280, y: 100 },
    color: "from-primary to-primary/80",
  },
  {
    id: "output1",
    type: "output",
    label: "Carrossel",
    icon: Instagram,
    position: { x: 520, y: 30 },
    color: "from-pink-500/20 to-rose-500/20",
  },
  {
    id: "output2",
    type: "output",
    label: "Thread",
    icon: Twitter,
    position: { x: 520, y: 110 },
    color: "from-sky-500/20 to-blue-500/20",
  },
  {
    id: "output3",
    type: "output",
    label: "Artigo",
    icon: Linkedin,
    position: { x: 520, y: 190 },
    color: "from-blue-600/20 to-indigo-500/20",
  },
];

const InteractiveCanvasDemo = () => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const nodeStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingId(nodeId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    nodeStartPos.current = { ...node.position };
    
    setInteractionCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setTimeout(() => setShowSignupDialog(true), 500);
      }
      return newCount;
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !dragStartPos.current || !nodeStartPos.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    const newX = Math.max(0, Math.min(containerRect.width - 140, nodeStartPos.current.x + deltaX));
    const newY = Math.max(0, Math.min(containerRect.height - 60, nodeStartPos.current.y + deltaY));

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

  const handleGenerateClick = () => {
    setShowSignupDialog(true);
  };

  const getNodeCenter = (node: Node) => ({
    x: node.position.x + 70,
    y: node.position.y + 25,
  });

  const sourceNode = nodes.find(n => n.id === "source")!;
  const aiNode = nodes.find(n => n.id === "ai")!;
  const outputNodes = nodes.filter(n => n.type === "output");

  return (
    <>
      <div 
        ref={containerRef}
        className="relative w-full h-[300px] md:h-[280px] bg-muted/30 rounded-xl border border-border overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid background */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
        />

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Source to AI */}
          <motion.path
            d={`M ${getNodeCenter(sourceNode).x + 40} ${getNodeCenter(sourceNode).y} 
                Q ${(getNodeCenter(sourceNode).x + getNodeCenter(aiNode).x) / 2} ${getNodeCenter(sourceNode).y}
                  ${getNodeCenter(aiNode).x - 50} ${getNodeCenter(aiNode).y}`}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="6 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />
          
          {/* AI to outputs */}
          {outputNodes.map((output, index) => (
            <motion.path
              key={output.id}
              d={`M ${getNodeCenter(aiNode).x + 50} ${getNodeCenter(aiNode).y} 
                  Q ${(getNodeCenter(aiNode).x + getNodeCenter(output).x) / 2 + 20} ${getNodeCenter(output).y}
                    ${getNodeCenter(output).x - 50} ${getNodeCenter(output).y}`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray="6 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            />
          ))}

          {/* Animated pulse on connections */}
          <motion.circle
            r="4"
            fill="hsl(var(--primary))"
            animate={{
              cx: [getNodeCenter(sourceNode).x + 40, getNodeCenter(aiNode).x - 50],
              cy: [getNodeCenter(sourceNode).y, getNodeCenter(aiNode).y],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            className={`absolute flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg cursor-grab active:cursor-grabbing transition-shadow ${
              node.type === "ai" 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-card border-border hover:border-primary/50 hover:shadow-primary/10"
            } ${draggingId === node.id ? "shadow-xl z-20" : "z-10"}`}
            style={{
              left: node.position.x,
              top: node.position.y,
              width: node.type === "ai" ? "140px" : "120px",
            }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: nodes.indexOf(node) * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <GripVertical className="w-3 h-3 opacity-40" />
            <node.icon className={`w-4 h-4 shrink-0 ${node.type === "ai" ? "" : "text-primary"}`} />
            <span className="text-xs font-medium truncate">{node.label}</span>
          </motion.div>
        ))}

        {/* Generate button on AI node */}
        <motion.div
          className="absolute z-30"
          style={{
            left: aiNode.position.x + 20,
            top: aiNode.position.y + 55,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="sm"
            onClick={handleGenerateClick}
            className="h-7 px-3 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-lg"
          >
            <Play className="w-3 h-3 mr-1" />
            Gerar
          </Button>
        </motion.div>

        {/* Hint text */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border">
          Arraste os nós para explorar o canvas
        </div>
      </div>

      {/* Signup Dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Pronto para criar conteúdo com IA?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Para gerar conteúdo, crie sua conta e assine o plano Canvas por apenas <span className="font-semibold text-foreground">$19.90/mês</span>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Canvas de criação ilimitado
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                IA multi-agente especialista
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Templates para todos formatos
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Geração de imagens
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/signup?plan=basic" className="flex-1">
                <Button className="w-full">
                  Criar conta e assinar
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
