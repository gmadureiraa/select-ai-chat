
# Plano: Auditoria de Código e Banco de Dados Não Utilizados

Este plano lista todos os arquivos, hooks, componentes, Edge Functions e tabelas de banco de dados que podem ser removidos ou precisam de avaliação para limpeza.

---

## ✅ Fase 1-3 Concluída: Hooks, Componentes e Libs Removidos

### Hooks Removidos (19 arquivos)
- ✅ `useContextualTasks.ts`, `useKAIBatchPlanning.ts`, `useConversationSearch.ts`
- ✅ `useSmartSuggestions.ts`, `kaiHooks.ts`, `useKAICSVAnalysis.ts`, `useKAIURLAnalysis.ts`
- ✅ `useProactiveSuggestions.ts`, `useChannelDataStatus.ts`, `useGlobalMentionSearch.ts`
- ✅ `useImportInstagramCSV.ts`, `useImportNewsletterCSV.ts`, `useImportContent.ts`
- ✅ `useLinkedInOAuth.ts`, `useTwitterOAuth.ts`, `useYouTubeSentiment.ts`
- ✅ `useServiceWorker.ts`, `useSmoothScroll.ts`, `useScrollDirection.ts`

### Componentes Removidos (13 arquivos)
- ✅ `kai/ProactiveSuggestions.tsx`
- ✅ `ChatSidebar.tsx`, `ModelSelector.tsx`, `TokensBadge.tsx`
- ✅ `content/ContentViewDialog.tsx`, `content/ContentEditor.tsx`
- ✅ `onboarding/KAITutorial.tsx`, `onboarding/ProgressChecklist.tsx`
- ✅ `docs/ExportableDocumentation.tsx`
- ✅ `tools/FormatRulesTool.tsx`, `tools/CreateFormatRuleModal.tsx`
- ✅ `calendar/ContentCalendar.tsx`, `calendar/SchedulePostDialog.tsx`
- ✅ `kanban/AddCardDialog.tsx`, `kanban/KanbanBoard.tsx`

### Libs Removidos (2 arquivos)
- ✅ `lib/api/firecrawl.ts`
- ✅ `lib/mediaDownload.ts`

---

## 🔜 Fase 4: Edge Functions a Avaliar

| Função | Situação | Recomendação |
|--------|----------|--------------|
| `grok-search` | Apenas mencionado em documentação; requer GROK_API_KEY não configurada | Remover se não usado |
| `kai-smart-planner` | Nenhum import/invoke encontrado no frontend | Remover se obsoleto |
| `check-subscription` | Apenas mencionado em documentação | Verificar se usado por webhook/cron |
| `process-due-date-notifications` | Nenhum invoke no frontend; provavelmente cron job | Manter se configurado como cron |
| `import-beehiiv-newsletters` | Apenas mencionado em documentação | Verificar uso |
| `kai-chat` | Usado apenas por useKAIChatStream (que pode ser obsoleto) | Avaliar se kai-simple-chat substitui |

---

## 🔜 Fase 5: Tabelas do Banco de Dados a Remover

### 5.1 Tabelas Legadas (Provavelmente não usadas)

| Tabela | Situação | Recomendação |
|--------|----------|--------------|
| `proactive_suggestions` | Hook/componente removidos | **REMOVER** |
| `prompt_templates` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `kai_documentation` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `instagram_tokens` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por OAuth |
| `youtube_tokens` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por OAuth |
| `social_credentials_audit_log` | Apenas no types.ts; nenhum uso no código | **REMOVER** |
| `rss_triggers` | Apenas no types.ts; nenhum uso no código | **REMOVER** se não usado por automações |
| `user_activities` | Apenas no types.ts; função log_user_activity existe mas não é chamada | **REMOVER** |

### 5.2 Tabelas de Research (Feature removida)

| Tabela | Situação |
|--------|----------|
| `research_comments` | Apenas no types.ts |
| `research_conversations` | Apenas no types.ts |
| `research_items` | Apenas no types.ts |
| `research_messages` | Apenas no types.ts |
| `research_project_shares` | Apenas no types.ts |
| `research_project_versions` | Apenas no types.ts |

---

## 🔜 Fase 6: Duplicações a Consolidar

| Código Duplicado | Onde | Ação |
|-----------------|------|------|
| `urlToBlob()` e `getExtensionFromUrl()` | `MediaUploader.tsx`, `ImageLightbox.tsx` | Criar `lib/mediaUtils.ts` e importar |
| `kanban_cards` vs `planning_items` | Duas tabelas para planejamento | Avaliar migração completa para `planning_items` |
| `conversations` vs `kai_chat_conversations` | Duas tabelas de conversas | Avaliar consolidação |
| `messages` vs `kai_chat_messages` | Duas tabelas de mensagens | Avaliar consolidação |

---

## Resumo de Impacto (Atualizado)

| Categoria | Status | Quantidade |
|-----------|--------|------------|
| Hooks removidos | ✅ Concluído | 19 arquivos |
| Componentes removidos | ✅ Concluído | 15 arquivos |
| Libs removidos | ✅ Concluído | 2 arquivos |
| Edge Functions a avaliar | 🔜 Pendente | 6 funções |
| Tabelas a remover | 🔜 Pendente | ~14 tabelas |

**Benefícios alcançados:**
- Redução de ~36 arquivos no frontend
- Builds mais rápidos
- Menos confusão sobre o que é usado vs legado
