import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Twitter, 
  Instagram, 
  Linkedin, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Bookmark,
  ThumbsUp
} from "lucide-react";
import { ContentTypeKey, CONTENT_TO_PLATFORM } from "@/types/contentTypes";
import { detectCarousel } from "@/lib/postDetection";
import type { CarouselSlide } from "@/components/posts/CarouselEditor";

interface ContentPreviewProps {
  content: string;
  contentType: ContentTypeKey;
  mediaUrls?: string[];
  authorName?: string;
  authorHandle?: string;
  className?: string;
}

const platformIcons: Record<string, typeof Twitter | undefined> = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
};

const platformLabels: Record<string, string> = {
  twitter: "X/Twitter",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
  blog: "Blog",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Preview",
};

// Twitter/X Preview
function TwitterPreview({ 
  content, 
  mediaUrls, 
  authorName, 
  authorHandle 
}: { 
  content: string; 
  mediaUrls?: string[]; 
  authorName: string; 
  authorHandle: string;
}) {
  const isOverLimit = content.length > 280;
  
  return (
    <div className="bg-card rounded-xl border border-border p-4 max-w-md">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-foreground">{authorName}</span>
            <span className="text-muted-foreground text-sm">{authorHandle}</span>
            <span className="text-muted-foreground text-sm">· agora</span>
          </div>
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
            {content}
          </p>
          {mediaUrls && mediaUrls.length > 0 && (
            <div className={cn(
              "mt-3 rounded-xl overflow-hidden border border-border grid gap-0.5",
              mediaUrls.length === 1 && "grid-cols-1",
              mediaUrls.length === 2 && "grid-cols-2",
              mediaUrls.length >= 3 && "grid-cols-2"
            )}>
              {mediaUrls.slice(0, 4).map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  alt="" 
                  className={cn(
                    "w-full object-cover",
                    mediaUrls.length === 1 ? "h-48" : "h-32"
                  )} 
                />
              ))}
            </div>
          )}
          {/* Actions */}
          <div className="flex items-center justify-between mt-3 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Heart className="h-4 w-4" />
            <Bookmark className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
      {/* Character count */}
      <div className="mt-2 text-right">
        <span className={cn("text-xs", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
          {content.length}/280
        </span>
      </div>
    </div>
  );
}

// LinkedIn Preview
function LinkedInPreview({ 
  content, 
  mediaUrls, 
  authorName 
}: { 
  content: string; 
  mediaUrls?: string[]; 
  authorName: string;
}) {
  const isOverLimit = content.length > 3000;
  
  return (
    <div className="bg-card rounded-xl border border-border p-4 max-w-md">
      <div className="flex gap-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarFallback className="bg-blue-500/10 text-blue-600 text-sm font-semibold">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm text-foreground">{authorName}</span>
            <span className="text-muted-foreground text-xs">• 1º</span>
          </div>
          <p className="text-xs text-muted-foreground">Cargo na Empresa</p>
          <p className="text-xs text-muted-foreground">agora • 🌐</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
      
      <p className="text-sm text-foreground mt-3 whitespace-pre-wrap break-words">
        {content.length > 300 ? content.substring(0, 300) + "... ver mais" : content}
      </p>
      
      {mediaUrls && mediaUrls.length > 0 && (
        <div className="mt-3 -mx-4 border-t border-b border-border">
          <img src={mediaUrls[0]} alt="" className="w-full h-48 object-cover" />
        </div>
      )}
      
      {/* Reactions */}
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <div className="flex -space-x-1">
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <ThumbsUp className="h-2.5 w-2.5 text-white" />
          </div>
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <Heart className="h-2.5 w-2.5 text-white" />
          </div>
        </div>
        <span>42</span>
        <span className="ml-auto">3 comentários</span>
      </div>
      
      <div className="mt-2 pt-2 border-t border-border flex justify-around">
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 h-8">
          <ThumbsUp className="h-4 w-4" />
          Gostei
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 h-8">
          <MessageCircle className="h-4 w-4" />
          Comentar
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 h-8">
          <Repeat2 className="h-4 w-4" />
          Repostar
        </Button>
      </div>
      
      <div className="mt-2 text-right">
        <span className={cn("text-xs", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
          {content.length}/3000
        </span>
      </div>
    </div>
  );
}

// Instagram Post Preview
function InstagramPreview({ 
  content, 
  mediaUrls, 
  authorName, 
  authorHandle 
}: { 
  content: string; 
  mediaUrls?: string[]; 
  authorName: string;
  authorHandle: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border max-w-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8 ring-2 ring-pink-500/50 ring-offset-2 ring-offset-background">
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-sm">{authorHandle.replace('@', '')}</span>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground ml-auto" />
      </div>
      
      {/* Image */}
      {mediaUrls && mediaUrls.length > 0 ? (
        <div className="aspect-square bg-muted">
          <img src={mediaUrls[0]} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <Instagram className="h-12 w-12 text-muted-foreground/50" />
        </div>
      )}
      
      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6 ml-auto" />
        </div>
        <p className="mt-2 text-sm font-semibold">256 curtidas</p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{authorHandle.replace('@', '')}</span>{' '}
          <span className="whitespace-pre-wrap break-words">
            {content.length > 150 ? content.substring(0, 150) + "..." : content}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Ver todos os 12 comentários</p>
      </div>
    </div>
  );
}

// Carousel Preview
function CarouselPreview({ 
  slides,
  authorHandle 
}: { 
  slides: CarouselSlide[];
  authorHandle: string;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const goNext = () => setCurrentSlide(i => Math.min(i + 1, slides.length - 1));
  const goPrev = () => setCurrentSlide(i => Math.max(i - 1, 0));
  
  const slide = slides[currentSlide];
  
  return (
    <div className="bg-card rounded-xl border border-border max-w-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8 ring-2 ring-pink-500/50 ring-offset-2 ring-offset-background">
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
            {authorHandle.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-sm">{authorHandle.replace('@', '')}</span>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground ml-auto" />
      </div>
      
      {/* Slide */}
      <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/5 to-primary/10 p-6 flex flex-col">
        {/* Navigation buttons */}
        {currentSlide > 0 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {currentSlide < slides.length - 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        {/* Slide content */}
        <div className="flex-1 flex flex-col justify-center">
          <Badge variant="outline" className="w-fit mb-2 text-[10px]">
            {slide?.type === 'hook' ? 'Gancho' : slide?.type === 'cta' ? 'CTA' : 'Conteúdo'}
          </Badge>
          <h3 className="text-lg font-bold text-foreground mb-2">{slide?.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{slide?.content}</p>
        </div>
        
        {/* Dots */}
        <div className="flex items-center justify-center gap-1 mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i === currentSlide ? "bg-primary" : "bg-muted-foreground/30"
              )}
              onClick={() => setCurrentSlide(i)}
            />
          ))}
        </div>
      </div>
      
      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6 ml-auto" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Slide {currentSlide + 1} de {slides.length}
        </p>
      </div>
    </div>
  );
}

export function ContentPreview({
  content,
  contentType,
  mediaUrls = [],
  authorName = "Seu Nome",
  authorHandle = "@seuhandle",
  className
}: ContentPreviewProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!content.trim()) {
    return null;
  }
  
  const platform = CONTENT_TO_PLATFORM[contentType];
  const Icon = (platform && platformIcons[platform]) || Eye;
  const label = (platform && platformLabels[platform]) || 'Preview';
  
  // Detect carousel from content
  const carouselData = contentType === 'carousel' ? detectCarousel(content) : null;
  
  const renderPreview = () => {
    // Carousel
    if (contentType === 'carousel' && carouselData?.slides && carouselData.slides.length > 0) {
      return <CarouselPreview slides={carouselData.slides} authorHandle={authorHandle} />;
    }
    
    // Platform-specific previews
    switch (platform) {
      case 'twitter':
        return (
          <TwitterPreview 
            content={content} 
            mediaUrls={mediaUrls} 
            authorName={authorName} 
            authorHandle={authorHandle} 
          />
        );
      case 'linkedin':
        return (
          <LinkedInPreview 
            content={content} 
            mediaUrls={mediaUrls} 
            authorName={authorName} 
          />
        );
      case 'instagram':
        return (
          <InstagramPreview 
            content={content} 
            mediaUrls={mediaUrls} 
            authorName={authorName}
            authorHandle={authorHandle} 
          />
        );
      default:
        // Generic preview for other content types
        return (
          <div className="bg-card rounded-xl border border-border p-4 max-w-md">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {content.substring(0, 500)}{content.length > 500 && '...'}
            </p>
            {mediaUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {mediaUrls.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" className="rounded-lg h-24 w-full object-cover" />
                ))}
              </div>
            )}
          </div>
        );
    }
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Preview: {label}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {isVisible ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>
      
      {isVisible && (
        <div className="flex justify-center">
          {renderPreview()}
        </div>
      )}
    </div>
  );
}