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
  BookOpen,
  Play
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
  gradientFrom: string;
  gradientTo: string;
  size: "large" | "medium" | "full";
}

const inputTypes: InputType[] = [
  {
    id: "url",
    icon: Globe,
    label: "URL / Link",
    description: "Cole qualquer link de artigo, notícia ou blog e transforme em conteúdo",
    example: "medium.com, substack, blogs",
    outputs: ["Carrossel", "Thread", "Post"],
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    gradientFrom: "from-blue-500/20",
    gradientTo: "to-blue-600/5",
    size: "large",
  },
  {
    id: "youtube",
    icon: Youtube,
    label: "YouTube",
    description: "Vídeos com transcrição automática",
    example: "youtube.com/watch?v=...",
    outputs: ["Thread", "Roteiro", "Resumo"],
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    gradientFrom: "from-red-500/20",
    gradientTo: "to-red-600/5",
    size: "medium",
  },
  {
    id: "pdf",
    icon: FileText,
    label: "PDF / Docs",
    description: "Documentos, apresentações e arquivos de qualquer tipo",
    example: ".pdf, .docx, .pptx",
    outputs: ["Resumo", "Posts", "Artigo"],
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    gradientFrom: "from-orange-500/20",
    gradientTo: "to-orange-600/5",
    size: "large",
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
    gradientFrom: "from-purple-500/20",
    gradientTo: "to-purple-600/5",
    size: "medium",
  },
  {
    id: "image",
    icon: Image,
    label: "Imagem",
    description: "Screenshots, fotos, designs e referências visuais",
    example: ".jpg, .png, .webp",
    outputs: ["Descrição", "OCR", "Análise"],
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    gradientFrom: "from-cyan-500/20",
    gradientTo: "to-cyan-600/5",
    size: "medium",
  },
  {
    id: "audio",
    icon: Mic,
    label: "Áudio",
    description: "Podcasts, gravações de reuniões, notas de voz e entrevistas transformados em conteúdo escrito",
    example: ".mp3, .wav, .m4a",
    outputs: ["Transcrição", "Resumo", "Thread"],
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    gradientFrom: "from-green-500/20",
    gradientTo: "to-green-600/5",
    size: "full",
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

// Animated waveform for audio card
const AnimatedWaveform = () => (
  <div className="flex items-center gap-0.5 h-8">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="w-1 bg-green-500/60 rounded-full"
        animate={{
          height: [8, 20 + Math.random() * 12, 8],
        }}
        transition={{
          duration: 0.8 + Math.random() * 0.4,
          repeat: Infinity,
          delay: i * 0.05,
        }}
      />
    ))}
  </div>
);

// Mini preview for URL card
const UrlPreview = () => (
  <div className="absolute top-4 right-4 w-24 h-16 bg-background/80 backdrop-blur rounded-lg border border-border/50 p-2 shadow-lg">
    <div className="w-full h-2 bg-blue-500/30 rounded mb-1.5" />
    <div className="w-3/4 h-1.5 bg-muted rounded mb-1" />
    <div className="w-1/2 h-1.5 bg-muted rounded" />
  </div>
);

// Mini preview for YouTube card
const YoutubePreview = () => (
  <div className="absolute top-3 right-3 w-16 h-10 bg-background/80 backdrop-blur rounded-lg border border-border/50 shadow-lg flex items-center justify-center">
    <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
      <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
    </div>
  </div>
);

// Mini preview for PDF card
const PdfPreview = () => (
  <div className="absolute top-4 right-4 w-20 h-24 bg-background/80 backdrop-blur rounded-lg border border-border/50 p-2 shadow-lg">
    <div className="w-full h-1.5 bg-orange-500/30 rounded mb-1" />
    <div className="w-full h-1 bg-muted rounded mb-1" />
    <div className="w-full h-1 bg-muted rounded mb-1" />
    <div className="w-3/4 h-1 bg-muted rounded mb-2" />
    <div className="w-full h-1 bg-muted rounded mb-1" />
    <div className="w-full h-1 bg-muted rounded mb-1" />
    <div className="w-1/2 h-1 bg-muted rounded" />
  </div>
);

export function InputTypesGrid() {
  return (
    <section className="py-28 bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 text-primary text-sm font-medium mb-5">
            Flexibilidade total
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5">
            Cole qualquer fonte.{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Gere 10+ formatos.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            O Canvas aceita URLs, vídeos, documentos, imagens e áudio. 
            A IA transforma tudo em conteúdo pronto para publicar.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {inputTypes.map((type, index) => {
            const gridClass = 
              type.size === "full" ? "lg:col-span-4 md:col-span-2" :
              type.size === "large" ? "lg:col-span-2" :
              "lg:col-span-1";
            
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                className={`group relative bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} border border-border/50 rounded-2xl p-6 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden ${gridClass}`}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${type.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <type.icon className={`w-6 h-6 ${type.color}`} />
                  </div>
                  
                  {/* Header */}
                  <h3 className="font-bold text-lg text-foreground mb-2">{type.label}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{type.description}</p>
                  
                  {/* Example */}
                  <div className="text-xs text-muted-foreground/70 mb-4 font-mono bg-background/50 backdrop-blur px-3 py-1.5 rounded-lg inline-block border border-border/30">
                    {type.example}
                  </div>
                  
                  {/* Outputs */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border/30">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1.5">
                      {type.outputs.map((output) => (
                        <span
                          key={output}
                          className={`text-xs px-2.5 py-1 rounded-full ${type.bgColor} ${type.color} font-medium`}
                        >
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Visual previews */}
                {type.id === "url" && <UrlPreview />}
                {type.id === "youtube" && <YoutubePreview />}
                {type.id === "pdf" && <PdfPreview />}
                {type.id === "audio" && (
                  <div className="absolute bottom-6 right-6">
                    <AnimatedWaveform />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Output Formats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-2xl p-8 backdrop-blur"
        >
          <div className="text-center mb-6">
            <span className="text-sm text-muted-foreground">Formatos de saída gerados pela IA</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {outputFormats.map((format, index) => (
              <motion.div
                key={format.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + index * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-background border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
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
