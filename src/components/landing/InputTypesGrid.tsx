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
  gradient: string;
}

const inputTypes: InputType[] = [
  {
    id: "youtube",
    icon: Youtube,
    label: "YouTube",
    description: "Vídeos com transcrição automática",
    outputs: ["Thread", "Roteiro", "Resumo"],
    gradient: "from-red-500/20 to-red-500/5",
  },
  {
    id: "url",
    icon: Globe,
    label: "URL / Link",
    description: "Artigos, notícias e blogs",
    outputs: ["Carrossel", "Thread", "Post"],
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    id: "pdf",
    icon: FileText,
    label: "PDF / Docs",
    description: "Documentos e apresentações",
    outputs: ["Resumo", "Posts"],
    gradient: "from-orange-500/20 to-orange-500/5",
  },
  {
    id: "text",
    icon: Type,
    label: "Texto",
    description: "Notas, ideias e rascunhos",
    outputs: ["Multi-formato"],
    gradient: "from-green-500/20 to-green-500/5",
  },
  {
    id: "image",
    icon: Image,
    label: "Imagem",
    description: "Screenshots e referências",
    outputs: ["Descrição", "OCR"],
    gradient: "from-purple-500/20 to-purple-500/5",
  },
  {
    id: "audio",
    icon: Mic,
    label: "Áudio",
    description: "Podcasts e gravações",
    outputs: ["Transcrição"],
    gradient: "from-pink-500/20 to-pink-500/5",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export function InputTypesGrid() {
  return (
    <section className="py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px]"
        style={{
          background:
            "radial-gradient(ellipse, hsl(var(--primary) / 0.15) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
      />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header with rich animations */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm font-medium text-primary mb-4 tracking-wide uppercase"
          >
            Entradas flexíveis
          </motion.p>
          
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6"
          >
            Cole qualquer fonte.
            <br />
            <motion.span 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-muted-foreground"
            >
              Gere 10+ formatos.
            </motion.span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto"
          >
            O Canvas aceita URLs, vídeos, documentos, imagens e áudio.
          </motion.p>
        </motion.div>

        {/* Grid with staggered animations */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
        >
          {inputTypes.map((type, index) => (
            <motion.div
              key={type.id}
              variants={itemVariants}
              whileHover={{ 
                y: -8,
                scale: 1.02,
                transition: { duration: 0.25, ease: "easeOut" }
              }}
              className="group relative p-5 md:p-6 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:bg-card/80 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 overflow-hidden"
            >
              {/* Hover gradient overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                className={`absolute inset-0 bg-gradient-to-br ${type.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10`}
              />
              
              {/* Icon with animations */}
              <motion.div 
                className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors duration-300"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <type.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
              </motion.div>
              
              {/* Content */}
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                {type.label}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {type.description}
              </p>
              
              {/* Outputs with animated arrow */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    repeatType: "loop",
                    ease: "easeInOut",
                    delay: index * 0.2
                  }}
                >
                  <ArrowRight className="w-3 h-3 group-hover:text-primary transition-colors" />
                </motion.div>
                <span className="font-medium">{type.outputs.join(", ")}</span>
              </div>
              
              {/* Decorative corner glow on hover */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default InputTypesGrid;
