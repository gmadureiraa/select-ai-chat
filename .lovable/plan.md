
# Plano de Implementação: Melhorias kAI Chat

Este plano aborda todas as melhorias solicitadas no documento, organizadas por prioridade e dependências técnicas.

---

## Resumo do Estado Atual

O sistema já possui:
- Pipeline `unified-content-api` com validação em 4 etapas (Writer → Validate → Repair → Review)
- Schemas de formato (`format-schemas.ts`), validador de conteúdo, regras de qualidade
- Voice Profile estruturado (Use/Evite) e knowledge-loader completo
- `MessageFeedback` com ações Usar/Editar/Refazer/Salvar
- `SourcesBadge` para transparência de fontes
- `AddToPlanningButton` funcional com integração ao `PlanningItemDialog`
- Detecção de formato por texto natural (`detectContentType`)

---

## Fase 1: API Resiliente (Retry + Fallback)

**Objetivo:** Garantir que o conteúdo NUNCA deixe de ser criado por falha de uma única API.

### 1.1 Criar módulo `_shared/llm.ts`

Centralizar chamadas de IA com:

```text
┌─────────────────────────────────────────────────────────────┐
│                    callLLM(messages, options)                │
├─────────────────────────────────────────────────────────────┤
│ 1. Verificar qual chave está configurada                    │
│    - GOOGLE_AI_STUDIO_API_KEY → Gemini primário             │
│    - OPENAI_API_KEY → OpenAI primário                       │
│    - Nenhuma → Erro: "Configure ao menos uma chave de IA"   │
├─────────────────────────────────────────────────────────────┤
│ 2. Tentar provider primário com retry (2-3x, backoff)       │
│    - Delay: 1s → 2s → 4s                                    │
│    - Retryable: 429, 500, 502, 503, timeout                 │
├─────────────────────────────────────────────────────────────┤
│ 3. Se falhar → Tentar provider secundário (fallback)        │
│    - Converter formato de mensagens se necessário           │
│    - Mesmo retry strategy                                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Se ambos falharem → Throw com mensagem clara             │
│    - "Serviço de IA temporariamente indisponível"           │
└─────────────────────────────────────────────────────────────┘
```

**Funções exportadas:**
- `callLLM(messages, options)` → Para chamadas não-streaming
- `streamLLM(messages, options)` → Para streaming SSE
- `isLLMConfigured()` → Verificação de chaves

### 1.2 Migrar `unified-content-api`

| Antes | Depois |
|-------|--------|
| `callGemini()` direto | `callLLM()` do `_shared/llm.ts` |
| Erro 500 genérico | Erro 503 + `Retry-After` header |
| Sem conteúdo parcial | Se writer OK mas repair falhou → 200 + warning |

### 1.3 Migrar `chat/index.ts`

- Usar `streamLLM()` para streaming
- Suportar modelo dinâmico (Gemini ou OpenAI baseado no prefixo)
- Mesmo tratamento de erros (503 com retry)

### 1.4 Frontend: Tratar 503

Em `useClientChat.ts`, ao receber status 503:
1. Exibir toast: "Serviço de IA temporariamente indisponível"
2. Mostrar botão "Tentar novamente" na mensagem de erro
3. Usar `Retry-After` header se disponível

**Arquivos a criar/modificar:**

| Arquivo | Ação |
|---------|------|
| `supabase/functions/_shared/llm.ts` | CRIAR |
| `supabase/functions/unified-content-api/index.ts` | Usar callLLM |
| `supabase/functions/chat/index.ts` | Usar streamLLM |
| `src/hooks/useClientChat.ts` | Tratar 503 |

---

## Fase 2: Fluxo de Hooks/Narrativas

**Objetivo:** Para formatos ricos, apresentar opções de hooks antes de gerar o conteúdo final.

### 2.1 Nova interface de fluxo

```text
┌─────────────────────────────────────────────────────────────┐
│            FLUXOS POR TIPO DE FORMATO                        │
├─────────────────────────────────────────────────────────────┤
│ FORMATOS RICOS (LinkedIn, Carrossel, Newsletter, Blog,      │
│                 Stories, Vídeo, Email):                      │
│                                                              │
│ 1. Usuário pede conteúdo                                    │
│ 2. kAI gera 3-5 ideias de HOOKS/NARRATIVAS                  │
│    └── Exibe como cards clicáveis                           │
│ 3. Usuário escolhe um hook                                  │
│ 4. (Opcional) Tela de briefing: objetivo, tom, CTA          │
│ 5. Gera conteúdo final com unified-content-api              │
│ 6. Ações: Usar | Editar | Refazer | Salvar                  │
├─────────────────────────────────────────────────────────────┤
│ FORMATOS SIMPLES (Tweet, Thread):                            │
│                                                              │
│ 1. Usuário pede conteúdo                                    │
│ 2. Gera conteúdo direto com unified-content-api             │
│ 3. Ações: Usar | Editar | Refazer | Salvar                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Componente `HookSelectorCard`

Exibe as opções de hooks como cards interativos:

```text
┌─────────────────────────────────────────────────────────────┐
│ 📝 Escolha o gancho para seu conteúdo                        │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────┐         │
│ │ 💡 Pergunta provocativa│ │ 📊 Dado surpreendente │         │
│ │ "Por que 90% dos..."  │ │ "78% das empresas..." │         │
│ └───────────────────────┘ └───────────────────────┘         │
│ ┌───────────────────────┐ ┌───────────────────────┐         │
│ │ 🎯 Promessa de valor  │ │ 📖 História pessoal   │         │
│ │ "Como aumentei..."    │ │ "Em 2019, eu..."     │         │
│ └───────────────────────┘ └───────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Edge function `generate-hooks`

Nova função que gera apenas hooks/narrativas:

- Input: `{ clientId, format, topic, brief }`
- Output: `{ hooks: [{ type, preview, fullIdea }] }`
- Usa contexto do cliente (voice profile, biblioteca)

### 2.4 Indicadores de progresso por estágio

Atualizar `PipelineProgress` para 4 estágios claros:

| Estágio | Label | Descrição |
|---------|-------|-----------|
| Define | "Escolha o hook" | Seleção de narrativa |
| Explore | "Gerando" | Writer ativo |
| Refine | "Validando" | Validação + Repair |
| Export | "Pronto" | Revisão concluída |

**Arquivos a criar/modificar:**

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-hooks/index.ts` | CRIAR |
| `src/components/chat/HookSelectorCard.tsx` | CRIAR |
| `src/components/chat/PipelineProgress.tsx` | Adicionar estágios |
| `src/hooks/useClientChat.ts` | Fluxo de hooks |

---

## Fase 3: Integração Usar → Planejamento

**Objetivo:** Clicar "Usar" abre o dialog de planejamento com conteúdo pré-preenchido.

### 3.1 Modificar `MessageFeedback`

Alterar comportamento do botão "Usar":

```text
Antes: Marca como aprovado + copia para clipboard
Depois: 
  1. Se tem plano Pro → Abre PlanningItemDialog com conteúdo pré-preenchido
  2. Se não tem Pro → showUpgradePrompt("planning_locked")
```

### 3.2 Modificar props do `MessageFeedback`

Adicionar:
- `onUse?: (content: string) => void` - Callback para abrir planejamento
- `hasPlanning?: boolean` - Flag de feature gate

### 3.3 Integrar no `EnhancedMessageBubble`

Passar as novas props e conectar ao `AddToPlanningButton` existente.

### 3.4 Fluxo rápido no dialog

Quando aberto a partir do chat:
1. Pré-selecionar cliente da conversa atual
2. Pré-selecionar coluna "Ideia" ou "Rascunho"
3. Foco no campo de data ou no botão "Salvar"

**Arquivos a modificar:**

| Arquivo | Ação |
|---------|------|
| `src/components/chat/MessageFeedback.tsx` | Adicionar onUse callback |
| `src/components/chat/EnhancedMessageBubble.tsx` | Integrar com planning |
| `src/components/planning/PlanningItemDialog.tsx` | Fluxo rápido |

---

## Fase 4: Melhorias de UX do @

**Objetivo:** Tornar a experiência de citação mais fluida e informativa.

### 4.1 Dica no input

Adicionar placeholder dinâmico:
- Sem formato: "Digite o formato (ex.: post de LinkedIn) ou use @ para escolher"
- Com formato detectado: "Conteúdo para LinkedIn..."

### 4.2 Chip de formato detectado

Antes de enviar, mostrar badge com formato identificado:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🔵 Post LinkedIn detectado                                   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Crie um conteúdo sobre produtividade...               │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Expandir `detectContentType`

Adicionar novos padrões:

| Padrão | Formato detectado |
|--------|-------------------|
| "email de marketing" | `email_marketing` |
| "artigo no X" / "artigo no Twitter" | `x_article` |
| "post para o blog" | `blog_post` |
| "script de vídeo" | `long_video` |
| "reels sobre" | `short_video` |

### 4.4 "Refazer como [outro formato]"

No `MessageFeedback`, adicionar dropdown no botão Refazer:
- Refazer (mesmo formato)
- Refazer como Carrossel
- Refazer como Tweet
- Refazer como Newsletter

### 4.5 Acessibilidade

- Adicionar `aria-labels` ao `CitationPopover`
- Suporte a navegação por teclado nas ações

**Arquivos a modificar:**

| Arquivo | Ação |
|---------|------|
| `src/types/template.ts` | Expandir detectContentType |
| `src/components/chat/FloatingInput.tsx` | Chip de formato |
| `src/components/chat/MessageFeedback.tsx` | Dropdown "Refazer como" |
| `src/components/chat/CitationPopover.tsx` | Acessibilidade |

---

## Fase 5: Configuração e Backend

**Objetivo:** Permitir customização de regras e voz por cliente.

### 5.1 Tabelas para regras (opcional)

Mover listas de `quality-rules.ts` para banco:

| Tabela | Campos |
|--------|--------|
| `content_quality_rules` | id, rule_type, pattern, severity, message |
| `format_prohibited_words` | format_key, words[], source |

API carrega com fallback para código se tabela vazia.

### 5.2 Tela "Voz do Cliente"

Nova seção no editor de cliente:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🎤 Voz do Cliente                                            │
├─────────────────────────────────────────────────────────────┤
│ Tom: [Direto e inspirador                              ▼]   │
│                                                              │
│ USE (expressões que funcionam):                              │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ + "Vamos lá"  × "Na prática"  + "O segredo é"        │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
│ EVITE (proibido para este cliente):                          │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ × "Jornada"  × "Mindset"  × "Transformar"            │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
│ [Salvar]                                                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Migrar automações

Garantir que estas funções usem `unified-content-api`:
- `generate-content-from-idea`
- `process-recurring-content`

**Arquivos a criar/modificar:**

| Arquivo | Ação |
|---------|------|
| `src/components/clients/VoiceProfileEditor.tsx` | CRIAR |
| Migration SQL | Tabelas de regras (opcional) |
| `supabase/functions/generate-content-from-idea/index.ts` | Usar unified-content-api |

---

## Ordem de Implementação

| Prioridade | Fase | Impacto | Esforço |
|------------|------|---------|---------|
| 1 | API Resiliente | Alto (confiabilidade) | Médio |
| 2 | Usar → Planejamento | Alto (UX) | Baixo |
| 3 | Melhorias @ | Médio (UX) | Baixo |
| 4 | Fluxo de Hooks | Alto (qualidade) | Alto |
| 5 | Configuração | Médio (controle) | Médio |

---

## Checklist Final

- [ ] `_shared/llm.ts` com callLLM (retry + fallback Gemini/OpenAI)
- [ ] `unified-content-api` usa callLLM; retorna 503 em falha total
- [ ] Frontend trata 503 e exibe "Tentar novamente"
- [ ] "Usar" abre PlanningItemDialog com conteúdo pré-preenchido
- [ ] Chip de formato detectado antes de enviar
- [ ] Expandir padrões em `detectContentType`
- [ ] "Refazer como [outro formato]" no MessageFeedback
- [ ] (Fase 2) Fluxo de hooks para formatos ricos
- [ ] (Fase 5) Tela "Voz do Cliente" no editor

---

## Dependências Técnicas

```text
Fase 1 (API) ───┬─── Fase 4 (Fluxo Hooks)
                │
                └─── Fase 3 (UX @)

Fase 2 (Usar → Planning) ─── Independente

Fase 5 (Config) ─── Depende de Fase 1 para consistência
```

Recomendo iniciar com **Fase 1 + Fase 2** em paralelo, pois são independentes e têm maior impacto imediato.
