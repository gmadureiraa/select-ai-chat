/**
 * MCP auto-discovery registry.
 *
 * Importa o barrel `kai-chat-tools/index.ts` e filtra os exports pra encontrar
 * todas as tools registradas (objects com `{definition, handler}`). Adiciona
 * cada uma num `ToolRegistry` interno. Resultado: o MCP server expõe
 * automaticamente toda tool que o `index.ts` reexporta — quando outros agentes
 * adicionam tools novas, este arquivo NÃO precisa ser editado, contanto que a
 * tool seja reexportada do barrel.
 *
 * IMPORTANTE: este módulo cacheia o registry no escopo do módulo. Em Vercel
 * Functions com Fluid Compute, o cache sobrevive entre invocations warm.
 */
import * as ToolsBarrel from '../kai-chat-tools/index.js';
import { ToolRegistry } from '../kai-chat-tools/registry.js';
import type {
  RegisteredTool,
  ToolDefinition,
} from '../kai-chat-tools/types.js';

let _registry: ToolRegistry | null = null;
let _toolNames: string[] | null = null;

function looksLikeRegisteredTool(value: unknown): value is RegisteredTool {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  const def = obj.definition as Record<string, unknown> | undefined;
  if (!def || typeof def !== 'object') return false;
  if (typeof def.name !== 'string') return false;
  if (typeof def.description !== 'string') return false;
  if (!def.parameters || typeof def.parameters !== 'object') return false;
  if (typeof obj.handler !== 'function') return false;
  return true;
}

/**
 * Constrói o registry uma vez (cached). Itera todo export do barrel e
 * registra qualquer um que pareça um `RegisteredTool`. Loga a lista no
 * primeiro build pra ajudar diagnóstico.
 */
export function getMcpToolRegistry(): ToolRegistry {
  if (_registry) return _registry;

  const reg = new ToolRegistry();
  const names: string[] = [];

  for (const [exportName, value] of Object.entries(ToolsBarrel)) {
    if (!looksLikeRegisteredTool(value)) continue;
    try {
      reg.register(value);
      names.push(value.definition.name);
    } catch (err) {
      console.error(`[mcp/registry] falhou registrar export "${exportName}":`, err);
    }
  }

  _registry = reg;
  _toolNames = names.sort();
  console.log(`[mcp/registry] auto-discovered ${names.length} tools:`, _toolNames.join(', '));
  return reg;
}

/** Lista de nomes de tool registradas (ordem alfabética). */
export function listMcpToolNames(): string[] {
  if (!_toolNames) getMcpToolRegistry();
  return _toolNames ? [..._toolNames] : [];
}

/** Retorna as ToolDefinition de todas as tools registradas. */
export function listMcpToolDefinitions(): ToolDefinition[] {
  return getMcpToolRegistry().getDeclarations();
}

/**
 * Converte uma `ToolDefinition` (formato do KAI Chat) pro formato MCP
 * canônico `{name, description, inputSchema}`.
 *
 * Como nossas tools já declaram `parameters` em JSON Schema Draft-7
 * compatível, é essencialmente passthrough — só renomeamos `parameters`
 * → `inputSchema`.
 */
export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Marca tools potencialmente destrutivas pra clients exibirem warning. */
  dangerous?: boolean;
}

const DANGEROUS_PATTERNS: RegExp[] = [
  /^delete/i,
  /^remove/i,
  /^drop/i,
  /^destroy/i,
  /^purge/i,
  /publish/i, // publishNow toca rede externa
];

function isDangerousByName(name: string): boolean {
  return DANGEROUS_PATTERNS.some((rx) => rx.test(name));
}

export function toMcpDescriptor(def: ToolDefinition): McpToolDescriptor {
  const descriptor: McpToolDescriptor = {
    name: def.name,
    description: def.description,
    inputSchema: def.parameters as unknown as Record<string, unknown>,
  };
  if (isDangerousByName(def.name)) {
    descriptor.dangerous = true;
  }
  return descriptor;
}

export function listMcpDescriptors(): McpToolDescriptor[] {
  return listMcpToolDefinitions().map(toMcpDescriptor);
}

/** Pra debug/health endpoints. */
export function mcpRegistryStats() {
  const names = listMcpToolNames();
  return {
    count: names.length,
    tools: names,
  };
}
