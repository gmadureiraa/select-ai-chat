
# Plano: Correção de Conteúdo do kAI Chat - Respeitar Instruções do Usuário

## Diagnóstico dos Problemas

### 1. A IA não obedeceu "sem imagens"
**Causa raiz:** O sistema não tem mecanismo para extrair e preservar instruções específicas do usuário (como "não use imagens", "apenas URL", "sem emojis") e passá-las para o pipeline de geração de conteúdo.

O fluxo atual simplesmente detecta se é uma "content creation request" e envia para a IA, mas as instruções específicas do usuário se perdem no meio do contexto volumoso.

### 2. Emoji de lâmpada (💡) apareceu no tweet
**Causa raiz identificada:**
- O `kai_documentation` para `tweet` diz "Máx 1-2 emojis" (permitindo emojis)
- O `format-rules.ts` para tweet diz "Mais de 2 emojis por tweet" como proibição (não zero)
- A documentação em `docs/formatos/TWEET.md` diz "Opcional, mas pode ajudar" e "Máximo 1-2 emojis"
- O Defiverso **não tem `identity_guide`** configurado (retornou `null`), então não há regras específicas do cliente para emojis

**Inconsistência:** As regras permitem emojis nos tweets, mas as regras gerais de qualidade dizem "Emojis APENAS no CTA final quando apropriado" e "NUNCA no corpo principal do conteúdo".

### 3. O cliente Defiverso não está usando o formato de qualidade correto
**Causa raiz:** O Defiverso não tem `identity_guide` configurado no banco de dados. Isso significa que a IA não tem diretrizes específicas de tom de voz e estilo para esse cliente.

---

## Solução Proposta

### Parte 1: Extrair e Preservar Instruções Específicas do Usuário

Modificar o `kai-simple-chat` para detectar e passar instruções do usuário como meta-dados que sobrescrevem comportamentos padrão.

**Instruções a detectar:**
- `sem imagem` / `sem imagens` / `sem mídia` / `apenas texto` → `skipImages: true`
- `só a URL` / `apenas a URL` / `apenas link` → `useOnlyUrl: true`
- `sem emoji` / `zero emoji` → `noEmojis: true`
- `com capa` / `usar capa` → `useCoverImage: true`

**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

```typescript
// Nova função de detecção de instruções
function detectUserInstructions(message: string): UserInstructions {
  const lowerMessage = message.toLowerCase();
  
  return {
    skipImages: /sem\s*(imagens?|m[ií]dia)|apenas\s*texto|s[oó]\s*texto/i.test(lowerMessage),
    useOnlyUrl: /s[oó]\s*(a\s*)?url|apenas\s*(a\s*)?(url|link)/i.test(lowerMessage),
    noEmojis: /sem\s*emoji|zero\s*emoji|n[aã]o\s*use\s*emoji/i.test(lowerMessage),
    useCoverImage: /(usar?|com|inclua?)\s*capa|apenas\s*(a\s*)?capa/i.test(lowerMessage),
  };
}
```

Essas instruções serão adicionadas ao system prompt com prioridade máxima:

```typescript
// Inserir no system prompt ANTES das outras instruções
if (userInstructions.skipImages) {
  systemPrompt += `\n⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): NÃO inclua nem sugira imagens. Gere APENAS texto.\n`;
}
if (userInstructions.noEmojis) {
  systemPrompt += `\n⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): ZERO emojis no conteúdo. Nem mesmo no CTA.\n`;
}
```

### Parte 2: Tornar as Regras de Emoji Mais Rigorosas

Atualizar as regras de formato para serem consistentes e mais restritivas sobre emojis.

**Arquivos a modificar:**
- `supabase/functions/_shared/format-rules.ts`
- Tabela `kai_documentation` (registro `tweet`)

**Mudanças:**
```
ANTES: "Máx 1-2 emojis"
DEPOIS: "Emojis: OPCIONAL e APENAS no CTA final. ZERO emojis no corpo do texto. Em caso de dúvida, NÃO use."
```

### Parte 3: Atualizar Documentação de Tweet

Sincronizar `docs/formatos/TWEET.md` e `kai_documentation` para terem regras consistentes:

```markdown
### Uso de Emojis
- **Padrão**: ZERO emojis no corpo do tweet
- **Exceção**: máximo 1 emoji no CTA final SE for relevante
- **Regra de ouro**: em caso de dúvida, NÃO use emoji
- **Nunca**: emojis decorativos no meio do texto (💡, 🔥, etc.)
```

### Parte 4: Criar Identity Guide para Defiverso (Recomendado)

O Defiverso não tem `identity_guide`. Isso precisa ser corrigido pelo usuário ou automaticamente.

**Opção A (via UI):** Gerar um guia de identidade acessando:
- Configurações do cliente → Gerar Guia de Identidade

**Opção B (via banco):** Criar um guia básico baseado nas newsletters existentes em `public/clients/defiverso/`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/kai-simple-chat/index.ts` | Adicionar detecção de instruções do usuário (`skipImages`, `noEmojis`, etc.) e injetá-las no prompt com prioridade máxima |
| `supabase/functions/_shared/format-rules.ts` | Atualizar regras de emoji para tweet (linha ~263) para serem mais restritivas |
| `supabase/functions/_shared/quality-rules.ts` | Adicionar 💡 (lâmpada) e outros emojis decorativos comuns à lista de `GLOBAL_FORBIDDEN_PHRASES` |
| Migration para `kai_documentation` | Atualizar o registro `tweet` com regras mais restritivas de emoji |

---

## Detalhes Técnicos

### Nova Interface de Instruções do Usuário

```typescript
interface UserInstructions {
  skipImages: boolean;      // "sem imagens", "apenas texto"
  useOnlyUrl: boolean;      // "só a URL", "apenas o link"
  noEmojis: boolean;        // "sem emoji", "zero emoji"
  useCoverImage: boolean;   // "usar capa", "apenas a capa"
  customNote?: string;      // Qualquer outra instrução detectada
}
```

### Fluxo de Prioridade Atualizado

```text
PRIORIDADE 1: Instruções Explícitas do Usuário
             ↓ (se "sem imagens" → ignorar mídia)
PRIORIDADE 2: Materiais Citados (@mentions)
             ↓
PRIORIDADE 3: Identity Guide do Cliente
             ↓
PRIORIDADE 4: Regras do Formato (kai_documentation)
             ↓
PRIORIDADE 5: Exemplos da Biblioteca
```

### Regras de Emoji Atualizadas para Tweet

```typescript
tweet: `
## REGRAS OBRIGATÓRIAS PARA TWEET

### ESTRUTURA
- **Gancho**: Primeira frase irresistível
- **Corpo**: Máximo 280 caracteres
- **CTA**: Opcional, integrado ao texto

### PROIBIÇÕES ABSOLUTAS
- ❌ Tweets que excedem 280 caracteres
- ❌ Múltiplas ideias no mesmo tweet
- ❌ Ganchos vagos
- ❌ HASHTAGS (nunca use)
- ❌ Emojis decorativos no corpo (💡🔥✨🚀💰 etc.)

### REGRA DE EMOJI
- PADRÃO: Zero emojis
- EXCEÇÃO: máximo 1 emoji no CTA final, SE relevante
- NA DÚVIDA: não use emoji

### TÉCNICAS QUE FUNCIONAM
- ✅ Números específicos (3,5% > "muito")
- ✅ Opinião ou take forte
- ✅ Perguntas diretas
`,
```

---

## Resultado Esperado

Após implementação:

1. **Usuário diz "crie um tweet sem imagens"** → IA gera APENAS texto, sem sugerir imagens
2. **Usuário diz "sem emoji"** → IA gera conteúdo com ZERO emojis
3. **Tweets do Defiverso** → Seguem padrão limpo, sem emojis decorativos como 💡
4. **Regras consistentes** → Todas as fontes (format-rules.ts, kai_documentation, TWEET.md) alinhadas

---

## Checklist de Implementação

- [ ] Adicionar `detectUserInstructions()` ao `kai-simple-chat/index.ts`
- [ ] Injetar instruções do usuário no system prompt com prioridade máxima
- [ ] Atualizar regras de emoji em `format-rules.ts` (tweet e thread)
- [ ] Adicionar emojis decorativos comuns à lista de proibidos em `quality-rules.ts`
- [ ] Criar migration para atualizar `kai_documentation` registro `tweet`
- [ ] Atualizar `docs/formatos/TWEET.md` para consistência
