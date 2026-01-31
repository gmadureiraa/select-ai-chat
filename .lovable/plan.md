

# Diagnóstico Completo: Automação GM + Erro de Geração no Perfil

## Problema 1: Conteúdo de GM - Está usando dados do cliente?

### ✅ Análise: SIM, está usando corretamente

Baseado nos logs e no código, confirmei que a automação de GM **USA os dados do cliente** através do seguinte fluxo:

```text
process-automations → kai-content-agent
       ↓                     ↓
  clientId passado    Busca perfil completo
                            ↓
                      identity_guide
                      context_notes
                      tags
                      social_media
                      + favoritos da biblioteca
                      + top performers
```

**Evidências nos Logs:**

| Etapa | Log |
|-------|-----|
| Prompt | `"Crie um Tweet de GM todo dia diferente..."` |
| Geração | `"Content generated (62 chars)"` |
| Resultado | `"GM GM\nCafé na mesa, foco no código. Bora construir. ☕"` |

**O que o `kai-content-agent` busca automaticamente:**
1. `identity_guide` → Tom de voz do Madureira (técnico, direto, Web3)
2. `context_notes` → Diretrizes operacionais
3. Conteúdos favoritos (até 3)
4. Top performers Instagram/YouTube

### Verificação do Conteúdo do Cliente Madureira

| Campo | Valor |
|-------|-------|
| `identity_guide` | Guia completo de 93+ linhas com posicionamento "Estrategista Full-Stack para Marcas Web3" |
| `context_notes` | "Tom descontraído e autêntico. Mistura storytelling pessoal com insights práticos..." |
| `tags.tone` | Presente no guia |

### Avaliação da Qualidade

O tweet gerado:
```
GM GM
Café na mesa, foco no código. Bora construir. ☕
```

**Análise:**
- ✅ Tom correto: Direto, sem rodeios
- ✅ Linguagem Web3: "Bora construir"
- ⚠️ Genérico: Não usa referências específicas do guia (cripto, marketing, Kaleidos)

**Oportunidade de Melhoria:**
O prompt da automação poderia ser mais específico para forçar referências ao universo do cliente:

```
Atual: "Crie um Tweet de GM todo dia diferente, simples e direto..."
Sugerido: "Crie um Tweet de GM para Gabriel Madureira usando referências a Web3, 
cripto, marketing digital ou building in public. Tom técnico mas didático."
```

---

## Problema 2: Erro ao Gerar Contexto no Perfil do Cliente

### ❌ BUG IDENTIFICADO

**Erro:**
```
TypeError: data.getReader is not a function
at handleGenerateContext (ClientEditTabsSimplified.tsx:165:37)
```

**Causa Raiz:**
O componente `ClientEditTabsSimplified.tsx` espera que `supabase.functions.invoke` retorne um `ReadableStream` (como em `data.body.getReader()`), mas o Supabase SDK retorna o corpo da resposta já parseado quando não é streaming.

**APIs Usadas:**

| Componente | API | Modelo | Status |
|------------|-----|--------|--------|
| `kai-content-agent` | Google Gemini 2.0 Flash | Via `GOOGLE_AI_STUDIO_API_KEY` | ✅ Funcionando |
| `chat` | Google Gemini 2.5 Flash | Via `GOOGLE_AI_STUDIO_API_KEY` | ⚠️ Streaming OK, invoke falha |
| `ClientEditTabsSimplified.tsx` | `chat` via `functions.invoke` | - | ❌ Erro no parse |

### Problema Técnico

```typescript
// ClientEditTabsSimplified.tsx (linha 127)
const reader = data.getReader(); // ❌ data não é um ReadableStream

// O correto seria usar:
const reader = data.body?.getReader(); // ✅ Se for Response object
// OU processar diretamente se já vier parseado
```

O `supabase.functions.invoke` retorna:
- `{ data: ..., error: ... }` - onde `data` é o corpo já processado
- NÃO retorna um `ReadableStream` diretamente

### Comparação com hook que funciona

O hook `useGenerateClientContext.ts` usa a mesma API mas processa corretamente:

```typescript
// useGenerateClientContext.ts (linha 126)
const reader = data.body?.getReader(); // ✅ Usa data.body
```

Enquanto `ClientEditTabsSimplified.tsx` faz:

```typescript
// ClientEditTabsSimplified.tsx (linha 127)
const reader = data.getReader(); // ❌ Tenta ler data diretamente
```

---

## Solução Proposta

### Correção 1: Atualizar `ClientEditTabsSimplified.tsx`

Mudar a linha 127 para usar `data.body?.getReader()` ou tratar o caso onde `data` já vem parseado:

```typescript
// Antes (linha 127)
const reader = data.getReader();

// Depois
if (data.body && typeof data.body.getReader === 'function') {
  const reader = data.body.getReader();
  // ... streaming logic
} else if (typeof data === 'string') {
  // Já veio como string
  setContextNotes(data);
} else if (data.content) {
  // Veio como objeto JSON
  setContextNotes(data.content);
}
```

### Correção 2: (Opcional) Melhorar prompt da automação GM

Atualizar a automação "GM Tweet Madureira" no banco para incluir mais contexto:

```sql
UPDATE planning_automations 
SET prompt_template = 'Crie um Tweet de GM para Gabriel Madureira.
Use referências sutis a: Web3, marketing digital, building in public, ou tecnologia.
Mantenha o tom técnico mas didático, direto e sem rodeios.
Ideias de variação:
- GM GM + insight sobre o dia
- GM fam + call to action sutil
- GM simples + referência a cripto/tech'
WHERE id = 'd22e5a77-45ed-4938-a840-d9d0d148253e';
```

---

## Resumo das APIs de IA Usadas

| Funcionalidade | Edge Function | API Provider | Modelo |
|----------------|---------------|--------------|--------|
| Automação GM | `kai-content-agent` | Google Gemini | `gemini-2.0-flash` |
| Chat/Perfil | `chat` | Google Gemini | `gemini-2.5-flash` |
| Canvas | `generate-content-v2` | Google Gemini | `gemini-2.0-flash` |
| Reverse Engineer | `reverse-engineer` | Google Gemini | `gemini-2.0-flash-exp` + `gemini-2.5-flash` |

**Nota:** Todas as funções usam a chave `GOOGLE_AI_STUDIO_API_KEY` (chave própria do usuário), NÃO o gateway Lovable AI.

---

## Arquivos a Modificar

1. **`src/components/clients/ClientEditTabsSimplified.tsx`**
   - Linha 127: Corrigir `data.getReader()` → `data.body?.getReader()`
   - Adicionar fallback para quando `data` já vem parseado

2. **(Opcional)** **Atualizar automação no banco**
   - Enriquecer `prompt_template` para mais personalização

---

## Seção Técnica

### Fluxo de Dados da Automação GM

```text
1. CRON/Manual → process-automations
2. Busca automação "GM Tweet Madureira"
3. buildEnrichedPrompt() + prompt_template
4. POST → kai-content-agent
   ├── clientId: c3fdf44d-1eb5-49f0-aa91-a030642b5396
   ├── format: "tweet"
   └── message: <prompt enriquecido>
5. kai-content-agent busca:
   ├── clients.identity_guide
   ├── clients.context_notes
   ├── client_content_library (favoritos)
   ├── instagram_posts (top performers)
   └── youtube_videos (top performers)
6. Gemini 2.0 Flash → gera conteúdo
7. Retorna → salva em planning_items
8. Se auto_publish → late-post → publica no Twitter
```

### Diferença entre invoke com/sem streaming

```typescript
// SEM streaming (padrão)
const { data, error } = await supabase.functions.invoke("chat", { body });
// data = objeto já parseado ou texto

// COM streaming (precisa de ReadableStream)
const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(body)
});
const reader = response.body.getReader(); // ✅ response.body é ReadableStream
```

