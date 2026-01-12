import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FolderDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface ImageLightboxProps {
  images: { url: string; type: 'image' | 'video' }[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Reset index when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
    }
  }, [open, initialIndex]);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoom(1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoom(1);
  };

  const handleDownload = async () => {
    if (!currentImage) return;
    
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.${currentImage.type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDownloadAll = async () => {
    if (downloadingAll || images.length === 0) return;
    
    setDownloadingAll(true);
    const zip = new JSZip();
    
    try {
      for (const [idx, img] of images.entries()) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const extension = img.type === 'video' ? 'mp4' : 'png';
        zip.file(`media-${idx + 1}.${extension}`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midias-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${images.length} mídias baixadas em um arquivo ZIP!`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar mídias');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onOpenChange(false);
  };

  if (!currentImage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none"
        onKeyDown={handleKeyDown}
      >
        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            {hasMultiple && (
              <span className="text-white/80 text-sm">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white/80 text-sm min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20"
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
              title="Baixar mídia atual"
            >
              <Download className="h-5 w-5" />
            </Button>
            {hasMultiple && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadAll}
                className="text-white hover:bg-white/20"
                disabled={downloadingAll}
                title="Baixar todas as mídias"
              >
                {downloadingAll ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FolderDown className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Image container */}
        <div className="flex items-center justify-center w-full h-[85vh] overflow-auto">
          {currentImage.type === 'video' ? (
            <video
              src={currentImage.url}
              controls
              className="max-w-full max-h-full object-contain"
              style={{ transform: `scale(${zoom})` }}
            />
          ) : (
            <img
              src={currentImage.url}
              alt=""
              className={cn(
                "max-w-full max-h-full object-contain transition-transform duration-200",
              )}
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          )}
        </div>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Thumbnails */}
        {hasMultiple && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 p-4 bg-gradient-to-t from-black/60 to-transparent">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentIndex(idx); setZoom(1); }}
                className={cn(
                  "w-12 h-12 rounded-lg overflow-hidden border-2 transition-all",
                  currentIndex === idx 
                    ? "border-primary scale-110" 
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {img.type === 'video' ? (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">VID</span>
                  </div>
                ) : (
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
