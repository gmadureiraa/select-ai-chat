import { memo } from 'react';
import { motion } from 'framer-motion';
import { Play, ExternalLink, FileText, Mic, Image as ImageIcon, Type, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

// Waveform animation for audio content
export const AnimatedWaveform = memo(({ 
  bars = 16, 
  color = 'bg-primary',
  className 
}: { 
  bars?: number; 
  color?: string;
  className?: string;
}) => (
  <div className={cn("flex items-center justify-center gap-0.5 h-8", className)}>
    {[...Array(bars)].map((_, i) => (
      <motion.div
        key={i}
        className={cn("w-0.5 rounded-full", color)}
        animate={{
          height: [4, 16 + Math.random() * 12, 4],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 0.6 + Math.random() * 0.4,
          repeat: Infinity,
          delay: i * 0.03,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
));
AnimatedWaveform.displayName = 'AnimatedWaveform';

// Scan effect for images and PDFs
export const ScanEffect = memo(({ 
  color = 'bg-primary/20',
  duration = 1.5 
}: { 
  color?: string;
  duration?: number;
}) => (
  <motion.div
    className={cn("absolute left-0 right-0 h-6", color)}
    animate={{ top: ["-24px", "100%"] }}
    transition={{ 
      duration, 
      repeat: Infinity, 
      repeatDelay: 0.3,
      ease: "linear"
    }}
  />
));
ScanEffect.displayName = 'ScanEffect';

// YouTube preview with pulsing play button and progress
export const YouTubePreview = memo(({ 
  title,
  isProcessing = false 
}: { 
  title?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative bg-gray-900 rounded-lg overflow-hidden">
    {/* Thumbnail effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-900/20" />
    
    {/* Play button */}
    <motion.div 
      className="flex items-center justify-center h-20"
      animate={isProcessing ? { opacity: [0.5, 1, 0.5] } : { scale: [1, 1.05, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
      </div>
    </motion.div>
    
    {/* Progress bar */}
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
      <motion.div
        className="h-full bg-red-500"
        initial={{ width: "0%" }}
        animate={{ width: isProcessing ? "100%" : "30%" }}
        transition={{ 
          duration: isProcessing ? 2 : 0.5, 
          repeat: isProcessing ? Infinity : 0,
          ease: "linear" 
        }}
      />
    </div>
    
    {/* Title overlay */}
    {title && (
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[10px] text-white/80 truncate">{title}</p>
      </div>
    )}
  </div>
));
YouTubePreview.displayName = 'YouTubePreview';

// URL/Article preview with browser chrome
export const UrlPreview = memo(({ 
  url,
  isProcessing = false 
}: { 
  url?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative bg-background/90 backdrop-blur-sm rounded-lg border border-border/50 p-2 overflow-hidden">
    {/* Browser bar */}
    <div className="flex items-center gap-1.5 mb-2">
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex items-center px-1.5">
        <Globe className="w-2 h-2 text-blue-500 mr-1" />
        {isProcessing ? (
          <motion.div
            className="h-1.5 bg-blue-500/50 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
          />
        ) : (
          <span className="text-[8px] text-muted-foreground truncate">
            {url ? new URL(url).hostname : 'url...'}
          </span>
        )}
      </div>
    </div>
    
    {/* Content skeleton */}
    <motion.div 
      className="space-y-1.5"
      animate={isProcessing ? { opacity: [0.5, 1, 0.5] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="w-full h-2 bg-blue-500/30 rounded" />
      <div className="w-3/4 h-1.5 bg-muted rounded" />
      <div className="w-1/2 h-1.5 bg-muted rounded" />
    </motion.div>
    
    {/* Scan effect when processing */}
    {isProcessing && <ScanEffect color="bg-blue-500/20" />}
  </div>
));
UrlPreview.displayName = 'UrlPreview';

// PDF preview with document styling
export const PdfPreview = memo(({ 
  fileName,
  isProcessing = false 
}: { 
  fileName?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative bg-background/90 backdrop-blur-sm rounded-lg border border-orange-500/30 p-3 overflow-hidden">
    {/* PDF badge */}
    <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-bl-lg flex items-center justify-center">
      <FileText className="w-3 h-3 text-white" />
    </div>
    
    {/* Document lines */}
    <div className="space-y-1.5 pt-1">
      <div className="w-2/3 h-2 bg-orange-500/30 rounded" />
      <div className="w-full h-1 bg-muted rounded" />
      <div className="w-full h-1 bg-muted rounded" />
      <div className="w-3/4 h-1 bg-muted rounded" />
      <div className="w-full h-1 bg-muted rounded" />
      <div className="w-1/2 h-1 bg-muted rounded" />
    </div>
    
    {/* Scan effect when processing */}
    {isProcessing && <ScanEffect color="bg-orange-500/20" />}
    
    {/* File name */}
    {fileName && (
      <p className="text-[9px] text-muted-foreground truncate mt-2">{fileName}</p>
    )}
  </div>
));
PdfPreview.displayName = 'PdfPreview';

// Image preview with scan effect
export const ImageScanPreview = memo(({ 
  imageUrl,
  isProcessing = false 
}: { 
  imageUrl?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative rounded-lg overflow-hidden bg-muted/30">
    {imageUrl ? (
      <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover" />
    ) : (
      <div className="w-full h-32 flex items-center justify-center bg-cyan-500/10">
        <ImageIcon className="w-8 h-8 text-cyan-500/50" />
      </div>
    )}
    
    {/* Scan effect when processing */}
    {isProcessing && <ScanEffect color="bg-cyan-500/30" />}
  </div>
));
ImageScanPreview.displayName = 'ImageScanPreview';

// Text preview with typing cursor
export const TextTypingPreview = memo(({ 
  text,
  isProcessing = false 
}: { 
  text?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative bg-muted/50 rounded-lg p-3 min-h-[60px]">
    <div className="flex items-start gap-1">
      <Type className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        {isProcessing ? (
          <motion.div
            className="flex items-center gap-0.5"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <span className="text-xs text-muted-foreground">Processando</span>
            <motion.span
              className="w-0.5 h-3 bg-purple-500"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </motion.div>
        ) : (
          <p className="text-xs line-clamp-3">{text || 'Texto livre...'}</p>
        )}
      </div>
    </div>
    
    {/* Blinking cursor effect */}
    {isProcessing && (
      <motion.div
        className="absolute bottom-3 right-3 w-0.5 h-4 bg-purple-500"
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    )}
  </div>
));
TextTypingPreview.displayName = 'TextTypingPreview';

// Audio preview with waveform
export const AudioPreview = memo(({ 
  fileName,
  isProcessing = false 
}: { 
  fileName?: string;
  isProcessing?: boolean;
}) => (
  <div className="relative bg-primary/10 rounded-lg p-3 overflow-hidden">
    <div className="flex items-center gap-2 mb-2">
      <motion.div
        animate={isProcessing ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <Mic className="w-4 h-4 text-primary" />
      </motion.div>
      <span className="text-xs text-primary font-medium truncate flex-1">
        {fileName || 'Áudio'}
      </span>
    </div>
    
    <AnimatedWaveform bars={20} color="bg-primary" />
    
    {/* Progress indicator */}
    {isProcessing && (
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-primary"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    )}
  </div>
));
AudioPreview.displayName = 'AudioPreview';

// Processing indicator badge
export const ProcessingBadge = memo(({ 
  status,
  type = 'default'
}: { 
  status: string;
  type?: 'youtube' | 'url' | 'pdf' | 'image' | 'audio' | 'text' | 'default';
}) => {
  const colors = {
    youtube: 'bg-muted text-muted-foreground',
    url: 'bg-muted text-muted-foreground',
    pdf: 'bg-muted text-muted-foreground',
    image: 'bg-muted text-muted-foreground',
    audio: 'bg-muted text-muted-foreground',
    text: 'bg-muted text-muted-foreground',
    default: 'bg-muted text-muted-foreground'
  };
  
  return (
    <motion.div
      className={cn("text-xs px-2 py-1 rounded-full flex items-center gap-1.5", colors[type])}
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-current"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      {status}
    </motion.div>
  );
});
ProcessingBadge.displayName = 'ProcessingBadge';

// Type badge with consistent coloring
export const TypeBadge = memo(({ 
  type 
}: { 
  type: 'youtube' | 'url' | 'pdf' | 'image' | 'audio' | 'text' | 'instagram';
}) => {
  const config = {
    youtube: { color: 'bg-muted text-muted-foreground', icon: Play, label: 'YouTube' },
    url: { color: 'bg-muted text-muted-foreground', icon: Globe, label: 'URL' },
    pdf: { color: 'bg-muted text-muted-foreground', icon: FileText, label: 'PDF' },
    image: { color: 'bg-muted text-muted-foreground', icon: ImageIcon, label: 'Imagem' },
    audio: { color: 'bg-muted text-muted-foreground', icon: Mic, label: 'Áudio' },
    text: { color: 'bg-muted text-muted-foreground', icon: Type, label: 'Texto' },
    instagram: { color: 'bg-muted text-muted-foreground', icon: ImageIcon, label: 'Instagram' },
  };
  
  const { color, icon: Icon, label } = config[type] || config.text;
  
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1", color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
});
TypeBadge.displayName = 'TypeBadge';
