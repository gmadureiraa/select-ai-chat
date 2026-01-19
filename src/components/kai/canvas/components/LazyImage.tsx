import { memo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

function LazyImageComponent({
  src,
  alt,
  className,
  containerClassName,
  fallback,
  onClick,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div
      ref={imgRef}
      className={cn('relative overflow-hidden bg-muted', containerClassName)}
      onClick={onClick}
    >
      {/* Placeholder/Loading state */}
      {(!isLoaded || hasError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          {fallback || <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
        </div>
      )}

      {/* Actual image - only loads when in viewport */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}

export const LazyImage = memo(LazyImageComponent);
