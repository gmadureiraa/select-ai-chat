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
  Play,
  ExternalLink,
  FileType
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

// Enhanced animated waveform for audio card
const AnimatedWaveform = () => (
  <div className="flex items-center gap-0.5 h-10">
    {[...Array(24)].map((_, i) => (
      <motion.div
        key={i}
        className="w-1 rounded-full"
        style={{
          background: `linear-gradient(to top, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.8))`,
        }}
        animate={{
          height: [6, 24 + Math.random() * 16, 6],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 0.6 + Math.random() * 0.4,
          repeat: Infinity,
          delay: i * 0.04,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// Animated URL typing preview
const UrlPreview = () => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.3 }}
    className="absolute top-4 right-4 w-32 h-20 bg-background/90 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-xl overflow-hidden"
  >
    {/* Browser bar */}
    <div className="flex items-center gap-1.5 mb-2">
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500/30 rounded-full flex items-center px-1"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        >
          <ExternalLink className="w-2 h-2 text-blue-500" />
        </motion.div>
      </div>
    </div>
    {/* Content skeleton */}
    <motion.div 
      className="space-y-1"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="w-full h-1.5 bg-blue-500/30 rounded" />
      <div className="w-3/4 h-1 bg-muted rounded" />
      <div className="w-1/2 h-1 bg-muted rounded" />
    </motion.div>
  </motion.div>
);

// Animated YouTube preview with progress bar
const YoutubePreview = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.2 }}
    className="absolute top-3 right-3 w-20 h-14 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-border/50 shadow-xl overflow-hidden"
  >
    {/* Thumbnail effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent" />
    
    {/* Play button */}
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
      </div>
    </motion.div>
    
    {/* Progress bar */}
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
      <motion.div
        className="h-full bg-red-500"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </div>
  </motion.div>
);

// Animated PDF with page flip
const PdfPreview = () => (
  <motion.div 
    initial={{ opacity: 0, rotateY: -20 }}
    animate={{ opacity: 1, rotateY: 0 }}
    transition={{ delay: 0.2 }}
    className="absolute top-4 right-4 w-20 h-26 perspective-1000"
  >
    <div className="relative w-full h-24 bg-background/90 backdrop-blur-sm rounded-lg border border-border/50 p-2 shadow-xl">
      {/* PDF icon corner */}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-bl-lg flex items-center justify-center">
        <FileType className="w-2.5 h-2.5 text-white" />
      </div>
      
      {/* Page content with scan effect */}
      <div className="space-y-1 relative overflow-hidden">
        <div className="w-full h-1.5 bg-orange-500/30 rounded" />
        <div className="w-full h-1 bg-muted rounded" />
        <div className="w-full h-1 bg-muted rounded" />
        <div className="w-3/4 h-1 bg-muted rounded" />
        <div className="w-full h-1 bg-muted rounded" />
        <div className="w-2/3 h-1 bg-muted rounded" />
        
        {/* Scanning line effect */}
        <motion.div
          className="absolute left-0 right-0 h-4 bg-gradient-to-b from-orange-500/20 to-transparent"
          animate={{ top: ["-16px", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
        />
      </div>
    </div>
  </motion.div>
);

// Animated text typing
const TextPreview = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="absolute top-4 right-4 w-24 h-16 bg-background/90 backdrop-blur-sm rounded-lg border border-border/50 p-2 shadow-xl overflow-hidden"
  >
    <motion.div
      className="font-mono text-[8px] text-purple-500/70 leading-relaxed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        animate={{ opacity: [0, 1] }}
        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 0.2 }}
      >
        Ideias...
      </motion.span>
    </motion.div>
    <motion.div
      className="w-0.5 h-3 bg-purple-500 inline-block ml-1"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  </motion.div>
);

// Animated image preview with scan
const ImagePreview = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl border border-border/50 shadow-xl overflow-hidden"
  >
    <div className="absolute inset-2 border-2 border-dashed border-cyan-500/30 rounded-lg flex items-center justify-center">
      <Image className="w-5 h-5 text-cyan-500/50" />
    </div>
    
    {/* Scan effect */}
    <motion.div
      className="absolute left-0 right-0 h-8 bg-gradient-to-b from-cyan-500/30 to-transparent"
      animate={{ top: ["-32px", "64px"] }}
      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
    />
  </motion.div>
);

// Floating particles component
const FloatingParticles = ({ color }: { color: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className={`absolute w-1 h-1 rounded-full ${color} opacity-40`}
        style={{
          left: `${20 + i * 15}%`,
          top: `${30 + (i % 3) * 20}%`,
        }}
        animate={{
          y: [-10, 10, -10],
          x: [-5, 5, -5],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 3 + i * 0.5,
          repeat: Infinity,
          delay: i * 0.3,
        }}
      />
    ))}
  </div>
);

export function InputTypesGrid() {
  return (
    <section className="py-28 bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
      </div>
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span 
            className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 text-primary text-sm font-medium mb-5"
            animate={{ boxShadow: ["0 0 20px 0 rgba(var(--primary-rgb), 0)", "0 0 20px 5px rgba(var(--primary-rgb), 0.1)", "0 0 20px 0 rgba(var(--primary-rgb), 0)"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Flexibilidade total
          </motion.span>
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
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  delay: index * 0.1, 
                  duration: 0.5,
                  type: "spring",
                  stiffness: 100 
                }}
                whileHover={{ 
                  y: -8, 
                  scale: 1.02,
                  transition: { duration: 0.3 }
                }}
                className={`group relative bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} border border-border/50 rounded-2xl p-6 hover:border-primary/40 transition-all duration-500 overflow-hidden ${gridClass}`}
              >
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "200%" }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                
                {/* Floating particles */}
                <FloatingParticles color={type.bgColor.replace('/10', '')} />
                
                {/* Glow effect */}
                <div className={`absolute -inset-1 bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} opacity-0 group-hover:opacity-60 transition-opacity duration-500 blur-2xl`} />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Icon with pulse animation */}
                  <motion.div 
                    className={`w-12 h-12 rounded-xl ${type.bgColor} flex items-center justify-center mb-4 relative`}
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <type.icon className={`w-6 h-6 ${type.color}`} />
                    {/* Pulse ring */}
                    <motion.div
                      className={`absolute inset-0 rounded-xl ${type.bgColor}`}
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  
                  {/* Header */}
                  <h3 className="font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">{type.label}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{type.description}</p>
                  
                  {/* Example with hover effect */}
                  <motion.div 
                    className="text-xs text-muted-foreground/70 mb-4 font-mono bg-background/50 backdrop-blur px-3 py-1.5 rounded-lg inline-block border border-border/30"
                    whileHover={{ scale: 1.05, borderColor: "hsl(var(--primary) / 0.3)" }}
                  >
                    {type.example}
                  </motion.div>
                  
                  {/* Outputs with stagger animation */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border/30">
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </motion.div>
                    <div className="flex flex-wrap gap-1.5">
                      {type.outputs.map((output, i) => (
                        <motion.span
                          key={output}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          whileHover={{ scale: 1.1 }}
                          className={`text-xs px-2.5 py-1 rounded-full ${type.bgColor} ${type.color} font-medium cursor-default`}
                        >
                          {output}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Visual previews */}
                {type.id === "url" && <UrlPreview />}
                {type.id === "youtube" && <YoutubePreview />}
                {type.id === "pdf" && <PdfPreview />}
                {type.id === "text" && <TextPreview />}
                {type.id === "image" && <ImagePreview />}
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
          className="relative bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 rounded-2xl p-8 backdrop-blur overflow-hidden"
        >
          {/* Animated border glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)",
              backgroundSize: "200% 100%",
            }}
            animate={{
              backgroundPosition: ["200% 0", "-200% 0"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          
          <div className="relative z-10">
            <div className="text-center mb-6">
              <motion.span 
                className="text-sm text-muted-foreground"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Formatos de saída gerados pela IA
              </motion.span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {outputFormats.map((format, index) => (
                <motion.div
                  key={format.label}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ 
                    delay: 0.6 + index * 0.08,
                    type: "spring",
                    stiffness: 150
                  }}
                  whileHover={{ 
                    scale: 1.08, 
                    y: -4,
                    boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.3)"
                  }}
                  className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-background border border-border hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <format.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  </motion.div>
                  <span className="text-sm font-medium text-foreground">{format.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default InputTypesGrid;
