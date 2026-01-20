import { motion } from "framer-motion";
import { 
  Globe, 
  Youtube, 
  FileText, 
  Type, 
  Image, 
  Mic,
  ArrowRight,
  LayoutGrid,
  MessageSquare,
  FileEdit,
  Sparkles,
  ScanText,
  BookOpen
} from "lucide-react";

interface InputType {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  example: string;
  outputs: string[];
  color: string;
  bgColor: string;
}

const inputTypes: InputType[] = [
  {
    id: "url",
    icon: Globe,
    label: "URL / Link",
    description: "Cole qualquer link de artigo, notícia ou blog",
    example: "medium.com, substack, blogs",
    outputs: ["Carrossel", "Thread", "Post"],
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "youtube",
    icon: Youtube,
    label: "YouTube",
    description: "Vídeos do YouTube com transcrição automática",
    example: "youtube.com/watch?v=...",
    outputs: ["Thread", "Roteiro", "Resumo"],
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "pdf",
    icon: FileText,
    label: "PDF / Docs",
    description: "Documentos, apresentações e arquivos",
    example: ".pdf, .docx, .pptx",
    outputs: ["Resumo", "Posts", "Artigo"],
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "text",
    icon: Type,
    label: "Texto Livre",
    description: "Cole ou digite qualquer texto como base",
    example: "Notas, ideias, rascunhos",
    outputs: ["Multi-formato", "Série"],
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "image",
    icon: Image,
    label: "Imagem",
    description: "Screenshots, fotos, designs e referências",
    example: ".jpg, .png, .webp",
    outputs: ["Descrição", "OCR", "Análise"],
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    id: "audio",
    icon: Mic,
    label: "Áudio",
    description: "Podcasts, gravações e notas de voz",
    example: ".mp3, .wav, .m4a",
    outputs: ["Transcrição", "Resumo", "Thread"],
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

const outputFormats = [
  { icon: LayoutGrid, label: "Carrossel" },
  { icon: MessageSquare, label: "Thread" },
  { icon: FileEdit, label: "Artigo" },
  { icon: Sparkles, label: "Roteiro" },
  { icon: ScanText, label: "Newsletter" },
  { icon: BookOpen, label: "Stories" },
];

export function InputTypesGrid() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Subtle gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm mb-4">
            Flexibilidade total
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Cole qualquer fonte. Gere 10+ formatos.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            O Canvas aceita URLs, vídeos, documentos, imagens e áudio. 
            A IA transforma tudo em conteúdo pronto para publicar.
          </p>
        </motion.div>

        {/* Input Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {inputTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg ${type.bgColor} flex items-center justify-center mb-4`}>
                <type.icon className={`w-5 h-5 ${type.color}`} />
              </div>
              
              {/* Content */}
              <h3 className="font-semibold text-foreground mb-1">{type.label}</h3>
              <p className="text-sm text-muted-foreground mb-3">{type.description}</p>
              
              {/* Example */}
              <div className="text-xs text-muted-foreground/70 mb-3 font-mono bg-muted/50 px-2 py-1 rounded inline-block">
                {type.example}
              </div>
              
              {/* Outputs */}
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/50">
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {type.outputs.map((output) => (
                    <span
                      key={output}
                      className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                    >
                      {output}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Output Formats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 border border-border rounded-2xl p-6"
        >
          <div className="text-center mb-4">
            <span className="text-sm text-muted-foreground">Formatos de saída gerados pela IA</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {outputFormats.map((format, index) => (
              <motion.div
                key={format.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/30 transition-colors"
              >
                <format.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{format.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default InputTypesGrid;
