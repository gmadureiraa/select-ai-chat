// Shared validation utilities for edge functions
// Provides type-safe request validation without external dependencies

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

// String validator
export function validateString(
  value: unknown, 
  field: string, 
  options: { 
    required?: boolean; 
    maxLength?: number; 
    minLength?: number;
    pattern?: RegExp;
  } = {}
): ValidationError | null {
  const { required = false, maxLength, minLength, pattern } = options;
  
  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "string") {
    return { field, message: `${field} deve ser uma string` };
  }
  
  if (maxLength && value.length > maxLength) {
    return { field, message: `${field} deve ter no máximo ${maxLength} caracteres` };
  }
  
  if (minLength && value.length < minLength) {
    return { field, message: `${field} deve ter no mínimo ${minLength} caracteres` };
  }
  
  if (pattern && !pattern.test(value)) {
    return { field, message: `${field} tem formato inválido` };
  }
  
  return null;
}

// UUID validator
export function validateUUID(
  value: unknown, 
  field: string, 
  options: { required?: boolean } = {}
): ValidationError | null {
  const { required = false } = options;
  
  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "string") {
    return { field, message: `${field} deve ser uma string` };
  }
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(value)) {
    return { field, message: `${field} deve ser um UUID válido` };
  }
  
  return null;
}

// Array validator
export function validateArray(
  value: unknown, 
  field: string, 
  options: { 
    required?: boolean; 
    maxLength?: number;
    minLength?: number;
  } = {}
): ValidationError | null {
  const { required = false, maxLength, minLength } = options;
  
  if (value === undefined || value === null) {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (!Array.isArray(value)) {
    return { field, message: `${field} deve ser um array` };
  }
  
  if (maxLength && value.length > maxLength) {
    return { field, message: `${field} deve ter no máximo ${maxLength} itens` };
  }
  
  if (minLength && value.length < minLength) {
    return { field, message: `${field} deve ter no mínimo ${minLength} itens` };
  }
  
  return null;
}

// Boolean validator
export function validateBoolean(
  value: unknown, 
  field: string, 
  options: { required?: boolean } = {}
): ValidationError | null {
  const { required = false } = options;
  
  if (value === undefined || value === null) {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "boolean") {
    return { field, message: `${field} deve ser um booleano` };
  }
  
  return null;
}

// Number validator
export function validateNumber(
  value: unknown, 
  field: string, 
  options: { 
    required?: boolean; 
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationError | null {
  const { required = false, min, max, integer } = options;
  
  if (value === undefined || value === null) {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "number" || isNaN(value)) {
    return { field, message: `${field} deve ser um número` };
  }
  
  if (integer && !Number.isInteger(value)) {
    return { field, message: `${field} deve ser um número inteiro` };
  }
  
  if (min !== undefined && value < min) {
    return { field, message: `${field} deve ser no mínimo ${min}` };
  }
  
  if (max !== undefined && value > max) {
    return { field, message: `${field} deve ser no máximo ${max}` };
  }
  
  return null;
}

// Enum validator
export function validateEnum<T extends string>(
  value: unknown, 
  field: string, 
  allowedValues: readonly T[],
  options: { required?: boolean } = {}
): ValidationError | null {
  const { required = false } = options;
  
  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "string") {
    return { field, message: `${field} deve ser uma string` };
  }
  
  if (!allowedValues.includes(value as T)) {
    return { field, message: `${field} deve ser um dos valores: ${allowedValues.join(", ")}` };
  }
  
  return null;
}

// URL validator
export function validateURL(
  value: unknown, 
  field: string, 
  options: { required?: boolean } = {}
): ValidationError | null {
  const { required = false } = options;
  
  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} é obrigatório` };
    }
    return null;
  }
  
  if (typeof value !== "string") {
    return { field, message: `${field} deve ser uma string` };
  }
  
  try {
    new URL(value);
    return null;
  } catch {
    return { field, message: `${field} deve ser uma URL válida` };
  }
}

// Message validator for chat messages
export function validateChatMessage(
  message: unknown,
  index: number
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!message || typeof message !== "object") {
    errors.push({ field: `messages[${index}]`, message: "Mensagem deve ser um objeto" });
    return errors;
  }
  
  const msg = message as Record<string, unknown>;
  
  const roleError = validateEnum(msg.role, `messages[${index}].role`, ["user", "assistant", "system"] as const, { required: true });
  if (roleError) errors.push(roleError);
  
  const contentError = validateString(msg.content, `messages[${index}].content`, { required: true, maxLength: 200000 });
  if (contentError) errors.push(contentError);
  
  return errors;
}

// Validate array of chat messages
export function validateChatMessages(
  messages: unknown,
  field: string = "messages"
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  const arrayError = validateArray(messages, field, { required: true, minLength: 1, maxLength: 100 });
  if (arrayError) {
    errors.push(arrayError);
    return errors;
  }
  
  const arr = messages as unknown[];
  for (let i = 0; i < arr.length; i++) {
    const msgErrors = validateChatMessage(arr[i], i);
    errors.push(...msgErrors);
  }
  
  return errors;
}

// Sanitize string for safe processing
export function sanitizeString(value: string): string {
  // Remove null bytes and control characters except newlines/tabs
  return value
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// Create error response for validation failures
export function createValidationErrorResponse(
  errors: ValidationError[],
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: "Validação falhou", 
      details: errors 
    }),
    { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

// Safe JSON parse with validation
export async function parseAndValidateRequest<T>(
  req: Request,
  validator: (body: unknown) => ValidationError[]
): Promise<{ success: true; data: T } | { success: false; errors: ValidationError[] }> {
  try {
    const body = await req.json();
    const errors = validator(body);
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    return { success: true, data: body as T };
  } catch (error) {
    return { 
      success: false, 
      errors: [{ field: "body", message: "JSON inválido no corpo da requisição" }] 
    };
  }
}
