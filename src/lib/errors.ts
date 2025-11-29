import { ChatError } from "@/types/chat";

export const createChatError = (
  error: unknown,
  defaultMessage: string = "Erro desconhecido"
): ChatError => {
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes("Failed to fetch")) {
      return {
        message: "Erro de conexão. Verifique sua internet.",
        type: "network",
      };
    }

    if (error.message.includes("API")) {
      return {
        message: "Erro na API. Tente novamente.",
        type: "api",
      };
    }

    return {
      message: error.message,
      type: "unknown",
    };
  }

  return {
    message: defaultMessage,
    type: "unknown",
  };
};

export const getErrorMessage = (error: ChatError): string => {
  switch (error.type) {
    case "network":
      return "Erro de conexão. Verifique sua internet e tente novamente.";
    case "api":
      return error.message || "Erro ao processar sua solicitação.";
    case "validation":
      return error.message || "Dados inválidos. Verifique e tente novamente.";
    default:
      return error.message || "Ocorreu um erro inesperado.";
  }
};
