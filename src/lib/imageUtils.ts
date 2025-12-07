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
  // Check cache first
  if (base64Cache.has(url)) {
    return base64Cache.get(url)!;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error("Error converting URL to base64:", error);
    throw error;
  }
}

/**
 * Converte um Blob para base64
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converte um File para base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

/**
 * Redimensiona uma imagem para economizar tokens
 * @param base64 - A imagem em formato base64 (data:image/...;base64,...)
 * @param maxSize - Tamanho máximo em pixels (default: 1024)
 */
export async function resizeImage(base64: string, maxSize: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Se já está dentro do limite, retorna original
      if (width <= maxSize && height <= maxSize) {
        resolve(base64);
        return;
      }
      
      // Calcular nova dimensão mantendo aspect ratio
      if (width > height) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      
      // Criar canvas e redimensionar
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Determinar formato
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
  
  // Check file extension
  if (supportedFormats.some((ext) => lowercaseUrl.includes(ext))) {
    return true;
  }
  
  // Check for data URL
  if (lowercaseUrl.startsWith("data:image/")) {
    return true;
  }
  
  // Check for common image hosting patterns
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
 * @param images - Array de imagens (URLs ou File objects)
 * @param maxImages - Número máximo de imagens a processar (default: 3)
 * @param maxSize - Tamanho máximo de cada imagem em pixels (default: 1024)
 */
export async function processReferenceImages(
  images: Array<{ url?: string; file?: File; description?: string }>,
  maxImages: number = 3,
  maxSize: number = 1024
): Promise<Array<{ base64: string; description?: string }>> {
  const results: Array<{ base64: string; description?: string }> = [];
  
  // Limitar número de imagens
  const toProcess = images.slice(0, maxImages);
  
  for (const image of toProcess) {
    try {
      let base64: string;
      
      if (image.file) {
        base64 = await fileToBase64(image.file);
      } else if (image.url) {
        // Skip if already base64
        if (image.url.startsWith("data:image/")) {
          base64 = image.url;
        } else {
          base64 = await urlToBase64(image.url);
        }
      } else {
        continue;
      }
      
      // Resize to save tokens
      const resized = await resizeImage(base64, maxSize);
      
      // Cache the result
      if (image.url && !image.url.startsWith("data:")) {
        if (base64Cache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry
          const firstKey = base64Cache.keys().next().value;
          if (firstKey) base64Cache.delete(firstKey);
        }
        base64Cache.set(image.url, resized);
      }
      
      results.push({
        base64: resized,
        description: image.description,
      });
    } catch (error) {
      console.error("Error processing reference image:", error);
      // Continue with other images
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
