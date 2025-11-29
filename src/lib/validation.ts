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
    "gpt-5-2025-08-07",
    "gpt-5-mini-2025-08-07",
    "gpt-4.1-2025-04-14",
    "o3-2025-04-16",
    "o4-mini-2025-04-16",
  ];
  
  return validModels.includes(modelId);
};
