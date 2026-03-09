

# Plano: Guia de Criação de Conteúdo por Cliente

## Conceito

Adicionar um novo campo `content_guidelines` (text) na tabela `clients` -- um documento editável, simples e prático que funciona como um **manual de "como criar conteúdo para este cliente"**. Diferente do `identity_guide` (documento mestre de marca gerado por IA) e do `voice_profile` (listas de Use/Evite), este guia é:

- Escrito/editado pelo usuário em linguagem natural
- Focado em regras práticas de criação (ex: "sempre começar tweets com uma provocação", "nunca usar mais de 3 hashtags", "preferir dados reais a opiniões")
- Injetado no prompt do writer como instrução de alta prioridade

## Mudanças

### 1. Database -- Novo campo `content_guidelines`
- Adicionar coluna `content_guidelines TEXT` na tabela `clients`
- Campo livre, sem estrutura rígida

### 2. UI -- Editor no perfil do cliente
- Novo card **"Guia de Criação"** na aba `AIContextTab`, posicionado entre o Voice Profile e as Fontes de Dados
- Textarea editável com placeholder de exemplo prático
- Botão "Gerar com IA" que analisa a biblioteca, identity_guide e voice_profile do cliente para sugerir um guia inicial
- Auto-save com indicador visual

### 3. Backend -- Injetar no pipeline de geração
- **`knowledge-loader.ts`**: `getFullContentContext()` passa a carregar `content_guidelines` do cliente e injetar como seção de alta prioridade no prompt
- **`unified-content-api/index.ts`**: Adicionar `content_guidelines` ao tracking de `sources_used`
- **`SourcesBadge.tsx`**: Mostrar indicador "Guia de Criação" quando presente

### 4. Chat -- SourcesBadge atualizado
- Novo item no badge de fontes: ícone BookOpen + "Guia de Criação"

## Injeção no Prompt (posição estratégica)

```text
writerSystemPrompt = `
  ${UNIVERSAL_OUTPUT_RULES}      ← regras globais
  ${formatContract}               ← regras do formato
  ${forbiddenPhrases}             ← frases proibidas
  ${structuredVoice}              ← Use/Evite
  ${contentGuidelines}            ← NOVO: Guia de Criação (alta prioridade)
  ${fullContext}                  ← identity_guide + biblioteca + patterns
`
```

O guia fica **depois** das regras técnicas mas **antes** do contexto pesado (biblioteca/exemplos), dando peso alto sem competir com as regras de formato.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ALTER TABLE clients ADD COLUMN content_guidelines TEXT` |
| `src/components/clients/AIContextTab.tsx` | Novo card "Guia de Criação" com editor e botão de geração IA |
| `supabase/functions/_shared/knowledge-loader.ts` | Nova função `getContentGuidelines()` + injeção em `getFullContentContext()` |
| `supabase/functions/unified-content-api/index.ts` | Carregar guidelines e injetar no writer prompt + tracking |
| `src/types/chat.ts` | Adicionar `content_guidelines?: boolean` ao `SourcesUsed` |
| `src/components/chat/SourcesBadge.tsx` | Novo item "Guia de Criação" |

