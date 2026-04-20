/**
 * ToolRegistry — lista central de tools disponíveis pro LLM.
 *
 * Uso:
 *   const registry = new ToolRegistry();
 *   registry.register(echoTool);
 *   registry.register(createContentTool);
 *   // ...
 *   const declarations = registry.getDeclarations(); // pro Gemini
 *   const result = await registry.execute("echo", args, ctx);
 */

import type {
  RegisteredTool,
  ToolDefinition,
  ToolExecutionContext,
  ToolHandlerResult,
} from "./types.ts";

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register<TArgs = Record<string, unknown>, TData = unknown>(
    tool: RegisteredTool<TArgs, TData>,
  ): void {
    if (this.tools.has(tool.definition.name)) {
      console.warn(`[ToolRegistry] tool "${tool.definition.name}" já registrada — sobrescrevendo`);
    }
    this.tools.set(tool.definition.name, tool as RegisteredTool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Declarações pro `tools` field do Gemini API. */
  getDeclarations(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** Executa uma tool pelo nome. Retorna erro se não existe. */
  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolHandlerResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        error: `Tool "${name}" não encontrada. Disponíveis: ${this.list().join(", ")}`,
      };
    }
    try {
      return await tool.handler(args, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ToolRegistry] tool "${name}" throw:`, err);
      return { ok: false, error: message };
    }
  }
}
