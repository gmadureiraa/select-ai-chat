# 📋 Plano de Implementação - Onboarding

**Data:** 31 de Dezembro de 2024  
**Status:** 📝 Plano Completo - Pronto para Implementação

---

## 🎯 OBJETIVO

Criar um fluxo de onboarding completo e eficiente que guie novos usuários pelos primeiros passos no sistema, garantindo que eles entendam como usar o kAI de forma efetiva.

---

## 📐 ESTRUTURA DO ONBOARDING

### Fluxo Proposto (3 Telas Principais)

```
Tela 1: Bem-vindo
  ↓
Tela 2: Criar Primeiro Cliente
  ↓
Tela 3: Explicar Sistema e Pronto para Começar
  ↓
Tooltips Contextuais (durante uso)
```

---

## 📱 TELAS DETALHADAS

### TELA 1: Bem-vindo

**Objetivo:** Introduzir o sistema e criar expectativas positivas

**Conteúdo:**
```
┌─────────────────────────────────────┐
│  🎉 Bem-vindo ao kAI!               │
│                                     │
│  Vamos configurar seu workspace     │
│  em poucos passos                   │
│                                     │
│  Você vai aprender:                 │
│  ✓ Como criar seu primeiro cliente  │
│  ✓ Como criar conteúdo com IA       │
│  ✓ Como usar o sistema de @         │
│                                     │
│  [Pular]  [Começar]                 │
└─────────────────────────────────────┘
```

**Elementos:**
- Logo/Branding
- Título acolhedor
- Lista de benefícios (o que vai aprender)
- Botão "Começar" (primary)
- Botão "Pular" (secondary, salva estado)

**Comportamento:**
- Se usuário clicar "Pular", salvar no localStorage que onboarding foi pulado
- Se clicar "Começar", ir para Tela 2

---

### TELA 2: Criar Primeiro Cliente

**Objetivo:** Criar o primeiro cliente (necessário para usar o sistema)

**Conteúdo:**
```
┌─────────────────────────────────────┐
│  📝 Passo 1: Criar seu primeiro     │
│     cliente                          │
│                                     │
│  Todo conteúdo precisa estar        │
│  associado a um cliente             │
│                                     │
│  Nome do Cliente:                   │
│  [_____________________]            │
│                                     │
│  Descrição (opcional):              │
│  [_____________________]            │
│  [_____________________]            │
│                                     │
│  [Voltar]  [Criar Cliente]          │
└─────────────────────────────────────┘
```

**Elementos:**
- Indicador de progresso (Passo 1 de 2)
- Explicação clara do que é um cliente
- Formulário simples:
  - Nome (obrigatório)
  - Descrição (opcional)
- Botões: Voltar, Criar Cliente

**Comportamento:**
- Validação: Nome obrigatório
- Ao criar cliente:
  - Salvar no banco
  - Marcar como cliente padrão
  - Ir para Tela 3

**Integração:**
- Usar hook/API existente para criar cliente
- Redirecionar após criação bem-sucedida

---

### TELA 3: Pronto para Começar

**Objetivo:** Explicar o sistema de @ e dar próximos passos

**Conteúdo:**
```
┌─────────────────────────────────────┐
│  ✅ Tudo pronto!                    │
│                                     │
│  Agora você pode criar conteúdo     │
│  usando nosso assistente de IA      │
│                                     │
│  💡 Dica: Use @ para mencionar      │
│     o tipo de conteúdo              │
│                                     │
│  Exemplos:                          │
│  • @newsletter sobre lançamento     │
│  • @carrossel explicando produto    │
│  • @tweet sobre novidade            │
│                                     │
│  [Começar a Criar]                  │
└─────────────────────────────────────┘
```

**Elementos:**
- Mensagem de sucesso
- Explicação do sistema de @
- Exemplos práticos
- Botão "Começar a Criar" (leva para o assistente)

**Comportamento:**
- Ao clicar "Começar a Criar":
  - Fechar onboarding
  - Redirecionar para assistente (tab=assistant)
  - Abrir tooltip contextual no input

---

## 💬 TOOLTIPS CONTEXTUAIS

### Objetivo:
Fornecer ajuda contextual quando o usuário acessa novas seções pela primeira vez.

### Implementação:

#### 1. Tooltip no Input do Assistente
```
┌─────────────────────────────────────┐
│  💡 Dica: Use @ para mencionar tipo │
│     de conteúdo (@newsletter, etc)  │
│                                     │
│  [Entendi]  [Não mostrar novamente] │
└─────────────────────────────────────┘
```

#### 2. Tooltip na Biblioteca
```
┌─────────────────────────────────────┐
│  📚 Biblioteca                      │
│                                     │
│  Aqui você encontra todo conteúdo   │
│  criado para este cliente           │
│                                     │
│  [Entendi]  [Não mostrar novamente] │
└─────────────────────────────────────┘
```

#### 3. Tooltip em Performance
```
┌─────────────────────────────────────┐
│  📊 Performance                     │
│                                     │
│  Veja métricas e análise de         │
│  desempenho do seu conteúdo         │
│                                     │
│  [Entendi]  [Não mostrar novamente] │
└─────────────────────────────────────┘
```

### Comportamento:
- Tooltips aparecem apenas na primeira vez que usuário acessa cada seção
- Opção "Não mostrar novamente" salva no localStorage
- Tooltips podem ser reativados nas Settings

---

## ✅ CHECKLIST DE PROGRESSO

### Objetivo:
Mostrar progresso visual do setup inicial

### Localização:
- Sidebar (collapsible ou sempre visível quando incompleto)
- Badge indicando progresso

### Itens do Checklist:

```
┌─────────────────────────────┐
│  ✅ Configuração Inicial    │
│  ─────────────────────────  │
│  ✓ Criar primeiro cliente   │
│  ⏳ Criar primeiro conteúdo  │
│  ⏳ Conectar rede social     │
│  ⏳ Agendar primeira post    │
└─────────────────────────────┘
```

### Comportamento:
- Marcar itens como concluídos conforme usuário realiza ações
- Ocultar quando todos concluídos (ou sempre visível em collapse)
- Sugerir próximo passo quando hover sobre item pendente

---

## 🛠️ IMPLEMENTAÇÃO TÉCNICA

### Componentes Necessários:

#### 1. OnboardingModal / OnboardingFlow
```typescript
// src/components/onboarding/OnboardingFlow.tsx
- Gerencia estado do fluxo
- Controla navegação entre telas
- Persiste estado (localStorage)
```

#### 2. OnboardingStep
```typescript
// src/components/onboarding/OnboardingStep.tsx
- Componente reutilizável para cada tela
- Props: title, content, onNext, onBack, onSkip
```

#### 3. ContextualTooltip
```typescript
// src/components/onboarding/ContextualTooltip.tsx
- Tooltip contextual que aparece uma vez
- Props: id, content, position
- Gerencia estado de "não mostrar novamente"
```

#### 4. ProgressChecklist
```typescript
// src/components/onboarding/ProgressChecklist.tsx
- Checklist de progresso
- Props: items, onComplete
- Integra com localStorage
```

### Estado e Persistência:

```typescript
// Usar localStorage para:
- onboarding_completed: boolean
- onboarding_skipped: boolean
- tooltips_dismissed: string[] (array de IDs)
- checklist_progress: { [key: string]: boolean }
```

### Hooks Necessários:

```typescript
// src/hooks/useOnboarding.ts
- Detecta se é primeira vez
- Controla estado do onboarding
- Gerencia tooltips
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Estrutura Base (2-3 dias)
- [ ] Criar componente `OnboardingFlow.tsx`
- [ ] Criar componente `OnboardingStep.tsx`
- [ ] Criar hook `useOnboarding.ts`
- [ ] Implementar persistência (localStorage)
- [ ] Detectar usuário novo (primeira vez)

### Fase 2: Telas do Onboarding (2-3 dias)
- [ ] Implementar Tela 1: Bem-vindo
- [ ] Implementar Tela 2: Criar Primeiro Cliente
- [ ] Integrar criação de cliente (API/hook existente)
- [ ] Implementar Tela 3: Pronto para Começar
- [ ] Testar fluxo completo

### Fase 3: Tooltips Contextuais (1-2 dias)
- [ ] Criar componente `ContextualTooltip.tsx`
- [ ] Implementar tooltip no input do assistente
- [ ] Implementar tooltips nas principais seções
- [ ] Sistema de dismiss/persistência
- [ ] Opção para reativar nas Settings

### Fase 4: Checklist de Progresso (1-2 dias)
- [ ] Criar componente `ProgressChecklist.tsx`
- [ ] Integrar na sidebar
- [ ] Marcar itens como concluídos
- [ ] Sugerir próximos passos
- [ ] Ocultar quando completo (ou collapse)

### Fase 5: Integração e Testes (1-2 dias)
- [ ] Integrar onboarding no fluxo de login/signup
- [ ] Testar fluxo completo
- [ ] Testar persistência de estado
- [ ] Testar em diferentes cenários
- [ ] Ajustes de UX baseados em feedback

---

## 🎨 DESIGN E UX

### Princípios:
- ✅ Simples e direto (não sobrecarregar)
- ✅ Visual claro e agradável
- ✅ Fácil de pular (mas encorajar completar)
- ✅ Progresso visível
- ✅ Não intrusivo

### Elementos Visuais:
- Indicador de progresso (1/2, 2/2)
- Ícones para cada etapa
- Cores consistentes com brand
- Animações sutis (opcional)

---

## 📊 MÉTRICAS DE SUCESSO

### KPIs:
- Taxa de conclusão do onboarding (% que completa)
- Taxa de criação do primeiro cliente
- Tempo para criar primeiro conteúdo
- Taxa de uso do sistema de @
- Taxa de retenção após onboarding

---

## ✅ PRÓXIMOS PASSOS

1. ✅ Aprovar estrutura proposta
2. ✅ Criar mockups/wireframes se necessário
3. ✅ Implementar Fase 1 (estrutura base)
4. ✅ Implementar Fase 2 (telas)
5. ✅ Implementar Fase 3 (tooltips)
6. ✅ Implementar Fase 4 (checklist)
7. ✅ Testar e ajustar
8. ✅ Deploy

---

**Status:** 📝 Plano Completo - Pronto para Implementação

**Última atualização:** 31 de Dezembro de 2024

