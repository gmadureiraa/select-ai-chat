# Plano: Refatoração do Agente para Conteúdo Impecável

## Status: 🚧 Em Progresso (Fases 1-4 Completas)

---

## Resumo Executivo

Este plano implementa uma arquitetura de geração de conteúdo baseada em **contrato por formato**, **voz estruturada do cliente** e um fluxo de **Writer + Validador + Repair + Revisor**. O objetivo é garantir que todo conteúdo (chat e automações) seja **impecável** e soe como o cliente, não como IA genérica.

## Progresso Atual

| Fase | Status | Descrição |
|------|--------|-----------|
| 1. Format Schemas | ✅ Completo | `format-schemas.ts` com 16 formatos |
| 2. Validador + Quality | ✅ Completo | `content-validator.ts`, `quality-rules.ts` |
| 3. Voz Estruturada | ✅ Completo | `getStructuredVoice()`, campo `voice_profile` |
| 4. API Unificada | ✅ Completo | `unified-content-api` deployada |
| 5. Migrar Chat | 🔄 Pendente | `useClientChat.ts` |
| 6. Migrar Automações | ⏳ Pendente | `process-automations` |
| 7. Interface Voice Profile | ⏳ Pendente | UI para configurar Use/Evite |

## Arquivos Criados

- `supabase/functions/_shared/format-schemas.ts` - Schemas de output (16 formatos)
- `supabase/functions/_shared/content-validator.ts` - Parser + validador + repair
- `supabase/functions/_shared/quality-rules.ts` - Lista global de proibições
- `supabase/functions/unified-content-api/index.ts` - API unificada principal

## Arquivos Atualizados

- `supabase/functions/_shared/knowledge-loader.ts` - +getStructuredVoice, +getClientAvoidList
- `supabase/config.toml` - +unified-content-api

## Migrations Aplicadas

- `voice_profile` JSONB na tabela `clients`
- `output_schema` JSONB na tabela `kai_documentation`

---

## Arquitetura Implementada

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED CONTENT API                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Input: client_id, format, brief, options                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. CARREGAR CONTEXTO                                             │   │
│  │    - Contrato do formato (schema + limites + proibições)         │   │
│  │    - Voz do cliente (Use/Evite + snippets)                       │   │
│  │    - Lista global de frases proibidas                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 2. WRITER (1 chamada forte)                                      │   │
│  │    - Contrato como REGRA, não sugestão                           │   │
│  │    - Output em schema definido (JSON ou markdown estruturado)    │   │
│  │    - Gemini 2.5 Flash (rápido e capaz)                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 3. VALIDADOR (código, não IA)                                    │   │
│  │    - Parser extrai campos do output                              │   │
│  │    - Checa limites (ex: subject ≤ 50 chars)                      │   │
│  │    - Checa campos obrigatórios                                   │   │
│  │    - Checa lista de proibições (global + formato)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               ▼                                         │
│              ┌──────────────────────────────────────┐                  │
│              │ Violações encontradas?               │                  │
│              │   SIM → REPAIR (1 chamada curta)     │                  │
│              │   NÃO → Continua                     │                  │
│              └──────────────────────────────────────┘                  │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 4. REVISOR OPCIONAL (se options.skip_review = false)             │   │
│  │    - Checklist focado: gancho, CTA, frases genéricas             │   │
│  │    - Modelo mais leve (Flash Lite)                               │   │
│  │    - Não reescreve, apenas corrige                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               ▼                                         │
│  Output: Conteúdo final + metadados parseados (subject, preview, etc)  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Contrato por Formato (Schemas de Saída)

### 1.1 Criar schemas de output para cada formato

**Arquivo novo:** `supabase/functions/_shared/format-schemas.ts`

Definir um schema para cada formato que especifica:
- Campos obrigatórios (ex: `subject`, `preview`, `body`)
- Limites por campo (ex: `subject.max_length: 50`)
- Proibições específicas do formato
- Técnicas que funcionam

Exemplo para Newsletter:
```typescript
const NEWSLETTER_SCHEMA = {
  format: "newsletter",
  fields: {
    subject: { required: true, max_length: 50, description: "Linha de assunto" },
    preview: { required: true, max_length: 90, description: "Preview text" },
    greeting: { required: false, max_length: 100, description: "Saudação" },
    body: { required: true, min_length: 300, max_length: 2000, description: "Corpo" },
    cta: { required: true, max_length: 100, description: "Call to action" },
    signature: { required: false, max_length: 100, description: "Assinatura" },
  },
  output_format: `**ASSUNTO:** [max 50 chars]
**PREVIEW:** [max 90 chars]
---
[corpo da newsletter]
---
**CTA:** [call-to-action]
[assinatura]`,
  prohibited_words: ["grátis", "urgente", "última chance", "garantido", "clique aqui"],
};
```

### 1.2 Atualizar tabela `kai_documentation`

Adicionar coluna `output_schema` (JSONB) para armazenar o schema de cada formato:

```sql
ALTER TABLE kai_documentation 
ADD COLUMN IF NOT EXISTS output_schema JSONB DEFAULT '{}';
```

### 1.3 Modificar carregamento de regras

Atualizar `knowledge-loader.ts` para retornar também o schema de output junto com as regras.

---

## Fase 2: Voz do Cliente Estruturada

### 2.1 Adicionar campo `voice_profile` na tabela `clients`

```sql
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS voice_profile JSONB DEFAULT '{}';

-- Estrutura esperada:
-- {
--   "tone": "Direto, informal, acessível",
--   "use": ["expressões como 'bora'", "números específicos", "perguntas diretas"],
--   "avoid": ["certamente", "com certeza", "vamos falar sobre", "linguagem corporativa"]
-- }
```

### 2.2 Criar seção "VOZ DO CLIENTE" no prompt

Nova função em `knowledge-loader.ts`:

```typescript
export async function getStructuredVoice(clientId: string): Promise<string> {
  // Buscar voice_profile do cliente
  // Formatar como seção explícita:
  // ## VOZ DO CLIENTE
  // **Tom:** [tom em 1 frase]
  // **USE:** [lista de expressões/padrões]
  // **EVITE:** [lista de proibições]
  // **Snippets de referência:** [3-5 trechos curtos da biblioteca]
}
```

### 2.3 Interface para editar Voice Profile

Adicionar seção no perfil do cliente (aba Contexto IA) para configurar:
- Tom em 1 frase
- Lista "Use sempre" (tags)
- Lista "Evite sempre" (tags)

---

## Fase 3: Validador + Repair

### 3.1 Criar módulo de validação

**Arquivo novo:** `supabase/functions/_shared/content-validator.ts`

```typescript
interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  parsed_fields: Record<string, string>;
}

interface Violation {
  field: string;
  rule: string;
  message: string;
  value?: string;
}

export function parseOutput(content: string, format: string): Record<string, string>;
export function validateContent(parsed: Record<string, string>, schema: FormatSchema): ValidationResult;
export function buildRepairPrompt(violations: Violation[]): string;
```

### 3.2 Lista global de frases proibidas

**Arquivo novo:** `supabase/functions/_shared/quality-rules.ts`

```typescript
export const GLOBAL_FORBIDDEN_PHRASES = [
  "certamente",
  "com certeza",
  "absolutamente",
  "é importante notar",
  "vale ressaltar",
  "vamos falar sobre",
  "aqui está",
  "segue abaixo",
  "criei para você",
  "espero que goste",
  "fique à vontade",
  "não hesite em",
];

export const REVIEWER_CHECKLIST = [
  "Gancho forte nos primeiros segundos/linhas",
  "Sem frases genéricas de IA",
  "CTA claro e específico",
  "Campos obrigatórios presentes",
  "Limites de caracteres respeitados",
  "Tom consistente com a voz do cliente",
];
```

### 3.3 Lógica de Repair

Quando validação falha, fazer 1 chamada curta:

```typescript
const repairPrompt = `O conteúdo abaixo violou estas regras:
${violations.map(v => `- ${v.field}: ${v.message}`).join('\n')}

CONTEÚDO ATUAL:
${currentContent}

TAREFA: Corrija APENAS os problemas listados. Mantenha o resto intacto.
Retorne o conteúdo corrigido no MESMO FORMATO.`;
```

---

## Fase 4: API Unificada de Conteúdo

### 4.1 Criar nova Edge Function

**Arquivo novo:** `supabase/functions/unified-content-api/index.ts`

```typescript
interface ContentRequest {
  client_id: string;
  format: string;
  brief: string;
  options?: {
    skip_review?: boolean;       // default: false
    strict_validation?: boolean; // default: true
    max_repair_attempts?: number; // default: 1
  };
}

interface ContentResponse {
  content: string;
  parsed_fields: Record<string, string>;
  validation: {
    passed: boolean;
    repaired: boolean;
    reviewed: boolean;
  };
  tokens_used: number;
}
```

### 4.2 Fluxo interno

```
1. Carregar contexto completo:
   - getFormatSchema(format)
   - getStructuredVoice(client_id)
   - getFullContentContext(client_id, format)

2. Writer (1 chamada):
   - System prompt com contrato + voz + contexto
   - User prompt com brief
   - Output em schema definido

3. Validar:
   - parseOutput(response, format)
   - validateContent(parsed, schema)

4. Se violações → Repair (max 1 tentativa):
   - buildRepairPrompt(violations)
   - Chamada curta ao modelo
   - Re-validar

5. Se skip_review = false → Revisor:
   - Modelo leve (gemini-2.5-flash-lite)
   - Prompt com REVIEWER_CHECKLIST
   - Apenas correções, não reescrita

6. Retornar conteúdo + metadados
```

### 4.3 Migrar chamadas existentes

| Origem | Antes | Depois |
|--------|-------|--------|
| `useClientChat.ts` | `kai-content-agent` | `unified-content-api` |
| `process-automations` | `kai-content-agent` | `unified-content-api` |
| `generate-content-from-idea` | Pipeline 4 agentes | `unified-content-api` |

---

## Fase 5: Deprecar Pipeline de 4 Agentes

### 5.1 Remover `generate-content-from-idea`

A função atual usa 4 chamadas sequenciais (writer → style_editor → consistency_editor → final_reviewer). Este padrão será substituído por:

- 1 chamada forte (Writer com contexto completo)
- Validação em código (sem chamada)
- 1 chamada de Repair (se necessário)
- 1 chamada de Revisor (opcional)

Resultado: **De 4 chamadas para 2-3 no máximo**, com qualidade superior.

---

## Fase 6: Feedback Loop (Futuro)

### 6.1 Tabela de feedback

```sql
CREATE TABLE IF NOT EXISTS content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES planning_items(id),
  feedback_type TEXT CHECK (feedback_type IN ('approved', 'rejected', 'edited')),
  feedback_notes TEXT,
  original_content TEXT,
  edited_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);
```

### 6.2 Extrair padrões de rejeições

Job periódico que:
- Analisa conteúdos rejeitados/editados
- Extrai frases problemáticas
- Sugere adições à lista "Evite" do cliente

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/_shared/format-schemas.ts` | **Criar** | Schemas de output por formato |
| `supabase/functions/_shared/content-validator.ts` | **Criar** | Parser + validador + repair prompt builder |
| `supabase/functions/_shared/quality-rules.ts` | **Criar** | Lista global de proibições + checklist revisor |
| `supabase/functions/_shared/knowledge-loader.ts` | **Modificar** | Adicionar `getStructuredVoice()`, `getFormatSchema()` |
| `supabase/functions/unified-content-api/index.ts` | **Criar** | Nova API unificada (writer → validate → repair → review) |
| `supabase/functions/kai-content-agent/index.ts` | **Modificar** | Redirecionar para `unified-content-api` ou deprecar |
| `supabase/functions/generate-content-from-idea/index.ts` | **Deprecar** | Migrar para `unified-content-api` |
| `supabase/functions/process-automations/index.ts` | **Modificar** | Usar `unified-content-api` |
| `src/hooks/useClientChat.ts` | **Modificar** | Chamar `unified-content-api`, mostrar progresso (Escrevendo/Validando/Revisando) |
| `src/components/clients/profile/ContextAITab.tsx` | **Modificar** | Interface para editar Voice Profile (Use/Evite) |
| `supabase/migrations/add_voice_profile.sql` | **Criar** | Adicionar coluna `voice_profile` em `clients` |
| `supabase/migrations/add_output_schema.sql` | **Criar** | Adicionar coluna `output_schema` em `kai_documentation` |

---

## Ordem de Implementação

| Fase | O quê | Tempo Est. |
|------|-------|------------|
| 1 | Schemas de output (`format-schemas.ts`) | 45 min |
| 2 | Validador + Quality Rules (`content-validator.ts`, `quality-rules.ts`) | 1h |
| 3 | Voice Profile (migration + `getStructuredVoice`) | 30 min |
| 4 | API Unificada (`unified-content-api`) | 1h 30min |
| 5 | Migrar Chat (`useClientChat.ts`) | 45 min |
| 6 | Migrar Automações (`process-automations`) | 30 min |
| 7 | Deprecar pipeline antigo | 15 min |
| 8 | Interface Voice Profile (UI) | 45 min |

**Tempo Total Estimado:** ~6 horas

---

## Resultado Esperado

**Antes:**
- Chat: 1 chamada sem validação, output livre
- Automações: Igual ao chat
- Pipeline ideias: 4 chamadas, ineficiente

**Depois:**
- **API Única** para chat e automações
- **Formato como contrato**: Schema de saída validável
- **Voz estruturada**: Use/Evite + snippets explícitos
- **Validação pós-geração**: Parser + regras + repair automático
- **Revisor focado**: Checklist curto, sem reescrita
- **Máximo 2-3 chamadas** (vs 4 antes)
- **Qualidade superior** com menos tokens

O conteúdo final soa como o cliente, não como IA genérica.

