
# Análise Completa do Sistema kAI

Realizei uma auditoria abrangente do sistema e encontrei vários pontos que merecem atenção, organizados por prioridade.

---

## 🔴 Problemas Críticos

### 1. Bug no Modal de Exclusão de Automações
**Descrição:** O session replay mostrou que ao clicar em "Cancelar" no modal de exclusão, a automação foi excluída mesmo assim.

**Causa técnica:** O componente `AlertDialogAction` do Radix UI pode propagar eventos de forma inesperada. O padrão atual `onOpenChange={() => setDeleteId(null)}` fecha o modal mas pode haver um race condition onde o clique é registrado no botão errado.

**Solução:** Adicionar `e.preventDefault()` explícito e separar claramente os handlers, além de verificar se a mutação não está pendente antes de permitir nova exclusão.

---

### 2. Emails de Notificação Falhando
**Descrição:** Os logs mostram erro 403 do Resend: "The kaleidos.cc domain is not verified".

**Impacto:** As notificações por email não estão sendo entregues (2 emails na fila com erro).

**Solução:** Você precisa:
1. Verificar o domínio `kaleidos.cc` no painel do Resend, **OU**
2. Configurar um segredo `EMAIL_FROM_ADDRESS` com um email de domínio já verificado

---

### 3. Tabelas com RLS Habilitado mas Sem Políticas
**Tabelas afetadas:**
- `research_messages`
- `research_conversations`
- `research_items`
- `research_project_shares`
- `email_notification_queue`

**Risco:** Estas tabelas estão inacessíveis para operações via cliente frontend (RLS bloqueará tudo).

---

## 🟡 Problemas Moderados

### 4. Política RLS Permissiva Demais
**Tabela:** `planning_automation_runs`  
**Problema:** Política de UPDATE com `USING (true)` permite que qualquer usuário autenticado atualize registros de qualquer workspace.

**Solução:** Restringir para membros do workspace específico.

---

### 5. Dívida Técnica Significativa
**Arquivo `useClientChat.ts`:** 2.379 linhas em um único hook.

**Recomendação:** Refatorar em módulos menores:
- `useClientChatMessages.ts` - Gerenciamento de mensagens
- `useClientChatGeneration.ts` - Lógica de geração
- `useClientChatPipeline.ts` - Fluxo multi-agente
- `useClientChatFormatDetection.ts` - Detecção de formato

---

### 6. Tabelas Legadas Ainda no Banco
| Tabela | Registros | Status |
|--------|-----------|--------|
| `kanban_cards` | 2 | Legacy - migrar para `planning_items` |
| `conversations` | 23 | Legacy - migrar para `kai_chat_conversations` |
| `messages` | 336 | Legacy - migrar para `kai_chat_messages` |

**Recomendação:** Criar script de migração e depois remover tabelas.

---

## 🟢 Pontos Positivos Identificados

| Área | Status |
|------|--------|
| Automações | ✅ Funcionando (4 sucessos, 16 skips nas últimas 24h) |
| Cron Jobs | ✅ Executando regularmente (logs confirmam) |
| Push Notifications | ✅ Infraestrutura funcional |
| Secrets | ✅ 30 segredos configurados |
| Onboarding | ✅ Flow implementado |
| RLS Geral | ✅ Maioria das tabelas protegidas |

---

## 📋 Plano de Ação Sugerido

### Fase 1 - Correções Urgentes (Agora)
1. Corrigir bug do modal de exclusão de automações
2. Resolver problema do domínio Resend para emails funcionarem
3. Adicionar políticas RLS nas 5 tabelas sem políticas

### Fase 2 - Melhorias de Segurança (Próximos dias)
4. Corrigir política permissiva em `planning_automation_runs`
5. Implementar verificação de cron externo para confiabilidade

### Fase 3 - Refatoração (Próximas semanas)
6. Quebrar `useClientChat.ts` em módulos menores
7. Migrar e remover tabelas legadas
8. Implementar sistema de cache para URLs de referência

---

## 🎯 Recomendação Imediata

O mais urgente agora é:

1. **Verificar domínio no Resend** - Para que as notificações por email funcionem no seu iPhone
2. **Corrigir o bug de exclusão** - Para evitar que usuários excluam automações acidentalmente

Quer que eu comece corrigindo o bug do modal de exclusão?
