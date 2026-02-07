
# Plano: Evolução do kAI - Interface e Qualidade de Respostas

## ✅ STATUS: IMPLEMENTADO (2025-02-07)

### Implementações Concluídas:
- **Analytics DB**: Colunas format_type, validation_passed, was_repaired em ai_usage_logs + tabela content_feedback
- **UI Components**: MessageFeedback.tsx, SourcesBadge.tsx, PipelineProgress.tsx
- **Quality Rules**: Lista expandida de ~60 para ~150 frases proibidas
- **Voice Profile Auto-Generate**: Edge function + UI com botão "Gerar automaticamente"
- **Unified API**: Retorna sources_used e loga métricas de formato

---

## Resumo Executivo

Com a arquitetura "Conteúdo Impecável" implementada (Writer → Validator → Repair → Reviewer), este plano foca em **evoluir a experiência do usuário** e **refinar a qualidade das respostas** através de melhorias incrementais de alto impacto.

---

## Diagnóstico do Estado Atual

### O que já está funcionando bem:
- Pipeline unificado `unified-content-api` com validação automática
- 16 formatos documentados em `format-schemas.ts`
- Voice Profile por cliente (Use/Avoid) com interface funcional
- kAI Global Chat com seleção de cliente e histórico

### Oportunidades de melhoria identificadas:

| Área | Gap | Impacto |
|------|-----|---------|
| **Feedback Loop** | Não há rastreamento de formato usado nem taxa de aprovação | Impossível medir qualidade |
| **Contexto Visual** | Usuário não vê quais fontes a IA consultou | Falta transparência |
| **Sugestões Inteligentes** | Prompts fixos, não personalizados | Menor engajamento |
| **Voice Profile** | Preenchimento manual, sem sugestões | Atrito no onboarding |
| **Progress UX** | Indicador básico durante geração | Menos feedback visual |
| **Histórico de Uso** | Sem analytics por cliente/formato | Sem insights de uso |

---

## Bloco 1: Feedback Loop e Analytics

### 1.1 Rastrear formato nas gerações

Adicionar coluna `format_type` na tabela `ai_usage_logs` para saber quais formatos são mais usados:

```sql
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS format_type TEXT,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id),
ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS was_repaired BOOLEAN DEFAULT false;
```

Modificar `unified-content-api` para registrar esses dados após cada geração.

### 1.2 Sistema de aprovação simples

Adicionar botões de feedback nas mensagens do assistente:

```text
┌─────────────────────────────────────┐
│ [Conteúdo gerado]                   │
│                                     │
│ 👍 Usar  │  ✏️ Editar  │  ↻ Refazer │
└─────────────────────────────────────┘
```

Novo componente `MessageFeedback.tsx` com:
- Botão "Usar" → marca como aprovado
- Botão "Editar" → abre editor inline
- Botão "Refazer" → regenera com ajuste

Dados salvos em nova tabela:

```sql
CREATE TABLE content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  client_id UUID REFERENCES clients(id),
  format_type TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('approved', 'edited', 'regenerated')),
  edit_distance INTEGER, -- quão diferente ficou após edição
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.3 Dashboard de qualidade por cliente

Expandir `FormatMetricsDashboard.tsx` para mostrar por cliente:
- Taxa de aprovação por formato
- Formatos mais usados
- Top conteúdos (aprovados sem edição)

---

## Bloco 2: Transparência e Contexto Visual

### 2.1 Mostrar fontes consultadas

Quando a IA gera conteúdo, exibir quais contextos foram usados:

```text
┌─────────────────────────────────────┐
│ 📚 Fontes usadas:                   │
│ • Guia de Identidade                │
│ • 3 posts favoritos da biblioteca   │
│ • Regras de newsletter              │
└─────────────────────────────────────┘
│ [Conteúdo gerado...]                │
└─────────────────────────────────────┘
```

Modificar `unified-content-api` para retornar no response:
```typescript
sources_used: {
  identity_guide: boolean;
  library_items_count: number;
  top_performers_count: number;
  format_rules: string;
  voice_profile: boolean;
}
```

Novo componente `SourcesBadge.tsx` exibido acima da mensagem.

### 2.2 Indicador de validação na resposta

Mostrar discretamente se o conteúdo passou pela validação:

```text
✓ Validado automaticamente
```

ou

```text
🔧 Ajustado automaticamente (subject muito longo → corrigido)
```

---

## Bloco 3: Sugestões Inteligentes

### 3.1 Quick prompts personalizados

Substituir sugestões estáticas por dinâmicas baseadas em:
- Formatos mais usados pelo cliente
- Conteúdos recentes da biblioteca
- Tópicos do Guia de Identidade

Novo hook `useSmartSuggestions(clientId)` que retorna:
```typescript
[
  "Crie um carrossel sobre [tópico do identity_guide]",
  "Refaça meu último post como thread",
  "Gere 5 ideias de reels para [nicho]"
]
```

### 3.2 Sugestões pós-resposta

Após gerar conteúdo, sugerir próximos passos:

```text
[Carrossel gerado...]

💡 Próximos passos:
• Gerar imagem de capa
• Adaptar para Stories
• Criar versão para LinkedIn
```

---

## Bloco 4: Voice Profile Assistido

### 4.1 Geração automática de Voice Profile

Botão "Gerar automaticamente" que analisa:
- Conteúdos da biblioteca (favoritos)
- Identity Guide existente
- Padrões de escrita identificados

Edge function `generate-voice-profile`:
```typescript
// Analisa 5-10 conteúdos favoritos
// Extrai: tom, expressões comuns, padrões evitados
// Sugere voice_profile preenchido
```

### 4.2 Sugestões de "Use" baseadas na biblioteca

Ao abrir o VoiceProfileEditor, mostrar:

```text
📊 Detectamos estes padrões nos seus favoritos:
• "Bora" aparece em 80% dos posts
• Perguntas diretas no início
• Números específicos

[+ Adicionar todos]
```

---

## Bloco 5: Progress UX Aprimorado

### 5.1 Pipeline visual com etapas

Substituir `SimpleProgress.tsx` por `PipelineProgress.tsx`:

```text
┌───────────────────────────────────────────┐
│ ✓ Contexto carregado                      │
│ ● Escrevendo conteúdo...                  │
│ ○ Validando                               │
│ ○ Revisão de qualidade                    │
└───────────────────────────────────────────┘
```

Cada etapa mostra tempo decorrido e status.

### 5.2 Streaming parcial com preview

Durante a geração, mostrar preview do conteúdo parcial:

```text
Escrevendo...
┌─────────────────────────────────────┐
│ **ASSUNTO:** Os 5 erros que você... │
│ **PREVIEW:** Comete todo dia sem... │
│ [...]                               │
└─────────────────────────────────────┘
```

Requer modificar `unified-content-api` para suportar streaming SSE.

---

## Bloco 6: Melhorias na Qualidade das Respostas

### 6.1 Expandir regras de qualidade

Adicionar mais frases à lista global em `quality-rules.ts`:

```typescript
export const EXPANDED_FORBIDDEN_PHRASES = [
  // Existentes...
  // Novas:
  "você vai descobrir",
  "neste post",
  "hoje vamos falar",
  "é fundamental",
  "sem dúvida",
  "incrível",
  "extraordinário",
  "simplesmente",
  "basicamente",
  "literalmente",
];
```

### 6.2 Regras específicas por formato

Expandir `FORMAT_SCHEMAS` com validações mais rigorosas:

| Formato | Nova regra |
|---------|-----------|
| Newsletter | Subject não pode começar com "RE:" ou "FWD:" |
| Carrossel | Slides devem ter progressão (números ou conectores) |
| Thread | Tweet 1 deve conter número total (1/X) |
| LinkedIn | Não pode começar com saudação genérica |

### 6.3 Exemplos de alta qualidade por formato

Adicionar campo `examples` ao schema de cada formato:

```typescript
newsletter: {
  // ... campos existentes
  examples: [
    {
      quality: "excellent",
      content: "ASSUNTO: 3 emails que aumentam vendas em 47%...",
      why_good: "Número específico, promessa clara, não é spam"
    }
  ]
}
```

O Writer recebe 1-2 exemplos de alta qualidade junto com o contrato.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/chat/MessageFeedback.tsx` | **Criar** | Botões de aprovação/edição/refazer |
| `src/components/chat/SourcesBadge.tsx` | **Criar** | Badge mostrando fontes consultadas |
| `src/components/chat/PipelineProgress.tsx` | **Criar** | Progress visual com etapas |
| `src/hooks/useSmartSuggestions.ts` | **Criar** | Sugestões personalizadas |
| `supabase/functions/generate-voice-profile/` | **Criar** | Geração automática de voice profile |
| `supabase/functions/unified-content-api/index.ts` | **Modificar** | Retornar sources_used, logar format_type |
| `supabase/functions/_shared/quality-rules.ts` | **Modificar** | Expandir lista de frases proibidas |
| `supabase/functions/_shared/format-schemas.ts` | **Modificar** | Adicionar examples aos schemas |
| `src/components/kai-global/GlobalKAIChat.tsx` | **Modificar** | Integrar MessageFeedback e SourcesBadge |
| `src/components/clients/VoiceProfileEditor.tsx` | **Modificar** | Adicionar botão "Gerar automaticamente" |
| `src/hooks/useFormatMetrics.ts` | **Modificar** | Incluir métricas por cliente |
| Migração SQL | **Criar** | Tabelas content_feedback + colunas ai_usage_logs |

---

## Ordem de Implementação

| Fase | O quê | Impacto | Tempo Est. |
|------|-------|---------|------------|
| 1 | Analytics (format_type + content_feedback) | Medir qualidade | 1h |
| 2 | MessageFeedback (👍/✏️/↻) | Feedback loop | 1h |
| 3 | Expandir quality-rules.ts | Melhor output | 30min |
| 4 | SourcesBadge (fontes consultadas) | Transparência | 45min |
| 5 | PipelineProgress visual | UX durante geração | 45min |
| 6 | SmartSuggestions hook | Engajamento | 1h |
| 7 | generate-voice-profile | Onboarding | 1h 30min |
| 8 | Exemplos por formato | Qualidade de output | 1h |
| 9 | Dashboard por cliente | Insights de uso | 45min |

**Tempo Total Estimado:** ~8 horas

---

## Métricas de Sucesso

| Métrica | Baseline | Meta |
|---------|----------|------|
| Taxa de aprovação (sem edição) | Não medido | 70%+ |
| Conteúdos que precisam de repair | ~30% | <15% |
| Tempo médio de geração | ~8s | <6s |
| Voice Profile preenchido | ~20% dos clientes | 60%+ |
| Satisfação com sugestões | N/A | NPS 8+ |

---

## Resultado Esperado

**Interface:**
- Feedback visual rico durante geração (etapas do pipeline)
- Transparência sobre fontes consultadas pela IA
- Sugestões personalizadas que aceleram o uso
- Voice Profile com preenchimento assistido

**Qualidade:**
- Menos frases genéricas de IA
- Validação mais rigorosa por formato
- Exemplos de alta qualidade guiando o modelo
- Loop de feedback para melhoria contínua

**Analytics:**
- Visibilidade sobre quais formatos performam melhor
- Taxa de aprovação por cliente/formato
- Dados para otimizar regras automaticamente
