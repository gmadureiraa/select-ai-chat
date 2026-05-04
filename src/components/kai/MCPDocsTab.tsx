import { useState } from "react";
import {
  Copy,
  Check,
  Terminal,
  Wrench,
  Zap,
  Database,
  Image,
  Megaphone,
  Sparkles,
  FileText,
  Globe,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Rocket,
  KeyRound,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MCP_URL = "https://tkbsjtgrumhvwlxkmojg.supabase.co/functions/v1/mcp-reader";
const FUNCTION_NAME = "mcp-reader";

type Tool = {
  name: string;
  category: "read" | "write" | "publish" | "files" | "ai" | "system";
  description: string;
};

const TOOLS: Tool[] = [
  // System / discovery
  { name: "list_tables", category: "system", description: "Lista todas as tabelas do banco com contagem de linhas." },
  { name: "get_schema", category: "system", description: "Retorna colunas e tipos inferidos de uma tabela." },
  { name: "list_clients", category: "system", description: "Lista todos os clientes do workspace com IDs e nomes." },

  // Reads
  { name: "query_table", category: "read", description: "SELECT genérico em qualquer tabela com filtros, order, limit, offset." },
  { name: "get_client", category: "read", description: "Perfil completo do cliente: voz, identidade, plataformas, websites, docs, referências visuais." },
  { name: "get_content_library", category: "read", description: "Histórico de conteúdo publicado e biblioteca de assets do cliente." },
  { name: "get_references", category: "read", description: "Referências textuais cadastradas para o cliente." },
  { name: "get_metrics", category: "read", description: "Métricas e posts de Twitter, LinkedIn, Instagram e YouTube." },
  { name: "get_automations", category: "read", description: "Automações ativas (planning + recurring) e últimas execuções." },
  { name: "get_planning", category: "read", description: "Planning items e scheduled posts filtráveis por cliente, workspace e status." },
  { name: "search_knowledge", category: "read", description: "Busca por keyword na knowledge base global." },

  // Writes
  { name: "create_planning_item", category: "write", description: "Cria card no planning. Aceita threads (thread_items[]) com mídias por post e target_platforms (twitter+threads)." },
  { name: "update_planning_item", category: "write", description: "Atualiza qualquer campo de um card existente." },
  { name: "update_automation", category: "write", description: "Liga/desliga, edita prompt, plataformas ou agendamento de uma automação." },
  { name: "update_client", category: "write", description: "Edita perfil de voz, guidelines ou metadados do cliente." },
  { name: "insert_row", category: "write", description: "Insere linha em qualquer tabela permitida (escape hatch)." },
  { name: "update_row", category: "write", description: "Update arbitrário com filtros (use com cuidado)." },
  { name: "delete_row", category: "write", description: "Delete arbitrário com filtros (use com cuidado)." },

  // Files
  { name: "upload_file", category: "files", description: "Sobe arquivo (mp4, jpg, png, pdf...) pro storage e devolve URL pública." },
  { name: "list_files", category: "files", description: "Lista arquivos de um bucket/pasta do storage." },
  { name: "delete_file", category: "files", description: "Remove arquivo do storage." },
  { name: "get_file_url", category: "files", description: "Gera URL pública de um arquivo." },

  // Publish
  { name: "publish_content", category: "publish", description: "Publica direto via Late em IG, TikTok, X, LinkedIn, YouTube, Threads, Facebook. Suporta Reels, Stories, Carrossel, Threads nativas, agendamento, primeiro comentário, colab tags, custom thumbnail." },
  { name: "create_viral_carousel", category: "publish", description: "Gera carrossel completo (slides + copy + capa) baseado em referência viral." },

  // AI
  { name: "generate_content", category: "ai", description: "Roda o pipeline unified-content-api com identidade do cliente." },
  { name: "analyze_url", category: "ai", description: "Faz scrape (Firecrawl) + análise IA de uma URL." },
  { name: "invoke_function", category: "ai", description: "Chama qualquer edge function do projeto por nome (poder máximo)." },
];

const CATEGORY_META: Record<Tool["category"], { label: string; color: string; icon: React.ReactNode }> = {
  system: { label: "Sistema", color: "bg-zinc-700/40 text-zinc-300 border-zinc-600/50", icon: <Terminal className="h-3 w-3" /> },
  read: { label: "Leitura", color: "bg-blue-500/10 text-blue-300 border-blue-500/30", icon: <Database className="h-3 w-3" /> },
  write: { label: "Escrita", color: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: <Wrench className="h-3 w-3" /> },
  files: { label: "Arquivos", color: "bg-purple-500/10 text-purple-300 border-purple-500/30", icon: <Image className="h-3 w-3" /> },
  publish: { label: "Publicação", color: "bg-primary/10 text-primary border-primary/30", icon: <Megaphone className="h-3 w-3" /> },
  ai: { label: "IA", color: "bg-pink-500/10 text-pink-300 border-pink-500/30", icon: <Sparkles className="h-3 w-3" /> },
};

const CLAUDE_CODE_CONFIG = `{
  "mcpServers": {
    "kaleidos-kai": {
      "transport": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer <MCP_ACCESS_TOKEN>"
      }
    }
  }
}`;

const CLAUDE_CLI_ADD = `claude mcp add kaleidos-kai \\
  --transport http \\
  --url ${MCP_URL} \\
  --header "Authorization: Bearer <MCP_ACCESS_TOKEN>"`;

const CURL_TEST = `curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'`;

const REELS_EXAMPLE = `# No Claude Code, depois de conectar o MCP:

> use kaleidos-kai pra postar o video /tmp/reels-teste.mp4
  como Reels de teste no Instagram do Madureira agora

# O Claude vai chamar nessa ordem:
1. list_clients()
   → pega o ID do cliente "Madureira"

2. upload_file({
     bucket: "client-files",
     path: "madureira/reels-teste.mp4",
     file_base64: "<conteúdo>",
     content_type: "video/mp4"
   })
   → retorna URL pública

3. create_planning_item({
     client_id: "<id>",
     workspace_id: "<id>",
     title: "[TESTE] Reels via MCP",
     platform: "instagram",
     content_type: "reel",
     status: "draft",
     content: "Legenda do reels...",
     image_url: "<url do mp4>"
   })

4. publish_content({
     planning_item_id: "<id>",
     platform: "instagram",
     instagram_content_type: "reel",
     publish_now: true
   })`;

const THREAD_EXAMPLE = `# Criar uma thread no X (Twitter) + Threads em paralelo:

> use kaleidos-kai pra criar uma thread de 4 tweets
  pro Defiverso falando do colapso da FTX, agendada
  pra amanhã 9h

# O Claude vai chamar:
create_planning_item({
  client_id: "<id-defiverso>",
  workspace_id: "<id-workspace>",
  title: "Thread: o que aprendemos com a FTX",
  content_type: "thread",
  platform: "twitter",
  target_platforms: ["twitter", "threads"],
  status: "scheduled",
  scheduled_at: "2026-05-05T12:00:00Z",
  thread_items: [
    { text: "1/ Há 3 anos a FTX colapsava em 9 dias..." },
    { text: "2/ A lição mais óbvia foi self-custody..." },
    { text: "3/ Mas a menos óbvia: auditoria on-chain..." },
    { text: "4/ Hoje, o que mudou de fato no setor:..." }
  ]
})

# Regras importantes:
# - Cada item da thread = 1 post separado
# - X = 280 chars / Threads = 500 chars
# - Se for pros dois, mantém ≤280
# - media_urls: [] em cada item se quiser anexar imagens
# - SEM hashtags e SEM emojis (regra do projeto)`;

const VIRAL_CAROUSEL_EXAMPLE = `# Gerar carrossel viral baseado em referência:

> use kaleidos-kai pra criar um carrossel pro Jornal Cripto
  no estilo desse post: https://instagram.com/p/XXXX

# O Claude vai chamar:
create_viral_carousel({
  client_id: "<id-jornal-cripto>",
  reference_url: "https://instagram.com/p/XXXX",
  topic: "Bitcoin atinge nova ATH",
  num_slides: 7
})

# Retorna: slides[] (texto + imagem prompt), copy, capa.
# Salva como planning_item draft no Kanban.`;

const QUERY_EXAMPLE = `# Consultar métricas dos últimos 7 dias do Madureira no LinkedIn:

query_table({
  table: "linkedin_posts",
  filters: [
    { column: "client_id", operator: "eq", value: "<id-madureira>" },
    { column: "posted_at", operator: "gte", value: "2026-04-27" }
  ],
  order: "posted_at",
  ascending: false,
  limit: 50
})`;

export function MCPDocsTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  const CopyBtn = ({ value, k, className = "" }: { value: string; k: string; className?: string }) => (
    <Button
      size="sm"
      variant="ghost"
      className={`h-7 w-7 p-0 ${className}`}
      onClick={() => copy(value, k)}
    >
      {copied === k ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );

  const CodeBlock = ({ code, k }: { code: string; k: string }) => (
    <Card className="p-4 bg-zinc-950/60 border-border/50 relative group">
      <CopyBtn value={code} k={k} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" />
      <pre className="text-xs text-foreground/90 font-mono overflow-x-auto whitespace-pre">{code}</pre>
    </Card>
  );

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-10">
        {/* Header */}
        <header className="space-y-3 border-b border-border/50 pb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase tracking-wider">
              MCP Server
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              v1 · {TOOLS.length} tools
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Streamable HTTP
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">MCP kAI</h1>
          <p className="text-muted-foreground max-w-3xl">
            Servidor Model Context Protocol que dá pro Claude Code (ou qualquer cliente MCP) acesso completo
            ao kAI: clientes, planning, biblioteca, métricas, automações, geração de IA e publicação direta
            em redes sociais — incluindo upload de Reels de teste e criação de threads no X.
          </p>
        </header>

        {/* Endpoint */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Endpoint
          </h2>
          <Card className="p-4 bg-card/50 border-border/50">
            <div className="flex items-center justify-between gap-3">
              <code className="text-xs text-foreground/90 font-mono break-all">{MCP_URL}</code>
              <CopyBtn value={MCP_URL} k="url" />
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Servido por uma edge function (<code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">{FUNCTION_NAME}</code>),
            usando <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">mcp-lite</code> sobre Hono em
            transporte Streamable HTTP. Public no sentido de que está deployado, mas exige token.
          </p>
        </section>

        {/* Auth */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Autenticação
          </h2>
          <Card className="p-4 bg-card/50 border-border/50 space-y-2">
            <p className="text-sm">
              A auth é por <strong>token estático compartilhado</strong> — não usa JWT do usuário.
              Todo request precisa do header:
            </p>
            <div className="flex items-center justify-between gap-3 bg-zinc-950/60 rounded p-2">
              <code className="text-xs font-mono">Authorization: Bearer &lt;MCP_ACCESS_TOKEN&gt;</code>
              <CopyBtn value="Authorization: Bearer <MCP_ACCESS_TOKEN>" k="auth-header" />
            </div>
            <p className="text-xs text-muted-foreground">
              O valor do <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">MCP_ACCESS_TOKEN</code> está
              guardado nos secrets do projeto (Cloud → Secrets). Pega ele lá e cola no lugar de{" "}
              <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">&lt;MCP_ACCESS_TOKEN&gt;</code> nos exemplos abaixo.
              Quem tem o token tem acesso de service_role ao banco — <strong>não compartilhe</strong>.
            </p>
          </Card>
        </section>

        {/* Como subir / conectar */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Como conectar
          </h2>

          {/* Claude Code via CLI */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">Claude Code</Badge>
              Via CLI (mais rápido)
            </h3>
            <CodeBlock code={CLAUDE_CLI_ADD} k="cli-add" />
          </div>

          {/* Claude Code via JSON */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">Claude Code</Badge>
              Via arquivo de config
            </h3>
            <p className="text-xs text-muted-foreground">
              Adicione ao <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">~/.config/claude-code/mcp.json</code>{" "}
              (ou <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> no Mac):
            </p>
            <CodeBlock code={CLAUDE_CODE_CONFIG} k="config" />
          </div>

          {/* Test via curl */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">Qualquer cliente</Badge>
              Testar com curl
            </h3>
            <p className="text-xs text-muted-foreground">
              Lista todas as tools disponíveis. Útil pra confirmar que o token e o endpoint estão certos.
            </p>
            <CodeBlock code={CURL_TEST} k="curl" />
          </div>

          {/* Other clients */}
          <Card className="p-3 bg-card/30 border-border/40 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 text-foreground">
              <Server className="h-3.5 w-3.5" />
              <span className="font-medium">Outros clientes MCP</span>
            </div>
            <p>
              Funciona com qualquer cliente que suporte transporte HTTP Streamable do MCP (Cursor, Continue, Cline, MCP Inspector...).
              É só apontar pro endpoint acima e mandar o header de Authorization.
            </p>
            <p>
              Pra debug ao vivo, rode: <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">npx @modelcontextprotocol/inspector</code>
            </p>
          </Card>
        </section>

        {/* Exemplos práticos */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Exemplos práticos
          </h2>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Reels de teste no Instagram</h3>
            <CodeBlock code={REELS_EXAMPLE} k="ex-reels" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Thread no X (Twitter) + Threads</h3>
            <CodeBlock code={THREAD_EXAMPLE} k="ex-thread" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Carrossel viral</h3>
            <CodeBlock code={VIRAL_CAROUSEL_EXAMPLE} k="ex-carousel" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Consulta direta no banco</h3>
            <CodeBlock code={QUERY_EXAMPLE} k="ex-query" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suporta</div>
              <div className="text-sm">Reels, Stories, Feed, Carrossel, Threads</div>
            </Card>
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Plataformas</div>
              <div className="text-sm">IG · TikTok · X · LinkedIn · YT · Threads · FB</div>
            </Card>
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Modos</div>
              <div className="text-sm">Publicar agora · agendar · salvar como draft</div>
            </Card>
          </div>
        </section>

        {/* Tools list */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Ferramentas disponíveis ({TOOLS.length})
          </h2>

          {(["publish", "ai", "write", "read", "files", "system"] as Tool["category"][]).map((cat) => {
            const items = TOOLS.filter((t) => t.category === cat);
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 pt-3">
                  <Badge variant="outline" className={`${meta.color} text-[10px] uppercase tracking-wider gap-1`}>
                    {meta.icon}
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{items.length} tools</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((t) => (
                    <Card key={t.name} className="p-3 bg-card/30 border-border/40 hover:border-border transition group">
                      <div className="flex items-start justify-between gap-2">
                        <code className="text-xs font-mono text-foreground font-medium">{t.name}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition"
                          onClick={() => copy(t.name, t.name)}
                        >
                          {copied === t.name ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Capabilities */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            O que o Claude consegue fazer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { t: "Gestão de planning", d: "Criar, editar e mover cards do Kanban com qualquer cliente." },
              { t: "Publicação multi-plataforma", d: "Subir Reels/Posts/Threads/Tweets/Vídeos via Late, agendado ou imediato." },
              { t: "Análise de performance", d: "Puxar métricas, comparar períodos, sugerir temas baseado em dados reais." },
              { t: "Geração de conteúdo", d: "Acionar pipeline unified-content-api com voz, identidade e referências do cliente." },
              { t: "Manipulação de assets", d: "Upload de mp4, imagens, PDFs pro storage e uso em publicações." },
              { t: "Edição de automações", d: "Ligar/desligar fluxos, editar prompts e cron de automações de cada cliente." },
              { t: "Triagem de biblioteca", d: "Buscar conteúdo passado, referências e knowledge base." },
              { t: "Escape hatch", d: "invoke_function permite chamar qualquer edge function direta." },
            ].map((c) => (
              <Card key={c.t} className="p-3 bg-card/30 border-border/40">
                <div className="text-sm font-medium">{c.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.d}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Regras de conteúdo */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Regras de conteúdo (válidas pro MCP também)
          </h2>
          <Card className="p-4 bg-card/30 border-border/40 text-xs text-muted-foreground space-y-1.5">
            <div>• <strong className="text-foreground">Sem hashtags e sem emojis</strong> em X, Threads e LinkedIn (máx 1 emoji em CTA).</div>
            <div>• <strong className="text-foreground">Threads</strong>: máx 497 chars por post; X: máx 280. Se publicar em ambos, mantém ≤280.</div>
            <div>• <strong className="text-foreground">Carrossel/Threads</strong>: usar arrays JSON estruturados (<code>thread_items</code>), não texto único concatenado.</div>
            <div>• Identidade do cliente (voice profile + guidelines) sempre é injetada nas chamadas de geração via <code>generate_content</code>.</div>
            <div>• Arquivos sempre via URL pública permanente do storage (nunca base64 inline em DB).</div>
          </Card>
        </section>

        {/* Troubleshooting */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Troubleshooting
          </h2>
          <div className="space-y-2">
            {[
              {
                code: "401 Unauthorized",
                fix: "Token errado ou ausente. Confere o secret MCP_ACCESS_TOKEN no Cloud e o header Authorization: Bearer <token>.",
              },
              {
                code: "406 Not Acceptable",
                fix: "Faltando header Accept. MCP exige Accept: application/json, text/event-stream em todo POST.",
              },
              {
                code: "Tool not found",
                fix: "Cliente MCP não recarregou a lista. Roda tools/list de novo ou reinicia o cliente. A lista atual tem " + TOOLS.length + " tools.",
              },
              {
                code: "Late API: account not connected",
                fix: "O cliente não tem credencial válida pra essa plataforma. Conecta em Configurações → Contas Sociais antes de publicar.",
              },
              {
                code: "Reels demora ou falha",
                fix: "Vídeos grandes podem estourar timeout. Faz upload_file primeiro (separado), depois passa só a URL pro publish_content.",
              },
              {
                code: "create_planning_item retorna erro de coluna",
                fix: "Use o campo 'content' (nunca 'body' — coluna legada). Pra threads, use 'thread_items[]', não concatenar tudo em content.",
              },
            ].map((row) => (
              <Card key={row.code} className="p-3 bg-card/30 border-border/40">
                <div className="flex items-start gap-3">
                  <code className="text-xs font-mono text-amber-300 whitespace-nowrap pt-0.5">{row.code}</code>
                  <span className="text-xs text-muted-foreground">{row.fix}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Footer link */}
        <section className="pt-4 border-t border-border/50 flex items-center gap-4">
          <a
            href="https://modelcontextprotocol.io/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
          >
            Documentação oficial do MCP
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://github.com/fiberplane/mcp-lite"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
          >
            mcp-lite (lib usada no servidor)
            <ExternalLink className="h-3 w-3" />
          </a>
        </section>
      </div>
    </div>
  );
}

export default MCPDocsTab;
