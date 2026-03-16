

## Bot Telegram — Gestão de Automações (Implementado)

### O que foi feito

1. **Tabelas criadas:**
   - `telegram_bot_config` — Singleton com chat_id e offset do polling
   - `telegram_messages` — Log de mensagens/callbacks recebidos

2. **Edge Functions:**
   - `telegram-notify` — Envia conteúdo gerado + botões inline (Aprovar/Reprovar/Regenerar/Publicar)
   - `telegram-poll` — Polling loop de 55s com processamento de callbacks e comandos

3. **Integração no `process-automations`:**
   - Após cada item criado, envia notificação Telegram com preview + imagem + botões

4. **Cron Job:**
   - `poll-telegram-updates` — Executa a cada minuto via pg_cron

### Comandos disponíveis no bot
- `/start` — Registra chat_id e ativa bot
- `/pendentes` — Lista 10 itens pendentes
- `/status` — Resumo (pendentes, aprovados, publicados hoje)

### Ações inline (botões)
- ✅ Aprovar → Move item para coluna "approved"
- ❌ Reprovar → Marca como rejected
- 🔄 Regenerar → Chama unified-content-api e reenvia preview
- 📝 Publicar agora → Publica via late-post

### Próximo passo
- Enviar `/start` para o bot no Telegram para registrar o chat_id
