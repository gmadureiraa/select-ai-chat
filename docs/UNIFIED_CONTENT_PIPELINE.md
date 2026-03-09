# 🔄 Pipeline Unificado de Geração de Conteúdo

## Visão Geral

O `unified-content-api` é o pipeline central de geração de conteúdo de alta qualidade. Segue o fluxo: **Writer → Validate → Repair → Review**, garantindo que todo conteúdo gerado atenda aos padrões do formato e da marca.

---

## 📐 Arquitetura

```
Request (client_id, format, brief)
  │
  ├── 1. SECURITY: Valida JWT + acesso ao workspace
  │
  ├── 2. CONTEXT: Carrega dados do cliente
  │     ├── Identity Guide
  │     ├── Content Library (top performers)
  │     ├── Voice Profile
  │     ├── Format Schema
  │     ├── Format Rules (custom)
  │     ├── Global Knowledge
  │     └── Client Avoid List (frases proibidas)
  │
  ├── 3. WRITER: Gera conteúdo com LLM
  │     └── System prompt com contexto completo
  │
  ├── 4. VALIDATE: Valida estrutura do output
  │     ├── Campos obrigatórios presentes?
  │     ├── Limites de caracteres respeitados?
  │     └── Regras do formato seguidas?
  │
  ├── 5. REPAIR (se falhou validação)
  │     ├── Gera prompt de reparo com erros específicos
  │     └── Re-executa LLM com instruções de correção
  │
  └── 6. REVIEW (opcional)
        ├── Avaliação final de qualidade
        └── Score + warnings
```

---

## 📥 Request

```typescript
interface ContentRequest {
  client_id: string;      // UUID do cliente
  format: string;         // Ex: "tweet", "newsletter", "carousel"
  brief: string;          // Briefing/instrução do usuário
  workspace_id?: string;  // Para carregar format_rules
  options?: {
    skip_review?: boolean;        // default: false
    strict_validation?: boolean;  // default: true
    max_repair_attempts?: number; // default: 1
    stream?: boolean;             // default: false
    include_metadata?: boolean;   // default: true
  };
}
```

---

## 📤 Response

```typescript
interface ContentResponse {
  content: string;                    // Conteúdo final gerado
  parsed_fields: Record<string, string>; // Campos parseados (título, corpo, CTA, etc.)
  validation: {
    passed: boolean;     // Passou na validação?
    repaired: boolean;   // Foi reparado?
    reviewed: boolean;   // Passou por review?
    warnings: string[];  // Avisos de qualidade
  };
  sources_used: {
    identity_guide: boolean;
    library_items_count: number;
    top_performers_count: number;
    format_rules: string | null;
    voice_profile: boolean;
    global_knowledge: boolean;
  };
  tokens_used: {
    writer: number;
    repair: number;
    reviewer: number;
    total: number;
  };
  metadata: {
    format: string;
    format_label: string;
    processing_time_ms: number;
    steps_completed: string[];
    provider?: string;
  };
}
```

---

## 🧩 Módulos Compartilhados

### `format-schemas.ts`
Define a estrutura esperada para cada formato:
- Campos obrigatórios e opcionais
- Limites de caracteres
- Regras de formatação

### `content-validator.ts`
- `parseOutput()` — Extrai campos do output bruto
- `validateContent()` — Valida contra o schema do formato
- `buildRepairPrompt()` — Gera prompt de reparo com erros específicos
- `needsRepair()` — Decide se precisa reparar
- `getValidationSummary()` — Resume resultado da validação

### `quality-rules.ts`
- `UNIVERSAL_OUTPUT_RULES` — Regras que valem para TODOS os formatos
- `buildForbiddenPhrasesSection()` — Lista de frases proibidas por cliente
- `buildReviewerChecklist()` — Checklist do revisor por formato

### `knowledge-loader.ts`
- `getFullContentContext()` — Carrega contexto completo do cliente
- `getStructuredVoice()` — Voice profile estruturado
- `getClientAvoidList()` — Frases/palavras que o cliente não usa
- `normalizeFormatKey()` — Normaliza key do formato

### `llm.ts`
- `callLLM()` — Chamada com retry automático + fallback entre providers
- Suporta: Gemini 2.5 Flash, GPT-5-mini, fallback chain
- Retry: até 2 tentativas com backoff exponencial

---

## 🔗 Quem Usa Este Pipeline

| Chamador | Contexto |
|----------|---------|
| `kai-simple-chat` | Quando detecta criação de conteúdo |
| `kai-content-agent` | Agente de conteúdo do canvas (streaming) |
| `process-recurring-content` | Geração automática de recorrentes |
| `process-automations` | Automações com geração de IA |
| `generate-content-from-idea` | Geração a partir de ideias do canvas |

---

## 📊 Formatos Suportados

| Formato | Key | Campos Principais |
|---------|-----|-------------------|
| Tweet | `tweet` | texto (≤280 chars) |
| Thread | `thread` | tweets[] (5-10), hook, CTA |
| Post Instagram | `instagram_post` | legenda, sugestão visual |
| Carrossel | `carousel` | slides[] (8-10), hook, CTA |
| Stories | `stories` | stories[] (5-7) |
| Reels | `short_video` | roteiro, hook, CTA |
| LinkedIn | `linkedin_post` | texto, hook |
| Newsletter | `newsletter` | assunto, seções[], CTA |
| Blog Post | `blog_post` | título, seções[], meta description |
| Artigo X | `x_article` | título, corpo longo |
| Email Marketing | `email_marketing` | assunto, corpo, CTA |

---

## 🔬 Deep Research (Pesquisa Profunda)

Para formatos baseados em dados (newsletters especializadas), o pipeline pode executar uma fase inicial de pesquisa:

1. Usa Gemini 2.5 com Google Search Grounding
2. Extrai dados reais, métricas e notícias em tempo real
3. Alimenta o Writer com informações verificadas
4. Elimina alucinações de dados

---

*Última atualização: Março 2025*
