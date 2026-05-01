## Contexto

O "Webhooks" do print é da própria Late (rebrand para Zernio) — a mesma API que já usamos para publicar. Já temos `supabase/functions/late-webhook/index.ts` recebendo `post.published`, `post.failed`, `post.scheduled` e `account.disconnected/expired`, mas:

- **Falhas hoje só atualizam o status no banco** — você não recebe alerta no Telegram quando um post quebra.
- Não tratamos os eventos novos da lista do print: `post.partial`, `post.cancelled`, `post.recycled`, `account.ads.initial_sync_completed`, `message.*`, `comment.received`.
- Não há painel para ver/criar webhooks dentro do kAI.

## Para que serve (respondendo sua pergunta)

**Sim, vale muito.** Casos de uso priorizados:

1. **Alerta de falha de post no Telegram** (alta prioridade)
   Quando `post.failed` chega, manda mensagem no bot com cliente, plataforma, motivo do erro e link pro item no Kanban. Hoje você só descobre abrindo o painel.

2. **Alerta de conta desconectada/expirada** (alta)
   `account.disconnected` / `account.expired` → Telegram avisando "⚠️ Instagram do Madureira desconectou, reconecte". Hoje a publicação simplesmente para de funcionar silenciosamente.

3. **Confirmação de publicação parcial** (`post.partial`)
   Quando publica em 3 redes mas falha em 1 — hoje marcamos como `published` mesmo. Passar a marcar como `partial` e avisar no Telegram qual rede falhou.

4. **Inbox unificada de comentários e DMs** (média — feature nova)
   `comment.received` + `message.received` permitem construir uma caixa de entrada dentro do kAI (estilo Engagement Hub, mas para respostas em posts publicados). Roadmap futuro — não entra agora.

5. **Sincronizar cancelamento e reciclagem** (`post.cancelled`, `post.recycled`)
   Se você cancela/recicla na Late, refletir no Kanban automaticamente.

## Escopo desta entrega

Foco em **#1, #2, #3 e #5**. A inbox de DMs/comentários (#4) fica para depois (precisa schema novo + UI dedicada).

### 1. Estender `late-webhook/index.ts`

- Adicionar handlers para:
  - `post.partial` → status `partial`, metadata com plataformas que falharam, dispara Telegram.
  - `post.cancelled` → status `cancelled`.
  - `post.recycled` → cria novo planning_item linkado ao original (ou só loga em metadata, decidir).
- Em `post.failed`: chamar `telegram-send-notification` com mensagem formatada + botão "Ver no painel".
- Em `account.disconnected` / `account.expired`: chamar Telegram com aviso urgente + cliente afetado.

### 2. Novo helper Telegram

Criar função `notifyWebhookEvent(supabase, eventType, planningItem, extra)` dentro do `late-webhook` que:
- Busca `clients.name` para mostrar qual cliente.
- Busca `telegram_bot_config.chat_id`.
- Formata mensagem com emoji por severidade (🔴 falha, 🟡 parcial, ⚠️ conta).
- Reusa o gateway `https://connector-gateway.lovable.dev/telegram/sendMessage` (mesmo padrão de `telegram-notify`).

### 3. UI: painel de Webhooks no kAI (opcional mas recomendado)

Em **Settings → Integrações**, nova aba "Webhooks Late" mostrando:
- URL do webhook a configurar na Late: `https://tkbsjtgrumhvwlxkmojg.supabase.co/functions/v1/late-webhook`
- Lista de eventos suportados com checkboxes (informativo — instrução de marcar todos lá na Late).
- Status: "Último evento recebido há X min" (lê de uma nova tabela `webhook_events_log` ou de `planning_items.updated_at`).
- Botão "Testar webhook" que envia um POST fake para validar o secret.

### 4. Tabela de log (para debug)

```sql
create table webhook_events_log (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'late',
  event_type text not null,
  payload jsonb,
  processed_ok boolean,
  error_message text,
  created_at timestamptz default now()
);
```
Insert em todo evento recebido. Útil para debugar quando algo "não chegou".

## Detalhes técnicos

- **Secret HMAC já implementado** (`LATE_WEBHOOK_SECRET` + header `x-late-signature`). Funciona igual no Zernio.
- **Severidade Telegram**:
  - 🔴 `post.failed`, `account.disconnected`, `account.expired`
  - 🟡 `post.partial`, `post.cancelled`
  - 🟢 `post.recycled` (silencioso, só log)
- **Anti-spam**: se 5+ falhas no mesmo cliente em 10 min, agrupar em uma única mensagem ("3 posts do Jornal Cripto falharam no Instagram").
- **Não mandar Telegram para `post.published`** — já temos isso pelo fluxo de automação atual; evita ruído.

## Arquivos

- `supabase/functions/late-webhook/index.ts` — estender
- `supabase/migrations/<timestamp>_webhook_events_log.sql` — nova tabela
- `src/components/settings/WebhookSettings.tsx` — novo (se aprovar #3)
- Memory: `mem://features/integrations/late-webhook-event-handling.md`

## Fora de escopo (próximos passos)

- Inbox de `comment.received` / `message.received` (precisa schema + UI nova).
- `account.ads.initial_sync_completed` (só relevante quando integrarmos Meta Ads via Late).

Posso seguir com #1, #2, #3, #5 + tabela de log + painel simples em Settings?
