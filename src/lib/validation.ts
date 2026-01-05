// ============= Message Validation =============

export const validateMessage = (content: string): string | null => {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return "A mensagem não pode estar vazia.";
  }

  if (trimmed.length > 25000) {
    return "A mensagem é muito longa (máximo 25.000 caracteres).";
  }

  return null;
};

// ============= Model Validation =============

export const validateModelId = (modelId: string): boolean => {
  const validModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-pro-preview",
    "gemini-2.0-flash-exp",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  
  return validModels.includes(modelId);
};

// ============= URL Validation =============

export const validateUrl = (url: string): { isValid: boolean; error?: string } => {
  const trimmed = url.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "URL não pode estar vazia." };
  }

  // Check for basic URL patterns
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
  
  if (!urlPattern.test(trimmed)) {
    return { isValid: false, error: "URL inválida. Use o formato: https://exemplo.com" };
  }

  // Try to construct URL to validate
  try {
    const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    new URL(fullUrl);
    return { isValid: true };
  } catch {
    return { isValid: false, error: "URL inválida. Verifique o formato." };
  }
};

// Social media URL validators
export const validateInstagramUrl = (url: string): { isValid: boolean; error?: string } => {
  const trimmed = url.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "URL do Instagram não pode estar vazia." };
  }

  const instagramPattern = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv|stories)\/[\w-]+\/?/i;
  const profilePattern = /^(https?:\/\/)?(www\.)?instagram\.com\/[\w.]+\/?$/i;
  
  if (!instagramPattern.test(trimmed) && !profilePattern.test(trimmed)) {
    return { isValid: false, error: "URL do Instagram inválida. Use: instagram.com/..." };
  }

  return { isValid: true };
};

export const validateYoutubeUrl = (url: string): { isValid: boolean; error?: string } => {
  const trimmed = url.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "URL do YouTube não pode estar vazia." };
  }

  const youtubePatterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/i,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/i,
    /^(https?:\/\/)?(www\.)?youtube\.com\/@[\w-]+/i,
    /^(https?:\/\/)?(www\.)?youtube\.com\/channel\/[\w-]+/i,
  ];
  
  const isValid = youtubePatterns.some(pattern => pattern.test(trimmed));
  
  if (!isValid) {
    return { isValid: false, error: "URL do YouTube inválida. Use: youtube.com/watch?v=..." };
  }

  return { isValid: true };
};

export const validateLinkedinUrl = (url: string): { isValid: boolean; error?: string } => {
  const trimmed = url.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "URL do LinkedIn não pode estar vazia." };
  }

  const linkedinPattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|posts?)\/[\w-]+/i;
  
  if (!linkedinPattern.test(trimmed)) {
    return { isValid: false, error: "URL do LinkedIn inválida. Use: linkedin.com/in/..." };
  }

  return { isValid: true };
};

// ============= Token/Content Limits =============

export interface TokenLimitResult {
  isWithinLimit: boolean;
  estimatedTokens: number;
  limit: number;
  percentUsed: number;
  warning?: string;
}

// Rough estimation: 1 token ≈ 4 characters for Portuguese
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

export const validateTokenLimit = (
  content: string, 
  maxTokens: number = 100000
): TokenLimitResult => {
  const estimatedTokens = estimateTokens(content);
  const percentUsed = Math.round((estimatedTokens / maxTokens) * 100);
  const isWithinLimit = estimatedTokens <= maxTokens;

  let warning: string | undefined;
  
  if (percentUsed >= 90 && isWithinLimit) {
    warning = `Conteúdo próximo do limite (${percentUsed}% usado).`;
  }

  return {
    isWithinLimit,
    estimatedTokens,
    limit: maxTokens,
    percentUsed,
    warning,
  };
};

// ============= Content Validation =============

export const validateTitle = (title: string, maxLength: number = 200): string | null => {
  const trimmed = title.trim();
  
  if (!trimmed) {
    return "Título não pode estar vazio.";
  }

  if (trimmed.length > maxLength) {
    return `Título muito longo (máximo ${maxLength} caracteres).`;
  }

  return null;
};

export const validateDescription = (description: string, maxLength: number = 2000): string | null => {
  const trimmed = description.trim();
  
  if (trimmed.length > maxLength) {
    return `Descrição muito longa (máximo ${maxLength} caracteres).`;
  }

  return null;
};

// ============= File Validation =============

export const validateFileSize = (
  sizeInBytes: number, 
  maxSizeMB: number = 10
): { isValid: boolean; error?: string } => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (sizeInBytes > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `Arquivo muito grande. Máximo: ${maxSizeMB}MB.` 
    };
  }

  return { isValid: true };
};

export const validateFileType = (
  fileName: string, 
  allowedExtensions: string[]
): { isValid: boolean; error?: string } => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (!extension || !allowedExtensions.includes(extension)) {
    return { 
      isValid: false, 
      error: `Tipo de arquivo não permitido. Use: ${allowedExtensions.join(', ')}.` 
    };
  }

  return { isValid: true };
};
