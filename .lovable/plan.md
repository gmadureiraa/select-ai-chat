# Fix: falso "tempo esgotado" no KAI quando publica

## Diagnóstico
Tools longas (`publishNow`, `createViralCarousel`) levam 30–45s. Durante esse tempo o stream SSE fica em silêncio → proxy/browser derruba a conexão → UI mostra "tempo esgotado" mesmo com a publicação tendo dado certo no backend. Quando o user clica "tentar de novo", a Late API responde **409 duplicate** (bloqueio de 24h), e o KAI mostra outro erro confuso.

## O que vou mudar

### 1. Heartbeat SSE (`supabase/functions/_shared/kai-stream.ts`)
- Adicionar `heartbeat()` no `KAIStreamEmitter` que envia comentário SSE (`: keepalive\n\n`) — invisível pro parser, mantém a conexão viva.
- Adicionar `startHeartbeat(intervalMs)` que retorna função de stop. Default 10s.

### 2. Runner usa heartbeat durante tools longas (`supabase/functions/kai-simple-chat/tools/runner.ts`)
- Antes de invocar cada tool: `const stop = emit.startHeartbeat(10_000)`.
- Depois (em try/finally): `stop()`.
- Garante que NENHUMA tool fique mais de 10s sem mandar bytes pelo socket.

### 3. Tratamento de 409 no `late-post` (`supabase/functions/late-post/index.ts`)
- Quando Late responder 409 (duplicate): NÃO tratar como erro genérico.
- Verificar se o `planning_item` já tem `late_post_id` / `published_urls` preenchidos.
  - Se sim → retornar `{ ok: true, alreadyPublished: true, ...urls }` e marcar item como `published`.
  - Se não → retornar `{ ok: false, code: "DUPLICATE_BLOCKED", message: "Late API bloqueou repost (24h). Confira a conta." }`.

### 4. Reconciliação no front (`src/hooks/useKAISimpleChat.ts`)
- Se o stream der erro/timeout E houver uma tool `publishNow`/`createViralCarousel` em andamento:
  - Buscar o `planning_item` correspondente no banco.
  - Se status virou `published` ou `scheduled` → emitir card de sucesso ao invés de erro.
  - Se ainda `publishing` → mostrar "publicação rodando em segundo plano, atualize em alguns segundos".

### 5. UI clara (`src/components/chat/ActionCard.tsx` + `src/components/planning/PublicationStatusBadge.tsx`)
- ActionCard: enquanto `tool_running` ativo pra publishNow, badge "Publicando… (pode levar até 1min)" + desabilitar botão "Tentar novamente" por 60s.
- PublicationStatusBadge: novo estado visual pra `DUPLICATE_BLOCKED` ("Já publicado / bloqueado pela API") com tooltip explicativo, sem botão de retry.

## Resumo técnico
```text
LLM → tool publishNow ──┐
                        ├─ runner inicia heartbeat (10s)
late-post (40s) ────────┤   ↓ stream nunca silencia
   ├─ 200 OK → card published
   ├─ 409   → confere planning_item
   │           ├─ já published → card success
   │           └─ não         → card "duplicate blocked" (sem retry)
                        ↓
                     stop heartbeat
```

## Arquivos tocados
- `supabase/functions/_shared/kai-stream.ts` — `heartbeat()` + `startHeartbeat()`
- `supabase/functions/kai-simple-chat/tools/runner.ts` — wrap de tools com heartbeat
- `supabase/functions/late-post/index.ts` — tratamento de 409 + reconciliação
- `src/hooks/useKAISimpleChat.ts` — fallback de status quando stream cai
- `src/components/chat/ActionCard.tsx` — UX de "publicando…" persistente
- `src/components/planning/PublicationStatusBadge.tsx` — estado `duplicate_blocked`
- `src/types/kai-stream.ts` — tipos espelhados (heartbeat é só transport, não muda payload)

## O que NÃO muda
- Protocolo SSE público (continua OpenAI-compatible).
- Lógica de geração de imagem do carrossel (já tá ok).
- Auth, RLS, schema do banco.

## Testes manuais pós-deploy
1. Publicar um post novo via chat → deve mostrar "Publicando…" e card de sucesso, sem timeout.
2. Tentar publicar 2x o mesmo → segunda vez mostra "Já publicado" sem erro vermelho.
3. Forçar erro real (conta desconectada) → mensagem clara, botão de reconectar.