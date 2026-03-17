

## Bot Telegram — Gestão de Automações (v2)

### Funcionalidades implementadas

#### Comandos
- `/start` — Registra chat_id e ativa bot
- `/pendentes` — Lista 10 itens pendentes **com botões de ação inline** (aprovar/reprovar)
- `/status` — Resumo (pendentes, aprovados, publicados hoje)
- `/aprovar_todos` — Aprova em lote todos itens pendentes
- `/pular` — Pula feedback de rejeição

#### Ações inline (botões)
- ✅ Aprovar → Move item para coluna "approved"
- ❌ Reprovar → Marca como rejected + pede feedback com `forceReply`
- 🔄 Regenerar → Chama unified-content-api e reenvia preview
- 📝 Publicar agora → Publica via late-post (com link do post na confirmação)

#### IA e Criação
- **Texto livre** → Resposta por IA via Lovable AI Gateway (Gemini Flash) com contexto das últimas mensagens
- **Criação de conteúdo** → "cria um post sobre X para o [cliente]" detecta intent, gera conteúdo e cria planning_item com botões
- **Feedback de rejeição** → Ao reprovar, bot pede motivo e salva em `metadata.rejection_reason`

#### Relatório Diário
- Cron `daily-telegram-report` → 11:00 UTC (8h BRT)
- Envia resumo com: pendentes, aprovados, publicados ontem/hoje, reprovados, próximos agendados

### Edge Functions
- `telegram-poll` — Polling loop 55s + processamento completo
- `telegram-notify` — Envia notificações com botões inline
- `telegram-daily-report` — Resumo diário automático

### Cron Jobs
- `poll-telegram-updates` — A cada minuto
- `daily-telegram-report` — 11:00 UTC diário
