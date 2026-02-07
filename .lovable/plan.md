# Plano: Conteúdo Impecável

## ✅ Status: Implementação Completa

O sistema de geração de conteúdo foi refatorado para usar uma arquitetura unificada baseada em **contrato por formato**, **voz estruturada do cliente** e um fluxo de **Writer → Validador → Repair → Revisor**.

---

## Progresso Final

| Fase | Status | Descrição |
|------|--------|-----------|
| 1. Format Schemas | ✅ Completo | `format-schemas.ts` com 16 formatos |
| 2. Validador + Quality | ✅ Completo | `content-validator.ts`, `quality-rules.ts` |
| 3. Voz Estruturada | ✅ Completo | `getStructuredVoice()`, campo `voice_profile` |
| 4. API Unificada | ✅ Completo | `unified-content-api` deployada |
| 5. Migrar Chat | ✅ Completo | `useClientChat.ts` atualizado |
| 6. Migrar Automações | ✅ Completo | `process-automations` atualizado |
| 7. Deprecar Pipeline 4 Agentes | ✅ Completo | `generate-content-from-idea` redireciona |
| 8. Interface Voice Profile | ✅ Completo | `VoiceProfileEditor.tsx` na aba Contexto IA |

---

## Componentes Implementados

### 1. Schemas de Formato (`format-schemas.ts`)
- 16 formatos definidos (newsletter, carousel, thread, post, etc.)
- Campos obrigatórios com limites de caracteres
- Palavras proibidas por formato
- Templates de output estruturado

### 2. Validador de Conteúdo (`content-validator.ts`)
- Parser multi-estratégia (regex, markdown headers, separadores)
- Validação de limites e campos obrigatórios
- Detecção de frases proibidas (global + formato)
- Geração de prompts de repair

### 3. Regras de Qualidade Global (`quality-rules.ts`)
- Lista de frases genéricas de IA proibidas
- Checklist do revisor (gancho, CTA, tom, etc.)
- Critérios de qualidade por formato

### 4. Voice Profile do Cliente
- Campo `voice_profile` na tabela `clients`
- Estrutura: `{ tone, use[], avoid[] }`
- Integrado no carregamento de contexto (`knowledge-loader.ts`)
- Interface visual para edição (`VoiceProfileEditor.tsx`)

### 5. API Unificada (`unified-content-api`)
- Fluxo: Writer → Validate → Repair → Review
- Suporta streaming SSE
- Validação automática de output
- Até 1 tentativa de repair

---

## Migrações Realizadas

- `useClientChat.ts` → usa `unified-content-api`
- `process-automations` → usa `unified-content-api`
- `generate-content-from-idea` → redirecionado para `unified-content-api`

---

## Arquitetura Final

```text
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED CONTENT API                          │
├─────────────────────────────────────────────────────────────────┤
│ Input: client_id, format, brief, options                        │
│                                                                 │
│  1. CARREGAR CONTEXTO                                           │
│     - Schema do formato (format-schemas.ts)                     │
│     - Voice Profile do cliente (tone, use, avoid)               │
│     - Contexto completo (identity_guide, favoritos, etc)        │
│                                                                 │
│  2. WRITER (Gemini 2.5 Flash)                                   │
│     - Prompt com contrato + voz + contexto                      │
│     - Output em formato estruturado                             │
│                                                                 │
│  3. VALIDADOR (código)                                          │
│     - Parser extrai campos                                      │
│     - Checa limites e proibições                                │
│     - Erros → Repair | Warnings → Log                           │
│                                                                 │
│  4. REPAIR (se necessário)                                      │
│     - 1 tentativa com lista de violações                        │
│     - Re-valida após repair                                     │
│                                                                 │
│  5. REVISOR (opcional)                                          │
│     - Checklist de qualidade                                    │
│     - Modelo leve (Flash Lite)                                  │
│                                                                 │
│ Output: Conteúdo impecável + metadados                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado

- **Antes:** 4 chamadas de IA, sem validação, output livre
- **Depois:** 2-3 chamadas máximo, validação automática, output estruturado
- **Benefícios:**
  - Conteúdo soa como o cliente, não como IA genérica
  - Limites de caracteres respeitados automaticamente
  - Frases proibidas filtradas
  - Gancho forte e CTA claro verificados
  - Mesma qualidade no Chat e nas Automações
