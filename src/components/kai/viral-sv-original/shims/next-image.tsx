/**
 * Shim de `next/image` → `<img>` simples.
 *
 * Preserva `src`, `alt`, `width`, `height`, `className`, `style`, `loading`.
 * Ignora `priority`, `placeholder`, `blurDataURL`, `quality`, `sizes`, `fill`.
 * `fill` é simulado com `position:absolute; inset:0; width:100%; height:100%;
 * object-fit:cover` se passado.
 */
import { forwardRef, type ImgHTMLAttributes, type CSSProperties } from "react";

interface NextImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "width" | "height" | "src"> {
  src: string | { src: string };
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  quality?: number;
  sizes?: string;
  unoptimized?: boolean;
  loader?: unknown;
  onLoadingComplete?: (img: HTMLImageElement) => void;
}

const Image = forwardRef<HTMLImageElement, NextImageProps>(function Image(
  {
    src,
    alt,
    width,
    height,
    fill,
    priority: _priority,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    quality: _quality,
    sizes: _sizes,
    unoptimized: _unoptimized,
    loader: _loader,
    onLoadingComplete,
    style,
    ...rest
  },
  ref,
) {
  const resolvedSrc = typeof src === "string" ? src : src.src;
  const fillStyle: CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }
    : style ?? {};

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      alt={alt}
      width={fill ? undefined : (width as number | undefined)}
      height={fill ? undefined : (height as number | undefined)}
      style={fillStyle}
      onLoad={
        onLoadingComplete
          ? (e) => onLoadingComplete(e.currentTarget)
          : undefined
      }
      {...rest}
    />
  );
});

export default Image;
