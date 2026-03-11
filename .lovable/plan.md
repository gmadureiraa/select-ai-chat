Dê acesso para o MCP claude code conseguir além de ver as tabelas, ter acesso ao kai completo, tanto para editar, melhorar ele, quanto para trabalhar em programar conteúdos, criar novos conteúdos, analisar dados e afins, tudo integrado para ele ter total acesso

# Dar acesso ao banco de dados para Claude Code local

## Opções disponíveis

### Opção 1: MCP Server (Recomendada)

Criar um **edge function que funciona como MCP Server** — o Claude Code já suporta MCP nativamente. Assim ele pode consultar tabelas, listar dados, buscar conteúdo, tudo via protocolo padrão.

- Você adiciona o MCP server nas configs do Claude Code
- Ele consegue fazer queries de leitura em qualquer tabela
- Controle granular: você define quais tabelas/operações são permitidas
- Sem expor credenciais sensíveis diretamente

**Implementação:** Uma edge function com `mcp-lite` que expõe tools como `list_tables`, `query_table`, `get_client_data`, etc.

### Opção 2: API REST read-only

Criar uma edge function simples que aceita queries de leitura (SELECT) em tabelas específicas, autenticada por uma chave. O Claude Code chamaria via `curl` ou fetch.

### Opção 3: Export completo periódico

Gerar dumps JSON/CSV de todas as tabelas relevantes e salvar em arquivos que o Claude Code pode ler localmente. Menos dinâmico, mas zero risco.

---

## Recomendação: Opção 1 (MCP Server)

O Claude Code já tem suporte nativo a MCP. Criaria uma edge function que expõe:


| Tool MCP              | Descrição                                   |
| --------------------- | ------------------------------------------- |
| `list_tables`         | Lista todas as tabelas disponíveis          |
| `query_table`         | Consulta uma tabela com filtros (read-only) |
| `get_client`          | Dados completos de um cliente               |
| `get_content_library` | Biblioteca de conteúdo de um cliente        |
| `get_references`      | Referências de um cliente                   |
| `get_metrics`         | Métricas de um cliente                      |
| `get_automations`     | Automações de um cliente                    |
| `get_planning`        | Items de planejamento                       |
| `search_knowledge`    | Busca na base de conhecimento               |


Autenticação via service role key no header. Só operações de leitura.

No Claude Code, você adicionaria ao `claude_desktop_config.json`:

```text
{
  "mcpServers": {
    "kaleidos": {
      "url": "https://<project-url>/functions/v1/mcp-reader"
    }
  }
}
```

## Execução


| Ação                    | Detalhe                                               |
| ----------------------- | ----------------------------------------------------- |
| Edge Function           | `supabase/functions/mcp-reader/index.ts` com mcp-lite |
| Config                  | `verify_jwt = false` + autenticação por service key   |
| Nenhum arquivo frontend | Só backend                                            |
