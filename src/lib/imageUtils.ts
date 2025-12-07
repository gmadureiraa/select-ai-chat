/**
 * Image utilities for handling base64 conversions and optimizations
 */

// Cache para URLs já convertidas (evita reprocessamento)
const base64Cache = new Map<string, string>();
const MAX_CACHE_SIZE = 20;

/**
 * Converte uma URL de imagem para base64
 */
export async function urlToBase64(url: string): Promise<string> {
  if (base64Cache.has(url)) {
    return base64Cache.get(url)!;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  
  const blob = await response.blob();
  return blobToBase64(blob);
}

/**
 * Converte um Blob para base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converte um File para base64
 */
export function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

/**
 * Redimensiona uma imagem para economizar tokens
 */
export function resizeImage(base64: string, maxSize: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      if (width <= maxSize && height <= maxSize) {
        resolve(base64);
        return;
      }
      
      if (width > height) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const format = base64.includes("image/png") ? "image/png" : "image/jpeg";
      const quality = format === "image/jpeg" ? 0.85 : undefined;
      
      resolve(canvas.toDataURL(format, quality));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = base64;
  });
}

/**
 * Valida se uma URL aponta para um formato de imagem suportado
 */
export function validateImageFormat(url: string): boolean {
  const supportedFormats = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
  const lowercaseUrl = url.toLowerCase();
  
  if (supportedFormats.some((ext) => lowercaseUrl.includes(ext))) {
    return true;
  }
  
  if (lowercaseUrl.startsWith("data:image/")) {
    return true;
  }
  
  const imageHostPatterns = [
    /unsplash\.com/,
    /pexels\.com/,
    /imgur\.com/,
    /cloudinary\.com/,
    /supabase.*storage/,
    /blob\.core\.windows\.net/,
  ];
  
  return imageHostPatterns.some((pattern) => pattern.test(lowercaseUrl));
}

/**
 * Processa múltiplas imagens de referência para o formato esperado pela API
 */
export async function processReferenceImages(
  images: Array<{ url?: string; file?: File; description?: string }>,
  maxImages: number = 3,
  maxSize: number = 1024
): Promise<Array<{ base64: string; description?: string }>> {
  const results: Array<{ base64: string; description?: string }> = [];
  const toProcess = images.slice(0, maxImages);
  
  for (const image of toProcess) {
    try {
      let base64: string;
      
      if (image.file) {
        base64 = await fileToBase64(image.file);
      } else if (image.url) {
        if (image.url.startsWith("data:image/")) {
          base64 = image.url;
        } else {
          base64 = await urlToBase64(image.url);
        }
      } else {
        continue;
      }
      
      const resized = await resizeImage(base64, maxSize);
      
      if (image.url && !image.url.startsWith("data:")) {
        if (base64Cache.size >= MAX_CACHE_SIZE) {
          const firstKey = base64Cache.keys().next().value;
          if (firstKey) base64Cache.delete(firstKey);
        }
        base64Cache.set(image.url, resized);
      }
      
      results.push({
        base64: resized,
        description: image.description,
      });
    } catch (err) {
      console.error("Error processing reference image:", err);
    }
  }
  
  return results;
}

/**
 * Extrai o MIME type de uma string base64
 */
export function getMimeTypeFromBase64(base64: string): string {
  const match = base64.match(/data:([^;]+);base64/);
  return match ? match[1] : "image/jpeg";
}

/**
 * Remove o prefixo data URL de uma string base64
 */
export function stripBase64Prefix(base64: string): string {
  return base64.replace(/^data:image\/[^;]+;base64,/, "");
}
