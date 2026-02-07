
# Plano: Auditoria de Código e Banco de Dados Não Utilizados

Este plano lista todos os arquivos, hooks, componentes, Edge Functions e tabelas de banco de dados que podem ser removidos ou precisam de avaliação para limpeza.

---

## 1. Hooks Não Utilizados (Remover)

| Arquivo | Razão |
|---------|-------|
| `src/hooks/useContextualTasks.ts` | Nenhum import encontrado no projeto |
| `src/hooks/useKAIBatchPlanning.ts` | Nenhum import encontrado no projeto |
| `src/hooks/useConversationSearch.ts` | Nenhum import encontrado no projeto |
| `src/hooks/useSmartSuggestions.ts` | Apenas mencionado em documentação; não usado em código |
| `src/hooks/kaiHooks.ts` | Barrel file nunca importado; hooks são importados diretamente |
| `src/hooks/useKAICSVAnalysis.ts` | Apenas re-exportado por kaiHooks; sem consumidores |
| `src/hooks/useKAIURLAnalysis.ts` | Apenas re-exportado por kaiHooks; sem consumidores |
| `src/hooks/useProactiveSuggestions.ts` | Usado apenas por ProactiveSuggestions.tsx que nunca é renderizado |
| `src/hooks/useChannelDataStatus.ts` | Nenhum import encontrado no projeto |
| `src/hooks/useGlobalMentionSearch.ts` | Nenhum import encontrado no projeto |
| `src/hooks/useImportInstagramCSV.ts` | Nenhum import encontrado (substituído por Smart Import) |
| `src/hooks/useImportNewsletterCSV.ts` | Nenhum import encontrado (substituído por Smart Import) |
| `src/hooks/useLinkedInOAuth.ts` | Nenhum import encontrado |
| `src/hooks/useTwitterOAuth.ts` | Nenhum import encontrado |
| `src/hooks/useYouTubeSentiment.ts` | Nenhum import encontrado |
| `src/hooks/useServiceWorker.ts` | Nenhum import encontrado |
| `src/hooks/useSmoothScroll.ts` | Nenhum import encontrado |
| `src/hooks/useScrollDirection.ts` | Nenhum import encontrado |
| `src/hooks/useImportContent.ts` | Nenhum import encontrado |

---

## 2. Componentes Não Utilizados (Remover)

| Arquivo | Razão |
|---------|-------|
| `src/components/kai/ProactiveSuggestions.tsx` | Nunca renderizado em nenhum componente |
| `src/components/ChatSidebar.tsx` | Nenhum import encontrado (substituído por ConversationHistorySidebar) |
| `src/components/ModelSelector.tsx` | Nenhum import encontrado |
| `src/components/TokensBadge.tsx` | Nenhum import encontrado |
| `src/components/content/ContentViewDialog.tsx` | Nenhum import encontrado |
| `src/components/content/ContentEditor.tsx` | Import encontrado mas usado apenas para transcribeImages; RichContentEditor é preferido |
| `src/components/calendar/ContentCalendar.tsx` | Nenhum import externo (apenas interno com SchedulePostDialog) |
| `src/components/tools/FormatRulesTool.tsx` | Nenhum import encontrado |
| `src/components/onboarding/KAITutorial.tsx` | Exportado mas nunca importado |
| `src/components/onboarding/ProgressChecklist.tsx` | Exportado mas nunca importado |
| `src/components/docs/ExportableDocumentation.tsx` | Nenhum import encontrado (apenas documentação) |

---

## 3. Libs/Utils Não Utilizados (Remover)

| Arquivo | Razão |
|---------|-------|
| `src/lib/api/firecrawl.ts` | `firecrawlApi` nunca importado (Edge Function é usada diretamente) |
| `src/lib/mediaDownload.ts` | Nenhum import; funções duplicadas em MediaUploader e ImageLightbox |

---

## 4. Pastas de Componentes a Avaliar

| Pasta | Situação |
|-------|----------|
| `src/components/kanban/` | KanbanBoard.tsx e AddCardDialog.tsx só são importados entre si; não usados externamente. O planejamento migrou para `planning/` |
| `src/components/calendar/` | ContentCalendar.tsx não é importado; CalendarView em planning/ é usado |

---

## 5. Edge Functions a Avaliar

| Função | Situação | Recomendação |
|--------|----------|--------------|
| `grok-search` | Apenas mencionado em documentação; requer GROK_API_KEY não configurada | Remover se não usado |
| `kai-smart-planner` | Nenhum import/invoke encontrado no frontend | Remover se obsoleto |
| `check-subscription` | Apenas mencionado em documentação | Verificar se usado por webhook/cron |
| `process-due-date-notifications` | Nenhum invoke no frontend; provavelmente cron job | Manter se configurado como cron |
| `import-beehiiv-newsletters` | Apenas mencionado em documentação | Verificar uso |
| `kai-chat` | Usado apenas por useKAIChatStream (que pode ser obsoleto) | Avaliar se kai-simple-chat substitui |

---

## 6. Tabelas do Banco de Dados a Avaliar

### 6.1 Tabelas Legadas (Provavelmente não usadas)

| Tabela | Situação | Recomendação |
|--------|----------|--------------|
| `conversations` | Usada por useClientChat e useConversationHistory para KAI Sidebar (chat antigo) | **MANTER** - ainda em uso ativo |
| `messages` | Usada por useClientChat para armazenar mensagens | **MANTER** - ainda em uso ativo |
| `kanban_cards` | Usada por useKanbanBoard e UpcomingContent | **AVALIAR** - migrar para planning_items? |
| `kanban_columns` | Usada por usePlanningItems e useKanbanBoard | **MANTER** - ainda necessária |
| `proactive_suggestions` | Usada apenas por hook/componente não utilizados | **REMOVER** após remover hook/componente |
| `prompt_templates` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `kai_documentation` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `instagram_tokens` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por OAuth |
| `youtube_tokens` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por OAuth |
| `social_credentials_audit_log` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `rss_triggers` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por automações |
| `user_activities` | Apenas no types.ts; função log_user_activity existe mas não é chamada | **REMOVER** |

### 6.2 Tabelas de Research (Feature removida?)

| Tabela | Situação |
|--------|----------|
| `research_comments` | Apenas no types.ts |
| `research_conversations` | Apenas no types.ts |
| `research_items` | Apenas no types.ts |
| `research_messages` | Apenas no types.ts |
| `research_project_shares` | Apenas no types.ts |
| `research_project_versions` | Apenas no types.ts |

**Recomendação**: Se a feature de Research foi removida, essas 6 tabelas podem ser removidas.

---

## 7. Duplicações a Consolidar

| Código Duplicado | Onde | Ação |
|-----------------|------|------|
| `urlToBlob()` e `getExtensionFromUrl()` | `MediaUploader.tsx`, `ImageLightbox.tsx` | Mover para `lib/mediaDownload.ts` e importar |
| `kanban_cards` vs `planning_items` | Duas tabelas para planejamento | Avaliar migração completa para `planning_items` |
| `conversations` vs `kai_chat_conversations` | Duas tabelas de conversas | Avaliar consolidação |
| `messages` vs `kai_chat_messages` | Duas tabelas de mensagens | Avaliar consolidação |

---

## 8. Ordem de Execução da Limpeza

### Fase 1: Hooks (Baixo Risco)
1. Remover hooks não utilizados listados na seção 1
2. Commit: `chore: remove unused hooks`

### Fase 2: Componentes (Baixo Risco)
1. Remover componentes não utilizados listados na seção 2
2. Commit: `chore: remove unused components`

### Fase 3: Libs (Baixo Risco)
1. Remover libs não utilizadas listadas na seção 3
2. Commit: `chore: remove unused lib files`

### Fase 4: Pastas (Médio Risco)
1. Avaliar e remover pastas kanban/ e calendar/ se confirmado que não são usadas
2. Commit: `chore: remove legacy kanban and calendar components`

### Fase 5: Edge Functions (Médio Risco)
1. Verificar logs de cada função antes de remover
2. Remover apenas funções sem chamadas nos últimos 30 dias
3. Commit: `chore: remove unused edge functions`

### Fase 6: Banco de Dados (Alto Risco)
1. **ANTES**: Fazer backup das tabelas
2. Verificar que nenhum dado importante será perdido
3. Remover tabelas em ordem reversa de dependências (FKs)
4. Migration: `chore: remove unused database tables`

---

## Resumo de Impacto

| Categoria | Quantidade | Arquivos/Tabelas |
|-----------|------------|------------------|
| Hooks a remover | ~19 | useContextualTasks, useKAIBatchPlanning, etc. |
| Componentes a remover | ~11 | ProactiveSuggestions, ChatSidebar, etc. |
| Libs a remover | 2 | firecrawl.ts, mediaDownload.ts |
| Edge Functions a avaliar | 6 | grok-search, kai-smart-planner, etc. |
| Tabelas a remover | ~12-18 | proactive_suggestions, prompt_templates, research_*, etc. |

**Benefícios esperados:**
- Redução de ~30-40 arquivos no frontend
- Redução de ~12-18 tabelas no banco
- Menor complexidade e manutenção
- Builds mais rápidos
- Menos confusão sobre o que é usado vs legado
