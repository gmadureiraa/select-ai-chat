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
    <section className="py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-10"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--primary)) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
      />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header with animations */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-sm font-medium text-primary mb-4 tracking-wide uppercase"
          >
            Entradas flexíveis
          </motion.p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
            Cole qualquer fonte.
            <br />
            <span className="text-muted-foreground">Gere 10+ formatos.</span>
          </h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto"
          >
            O Canvas aceita URLs, vídeos, documentos, imagens e áudio.
          </motion.p>
        </motion.div>

        {/* Grid with staggered animations */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {inputTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.5,
                delay: index * 0.08,
                ease: "easeOut"
              }}
              whileHover={{ 
                y: -4,
                transition: { duration: 0.2 }
              }}
              className="group p-5 md:p-6 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              {/* Icon with hover animation */}
              <motion.div 
                className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors duration-300"
                whileHover={{ scale: 1.05 }}
              >
                <type.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
              </motion.div>
              
              {/* Content */}
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">{type.label}</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{type.description}</p>
              
              {/* Outputs with arrow animation */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                <motion.div
                  className="group-hover:translate-x-1 transition-transform duration-300"
                >
                  <ArrowRight className="w-3 h-3" />
                </motion.div>
                <span className="font-medium">{type.outputs.join(", ")}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default InputTypesGrid;
