import { useState } from "react";
import { Copy, Check, Terminal, Wrench, Zap, Database, Image, Megaphone, Sparkles, FileText, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MCP_URL = "https://tkbsjtgrumhvwlxkmojg.supabase.co/functions/v1/mcp-reader";

type Tool = {
  name: string;
  category: "read" | "write" | "publish" | "files" | "ai" | "system";
  description: string;
  example?: string;
};

const TOOLS: Tool[] = [
  // System / discovery
  { name: "list_tables", category: "system", description: "Lista todas as tabelas do banco de dados públicas." },
  { name: "get_schema", category: "system", description: "Retorna o schema completo (colunas, tipos) de uma tabela." },
  { name: "list_clients", category: "system", description: "Lista todos os clientes do workspace com IDs e nomes." },

  // Reads
  { name: "query_table", category: "read", description: "Consulta genérica em qualquer tabela com filtros, order, limit." },
  { name: "get_client", category: "read", description: "Detalhes completos de um cliente: voz, identidade, plataformas, guidelines." },
  { name: "get_content_library", category: "read", description: "Histórico de conteúdo publicado e biblioteca de assets do cliente." },
  { name: "get_references", category: "read", description: "Referências visuais e textuais cadastradas para o cliente." },
  { name: "get_metrics", category: "read", description: "Métricas de performance por plataforma, período e formato." },
  { name: "get_automations", category: "read", description: "Lista automações ativas, agendamentos e últimas execuções." },
  { name: "get_planning", category: "read", description: "Cards do planning Kanban: status, datas, plataformas." },
  { name: "search_knowledge", category: "read", description: "Busca semântica em docs, guias e bases de conhecimento internas." },

  // Writes
  { name: "create_planning_item", category: "write", description: "Cria um novo card no planning (draft, scheduled ou published)." },
  { name: "update_planning_item", category: "write", description: "Atualiza qualquer campo de um card existente." },
  { name: "update_automation", category: "write", description: "Liga/desliga, edita prompt, plataformas ou agendamento de automação." },
  { name: "update_client", category: "write", description: "Edita perfil de voz, guidelines ou metadados do cliente." },
  { name: "insert_row", category: "write", description: "Insere linha em qualquer tabela permitida (escape hatch)." },
  { name: "update_row", category: "write", description: "Atualiza linhas com WHERE arbitrário." },
  { name: "delete_row", category: "write", description: "Deleta linhas com WHERE arbitrário (cuidado)." },

  // Files
  { name: "upload_file", category: "files", description: "Sobe arquivo (imagem/vídeo/.mp4 reels) pro storage e devolve URL pública." },
  { name: "list_files", category: "files", description: "Lista arquivos de um bucket/pasta do storage." },
  { name: "delete_file", category: "files", description: "Remove arquivo do storage." },
  { name: "get_file_url", category: "files", description: "Gera URL pública assinada de um arquivo." },

  // Publish
  { name: "publish_content", category: "publish", description: "Publica imediatamente em IG/TikTok/X/LinkedIn/YouTube/Threads/Facebook via Late. Suporta Reels, Stories, Carrossel, threads nativas, agendamento, primeiro comentário, colab tags, trial reel, custom thumbnail." },
  { name: "create_viral_carousel", category: "publish", description: "Gera carrossel completo (slides + copy + capa) baseado em referência viral." },

  // AI
  { name: "generate_content", category: "ai", description: "Roda o pipeline completo de geração de conteúdo (com identidade do cliente)." },
  { name: "analyze_url", category: "ai", description: "Faz scrape + análise IA de uma URL (notícia, post, página)." },
  { name: "invoke_function", category: "ai", description: "Chama qualquer edge function por nome (poder máximo, use com cuidado)." },
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
        "Authorization": "Bearer <SEU_SUPABASE_JWT>"
      }
    }
  }
}`;

const REELS_EXAMPLE = `# No Claude Code, depois de conectar o MCP:

> use kaleidos-kai pra postar o video /tmp/reels-teste.mp4 como Reels
  de teste no Instagram do Madureira agora

# O Claude vai chamar:
1. list_clients() → pega o ID do Madureira
2. upload_file({ bucket: "planning-media", path: "...", file: "..." })
3. create_planning_item({
     client_id: "...",
     platform: "instagram",
     content_type: "short_video",
     title: "[TESTE] Reels via MCP",
     media_urls: ["<url retornada>"]
   })
4. publish_content({
     planning_item_id: "...",
     platform: "instagram",
     instagram_content_type: "reel",
     publish_now: true
   })`;

export function MCPDocsTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="space-y-3 border-b border-border/50 pb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase tracking-wider">
              MCP Server
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              v1 · 27 tools
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">MCP kAI</h1>
          <p className="text-muted-foreground max-w-3xl">
            Servidor Model Context Protocol que dá pro Claude Code (ou qualquer cliente MCP) acesso completo
            ao kAI: clientes, planning, biblioteca, métricas, automações, geração de IA e publicação direta
            em redes sociais — incluindo upload de Reels de teste.
          </p>
        </header>

        {/* Endpoint + Connect */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Endpoint
          </h2>
          <Card className="p-4 bg-card/50 border-border/50">
            <div className="flex items-center justify-between gap-3">
              <code className="text-xs text-foreground/90 font-mono break-all">{MCP_URL}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(MCP_URL, "url")}>
                {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </Card>

          <h3 className="text-sm font-medium text-muted-foreground pt-2">Configuração no Claude Code</h3>
          <p className="text-xs text-muted-foreground">
            Adicione ao seu <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">~/.config/claude-code/mcp.json</code>{" "}
            (ou via <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">claude mcp add</code>):
          </p>
          <Card className="p-4 bg-zinc-950/60 border-border/50 relative group">
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
              onClick={() => copy(CLAUDE_CODE_CONFIG, "config")}
            >
              {copied === "config" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <pre className="text-xs text-foreground/90 font-mono overflow-x-auto whitespace-pre">{CLAUDE_CODE_CONFIG}</pre>
          </Card>
          <p className="text-xs text-muted-foreground">
            Pegue seu JWT em <strong>Configurações → API</strong> ou pelo console do navegador
            executando <code className="text-foreground bg-muted/50 px-1 py-0.5 rounded">localStorage.getItem('sb-tkbsjtgrumhvwlxkmojg-auth-token')</code>.
          </p>
        </section>

        {/* Reels test highlight */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Subir Reels de teste pelo Claude Code
          </h2>
          <Card className="p-4 bg-card/50 border-border/50">
            <pre className="text-xs text-foreground/90 font-mono overflow-x-auto whitespace-pre-wrap">{REELS_EXAMPLE}</pre>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suporta</div>
              <div className="text-sm">Reels, Stories, Feed, Carrossel</div>
            </Card>
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Plataformas</div>
              <div className="text-sm">IG · TikTok · X · LinkedIn · YT · Threads · FB</div>
            </Card>
            <Card className="p-3 bg-card/30 border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Modos</div>
              <div className="text-sm">Publicar agora, agendar, salvar como draft</div>
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

        {/* Capabilities summary */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            O que o Claude consegue fazer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { t: "Gestão de planning", d: "Criar, editar, mover e duplicar cards do Kanban com qualquer cliente." },
              { t: "Publicação multi-plataforma", d: "Subir Reels/Posts/Threads/Tweets/Vídeos via Late, com agendamento ou imediato." },
              { t: "Análise de performance", d: "Puxar métricas, comparar períodos, sugerir temas baseado em dados reais." },
              { t: "Geração de conteúdo", d: "Acionar pipeline completo (com voz, identidade e referências do cliente)." },
              { t: "Manipulação de assets", d: "Upload de mp4, imagens, PDFs pra storage e uso em publicações." },
              { t: "Edição de automações", d: "Ligar/desligar fluxos, editar prompts e cron de automações de cada cliente." },
              { t: "Triagem de biblioteca", d: "Buscar conteúdo passado, referências visuais e knowledge base." },
              { t: "Escape hatch", d: "invoke_function permite chamar qualquer edge function direta." },
            ].map((c) => (
              <Card key={c.t} className="p-3 bg-card/30 border-border/40">
                <div className="text-sm font-medium">{c.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.d}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Footer link */}
        <section className="pt-4 border-t border-border/50">
          <a
            href="https://modelcontextprotocol.io/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
          >
            Documentação oficial do MCP
            <ExternalLink className="h-3 w-3" />
          </a>
        </section>
      </div>
    </div>
  );
}

export default MCPDocsTab;
