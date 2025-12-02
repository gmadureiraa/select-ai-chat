export const validateMessage = (content: string): string | null => {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return "A mensagem não pode estar vazia.";
  }

  if (trimmed.length > 10000) {
    return "A mensagem é muito longa (máximo 10.000 caracteres).";
  }

  return null;
};

export const validateModelId = (modelId: string): boolean => {
  const validModels = [
    "gemini-2.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash-thinking-exp",
    "gemini-exp-1206",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  
  return validModels.includes(modelId);
};
