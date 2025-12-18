import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  FileDown,
  Archive,
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { motion, Reorder, useDragControls } from "framer-motion";

export interface CarouselSlide {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  type?: "hook" | "content" | "cta";
}

interface CarouselEditorProps {
  slides: CarouselSlide[];
  onSlidesChange?: (slides: CarouselSlide[]) => void;
  authorName?: string;
  authorHandle?: string;
  className?: string;
}

const slideTypeConfig = {
  hook: { label: "Gancho", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  content: { label: "Conteúdo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  cta: { label: "CTA", color: "bg-green-500/10 text-green-500 border-green-500/20" },
};

const SlideCard = ({
  slide,
  index,
  isActive,
  isEditing,
  onSelect,
  onUpdate,
  onDelete,
}: {
  slide: CarouselSlide;
  index: number;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CarouselSlide>) => void;
  onDelete: () => void;
}) => {
  const dragControls = useDragControls();
  const slideType = slide.type || "content";
  const typeConfig = slideTypeConfig[slideType];

  return (
    <Reorder.Item
      value={slide}
      dragListener={false}
      dragControls={dragControls}
      className="touch-none"
    >
      <motion.div
        layout
        className={cn(
          "relative rounded-lg border-2 p-3 cursor-pointer transition-all",
          isActive
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border bg-card hover:border-primary/50"
        )}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="ml-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5">
                {index + 1}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] h-5", typeConfig.color)}>
                {typeConfig.label}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {slide.imageUrl && (
            <div className="aspect-square rounded-md overflow-hidden mb-2 bg-muted">
              <img
                src={slide.imageUrl}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <p className="text-xs font-medium text-foreground line-clamp-1">
            {slide.title || "Sem título"}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
            {slide.content || "Sem conteúdo"}
          </p>
        </div>
      </motion.div>
    </Reorder.Item>
  );
};

export const CarouselEditor = ({
  slides: initialSlides,
  onSlidesChange,
  authorName,
  authorHandle,
  className,
}: CarouselEditorProps) => {
  const [slides, setSlides] = useState<CarouselSlide[]>(initialSlides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { toast } = useToast();

  const activeSlide = slides[activeIndex];

  const handleReorder = useCallback((newOrder: CarouselSlide[]) => {
    setSlides(newOrder);
    onSlidesChange?.(newOrder);
  }, [onSlidesChange]);

  const handleUpdateSlide = useCallback((index: number, updates: Partial<CarouselSlide>) => {
    const newSlides = slides.map((s, i) => (i === index ? { ...s, ...updates } : s));
    setSlides(newSlides);
    onSlidesChange?.(newSlides);
  }, [slides, onSlidesChange]);

  const handleAddSlide = useCallback(() => {
    const newSlide: CarouselSlide = {
      id: `slide-${Date.now()}`,
      title: `Slide ${slides.length + 1}`,
      content: "",
      type: "content",
    };
    const newSlides = [...slides, newSlide];
    setSlides(newSlides);
    onSlidesChange?.(newSlides);
    setActiveIndex(newSlides.length - 1);
  }, [slides, onSlidesChange]);

  const handleDeleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) {
      toast({ description: "O carrossel precisa ter pelo menos 1 slide", variant: "destructive" });
      return;
    }
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    onSlidesChange?.(newSlides);
    if (activeIndex >= newSlides.length) {
      setActiveIndex(Math.max(0, newSlides.length - 1));
    }
  }, [slides, activeIndex, onSlidesChange, toast]);

  const handleExportPng = async (index: number) => {
    const slideEl = slideRefs.current[index];
    if (!slideEl) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(slideEl, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `slide-${index + 1}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast({ description: `Slide ${index + 1} exportado!` });
    } catch (error) {
      toast({ description: "Erro ao exportar", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllPng = async () => {
    setIsExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        const slideEl = slideRefs.current[i];
        if (!slideEl) continue;

        const dataUrl = await toPng(slideEl, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });

        const link = document.createElement("a");
        link.download = `slide-${i + 1}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      }
      toast({ description: `${slides.length} slides exportados!` });
    } catch (error) {
      toast({ description: "Erro ao exportar slides", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [1080, 1350],
      });

      for (let i = 0; i < slides.length; i++) {
        const slideEl = slideRefs.current[i];
        if (!slideEl) continue;

        if (i > 0) pdf.addPage([1080, 1350]);

        const dataUrl = await toPng(slideEl, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });

        pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1350);
      }

      pdf.save(`carrossel-${Date.now()}.pdf`);
      toast({ description: "PDF exportado com sucesso!" });
    } catch (error) {
      toast({ description: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Editor de Carrossel</h3>
          <Badge variant="secondary" className="text-xs">
            {slides.length} slides
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleExportAllPng}
            disabled={isExporting}
          >
            <Archive className="h-3.5 w-3.5 mr-1" />
            ZIP (PNG)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Slides list - reorderable */}
        <div className="col-span-4 space-y-2">
          <Reorder.Group
            axis="y"
            values={slides}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {slides.map((slide, index) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                index={index}
                isActive={index === activeIndex}
                isEditing={isEditing}
                onSelect={() => setActiveIndex(index)}
                onUpdate={(updates) => handleUpdateSlide(index, updates)}
                onDelete={() => handleDeleteSlide(index)}
              />
            ))}
          </Reorder.Group>

          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={handleAddSlide}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar Slide
          </Button>
        </div>

        {/* Active slide preview & editor */}
        <div className="col-span-8">
          <Card>
            <CardContent className="p-4">
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {activeIndex + 1} / {slides.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={activeIndex === slides.length - 1}
                  onClick={() => setActiveIndex((i) => i + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Slide preview */}
              <div
                ref={(el) => (slideRefs.current[activeIndex] = el)}
                className="aspect-[4/5] bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-border p-6 flex flex-col"
              >
                {activeSlide?.imageUrl && (
                  <div className="flex-1 rounded-lg overflow-hidden mb-4 bg-muted">
                    <img
                      src={activeSlide.imageUrl}
                      alt={activeSlide.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {activeSlide?.title || "Título"}
                  </h2>
                  <p className="text-base text-muted-foreground whitespace-pre-wrap">
                    {activeSlide?.content || "Conteúdo do slide"}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                  <div className="w-6 h-6 rounded-full bg-primary/20" />
                  <span className="text-xs text-muted-foreground">
                    {authorHandle || "@seuhandle"}
                  </span>
                </div>
              </div>

              {/* Editor fields */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={activeSlide?.type || "content"}
                    onChange={(e) =>
                      handleUpdateSlide(activeIndex, {
                        type: e.target.value as "hook" | "content" | "cta",
                      })
                    }
                    className="h-8 px-2 text-xs rounded-md border border-border bg-background"
                  >
                    <option value="hook">Gancho</option>
                    <option value="content">Conteúdo</option>
                    <option value="cta">CTA</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs ml-auto"
                    onClick={() => handleExportPng(activeIndex)}
                    disabled={isExporting}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Exportar PNG
                  </Button>
                </div>
                <Input
                  placeholder="Título do slide"
                  value={activeSlide?.title || ""}
                  onChange={(e) => handleUpdateSlide(activeIndex, { title: e.target.value })}
                  className="h-9"
                />
                <Textarea
                  placeholder="Conteúdo do slide"
                  value={activeSlide?.content || ""}
                  onChange={(e) => handleUpdateSlide(activeIndex, { content: e.target.value })}
                  className="min-h-[100px] resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
