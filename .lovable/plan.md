

# Plano: integrar Viral Hunter + Sequência Viral, corrigir build e fechar pontas soltas

Você subiu duas features grandes pelo GitHub (Viral Hunter com 6 sub-tabs + Sequência Viral com carrossel estilo Twitter) e um servidor MCP. Tem **um erro de build bloqueante** e **vários pontos meio-implementados** que precisam virar funcionais. Aqui está o que faço:

## 1. Corrigir o build (bloqueante)

O `supabase/functions/mcp-reader/index.ts` importa `npm:mcp-lite@^0.10.0` mas não tem `deno.json` declarando dependências, então o Deno não consegue resolver.

**Fix**: criar `supabase/functions/mcp-reader/deno.json` com import map declarando `mcp-lite` e `hono`, e adicionar bloco `[functions.mcp-reader]` no `supabase/config.toml` com `verify_jwt = false` (autenticação já é feita por `MCP_ACCESS_TOKEN` no header). Faço deploy e valido.

## 2. Corrigir bug latente da Sequência Viral

`ViralSequenceTab.tsx` lê `s.heading.trim()` em 2 lugares (linhas 102, 238) mas `heading` agora é `@deprecated` e opcional no tipo — qualquer carrossel novo vai dar `Cannot read properties of undefined`. Troco por `(s.heading?.trim() || s.body.trim())` e atualizo os comentários de doc que ainda falam de "heading + body".

## 3. Persistir Viral Hunter no Supabase (sair do `tags` JSON)

Hoje as keywords/concorrentes vivem em `clients.tags.viral_hunter` como string JSON — funciona, mas é frágil (sobrescreve outras tags se outro lugar editar) e impede queries cross-cliente. Migro pra duas tabelas dedicadas:

- `client_viral_keywords` (id, client_id, keyword, created_at) com unique(client_id, keyword)
- `client_viral_competitors` (id, client_id, platform, handle, notes, added_at)

Ambas com RLS via `client_workspace_accessible(client_id, auth.uid())`. Reescrevo `useViralHunterConfig.ts` pra ler/gravar nessas tabelas mantendo a mesma API pública (componentes não mudam). Migração de dados existentes do `tags` no SQL inicial.

## 4. Persistir Sequência Viral no Supabase

Hoje o `storage.ts` salva só em `sessionStorage` — perde tudo se trocar de aba/dispositivo. Crio:

- `viral_carousels` (id, client_id, workspace_id, user_id, title, briefing, profile jsonb, slides jsonb, status, created_at, updated_at) com RLS por workspace.

`storage.ts` vira async (load/save/list contra Supabase com fallback pro sessionStorage como cache otimista). Adiciono na UI: botão "Salvar" deixa de ser stub e grava de verdade; uma lista lateral "Carrosséis salvos" com possibilidade de retomar/deletar.

## 5. Mover YouTube API key pra backend (segurança)

Hoje `useYouTubeSearch.ts` usa `import.meta.env.VITE_YT_API_KEY` no client — chave fica exposta no bundle. Crio edge function `youtube-search` que recebe `{ query, publishedAfter, order, maxResults }`, valida JWT, chama YouTube Data API v3 com `YT_API_KEY` server-side, e retorna a lista normalizada. O hook passa a chamar essa função. Mesmo tratamento pra Google News (`google-news-search`) — `rss2json.com` é proxy de terceiro frágil; faço parsing direto do RSS no edge function com `DOMParser` do Deno.

## 6. Pequenas melhorias na Sequência Viral

- `imageSearch.ts` usa `source.unsplash.com` que **foi descontinuado** (retorna 503 hoje). Troco por edge function `unsplash-search` usando a API oficial (`UNSPLASH_ACCESS_KEY`) retornando 6 thumbnails pra galeria, em vez de 1 imagem aleatória.
- Conectar botão "Publicar" à integração LATE existente (publica os 8 slides como carrossel no Instagram/X).

## 7. QA e validação

- Compilar TypeScript local pra confirmar zero erros.
- Deploy de todas edge functions novas/modificadas.
- Testar cada sub-tab do Viral Hunter end-to-end: adicionar keyword → ver YouTube/News → mandar pro KAI.
- Testar Sequência Viral: gerar → editar → salvar no DB → recarregar página e ver que voltou.

## Secrets necessários

Vou pedir via tool de secrets: `YT_API_KEY` e `UNSPLASH_ACCESS_KEY` (se ainda não estiverem configurados).

## Resumo técnico

```text
NEW FILES
  supabase/functions/mcp-reader/deno.json                 (fix build)
  supabase/functions/youtube-search/index.ts              (proxy + log AI/cost)
  supabase/functions/google-news-search/index.ts          (RSS proxy)
  supabase/functions/unsplash-search/index.ts             (galeria)
  + 2 migrations: viral_keywords/competitors + viral_carousels

EDITED
  supabase/config.toml                                    (+ mcp-reader block)
  src/components/kai/viral-hunter/useViralHunterConfig.ts (DB-backed)
  src/components/kai/viral-hunter/useYouTubeSearch.ts     (call edge)
  src/components/kai/viral-hunter/useGoogleNews.ts        (call edge)
  src/components/kai/viral-sequence/storage.ts            (async + Supabase)
  src/components/kai/viral-sequence/imageSearch.ts        (edge function)
  src/components/kai/ViralSequenceTab.tsx                 (heading bug fix +
                                                          save/load real +
                                                          publish via LATE)
```

Não toco no logging de IA que arrumamos antes — todas edge functions novas já vão chamar `logAIUsage` quando consumirem LLM.

