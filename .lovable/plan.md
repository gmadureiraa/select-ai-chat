

# Plano de Melhoria Completa do kAI Chat

## Fase 1: Limpeza e Consolidacao (Prioridade Alta)

### 1.1 Remover Componentes Nao Utilizados
- Deletar `src/components/kai-global/ActionConfirmationDialog.tsx`
- Deletar `src/components/kai-global/ActionProgressIndicator.tsx`  
- Deletar `src/components/kai-global/GlobalKAIInput.tsx` (versao antiga)
- Atualizar `src/components/kai-global/index.ts` para remover exports

### 1.2 Unificar Sistema de Chat
- Migrar `CanvasFloatingChat` para usar `useKAISimpleChat` em vez de `useClientChat`
- Isso garante que todos os chats usem o mesmo sistema simplificado

---

## Fase 2: Melhorias de UX no Painel (Prioridade Alta)

### 2.1 Adicionar Seletor de Cliente no Header
**Arquivo:** `GlobalKAIPanel.tsx`
- Adicionar dropdown para selecionar cliente diretamente no painel
- Mostrar avatar + nome do cliente selecionado
- Permitir trocar cliente sem fechar o painel

### 2.2 Adicionar Acoes no Header
**Arquivo:** `GlobalKAIPanel.tsx`
- Botao "Limpar conversa" com confirmacao
- Botao "Exportar" (Markdown/PDF) usando logica existente de `exportConversation.ts`

### 2.3 Melhorar Empty State
**Arquivo:** `GlobalKAIChat.tsx`
- Mostrar nome do cliente selecionado no empty state
- Se nenhum cliente selecionado, mostrar CTA para selecionar
- Adicionar mais sugestoes contextuais baseadas no cliente

### 2.4 Adicionar Botao Stop
**Arquivo:** `GlobalKAIInputMinimal.tsx`
- Quando `isProcessing=true`, mostrar botao de Stop (X) em vez de Send
- Chamar `cancelRequest` do hook ao clicar

### 2.5 Contador de Caracteres
**Arquivo:** `GlobalKAIInputMinimal.tsx`
- Mostrar contador de caracteres quando mensagem > 1000 chars
- Formato: "1,234 / 25,000"
- Mudar cor para warning quando > 20,000

---

## Fase 3: Melhorias de Feedback Visual (Prioridade Media)

### 3.1 Indicador de Erro nas Mensagens
**Arquivo:** `GlobalKAIChat.tsx`
- Detectar mensagens de erro (content inclui "erro" ou "insuficientes")
- Adicionar styling visual diferenciado (borda vermelha, icone)
- Adicionar botao "Tentar novamente" em mensagens de erro

### 3.2 Melhorar Indicador de Progresso
**Arquivo:** `SimpleProgress.tsx`
- Adicionar animacao de "typing" (3 dots pulsando)
- Mostrar tempo decorrido apos 5 segundos
- Estilo mais elegante e minimalista

### 3.3 Adicionar Toast de Sucesso
**Arquivo:** `useKAISimpleChat.ts`
- Nao mostrar toast em sucesso (silencioso)
- Apenas mostrar toast em erros especificos

---

## Fase 4: Melhorias no Backend (Prioridade Media)

### 4.1 Validacao de Subscription
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`
- Adicionar verificacao de plano do workspace
- Retornar 403 para planos starter/canvas (ja parcialmente implementado no frontend)

### 4.2 Otimizar Contexto
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`
- Aumentar limite do identity_guide de 5000 para 8000 chars
- Truncar citacoes de forma mais inteligente (priorizar conteudo recente)
- Adicionar logging estruturado para debug

### 4.3 Melhorar Tratamento de Erros
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`
- Retornar mensagens de erro mais especificas
- Diferenciar entre erros de API, timeout, e validacao

---

## Fase 5: Features Avancadas (Prioridade Baixa)

### 5.1 Persistencia de Conversa
- Salvar conversas no Supabase (tabela `kai_conversations`)
- Permitir retomar conversa anterior
- Implementar via `useKAISimpleChat` com opcao de persistencia

### 5.2 Sugestoes Inteligentes
**Arquivo:** `GlobalKAIChat.tsx`
- Apos resposta do assistente, mostrar 2-3 sugestoes de follow-up
- Baseadas no conteudo da resposta e contexto do cliente

### 5.3 Modo Voz (Futuro)
- Botao de microfone para input por voz
- Usar Web Speech API para transcricao

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `GlobalKAIPanel.tsx` | Adicionar seletor de cliente e acoes |
| `GlobalKAIChat.tsx` | Melhorar empty state e erro visual |
| `GlobalKAIInputMinimal.tsx` | Botao stop + contador chars |
| `SimpleProgress.tsx` | Animacao melhorada |
| `useKAISimpleChat.ts` | Adicionar cancelRequest exposto |
| `kai-simple-chat/index.ts` | Validacao subscription + otimizacoes |
| `CanvasFloatingChat.tsx` | Migrar para useKAISimpleChat |
| `GlobalKAIContext.tsx` | Expor clearConversation e cancelRequest |

## Arquivos a Deletar

- `ActionConfirmationDialog.tsx`
- `ActionProgressIndicator.tsx`  
- `GlobalKAIInput.tsx`

---

## Resultado Esperado

1. **Performance**: Chat mais rapido e consistente em todos os contextos
2. **UX**: Feedback visual claro, acoes intuitivas, empty states informativos
3. **Manutencao**: Codigo unificado, sem duplicacao de sistemas
4. **Confiabilidade**: Tratamento de erros robusto, validacoes no backend

