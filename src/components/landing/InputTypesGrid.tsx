import { motion } from "framer-motion";
import { 
  Globe, 
  Youtube, 
  FileText, 
  Type, 
  Image, 
  Mic,
  ArrowRight,
} from "lucide-react";

interface InputType {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  outputs: string[];
}

const inputTypes: InputType[] = [
  {
    id: "youtube",
    icon: Youtube,
    label: "YouTube",
    description: "Vídeos com transcrição automática",
    outputs: ["Thread", "Roteiro", "Resumo"],
  },
  {
    id: "url",
    icon: Globe,
    label: "URL / Link",
    description: "Artigos, notícias e blogs",
    outputs: ["Carrossel", "Thread", "Post"],
  },
  {
    id: "pdf",
    icon: FileText,
    label: "PDF / Docs",
    description: "Documentos e apresentações",
    outputs: ["Resumo", "Posts"],
  },
  {
    id: "text",
    icon: Type,
    label: "Texto",
    description: "Notas, ideias e rascunhos",
    outputs: ["Multi-formato"],
  },
  {
    id: "image",
    icon: Image,
    label: "Imagem",
    description: "Screenshots e referências",
    outputs: ["Descrição", "OCR"],
  },
  {
    id: "audio",
    icon: Mic,
    label: "Áudio",
    description: "Podcasts e gravações",
    outputs: ["Transcrição"],
  },
];

export function InputTypesGrid() {
  return (
    <section className="py-24 md:py-32 bg-background relative">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }} 
        />
      </div>
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header - Linear style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
            Entradas flexíveis
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
            Cole qualquer fonte.
            <br />
            <span className="text-muted-foreground">Gere 10+ formatos.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            O Canvas aceita URLs, vídeos, documentos, imagens e áudio.
          </p>
        </motion.div>

        {/* Grid - Clean cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {inputTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group p-5 md:p-6 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-200"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <type.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
              </div>
              
              {/* Content */}
              <h3 className="font-medium text-foreground mb-1">{type.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
              
              {/* Outputs */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="w-3 h-3" />
                <span>{type.outputs.join(", ")}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default InputTypesGrid;
