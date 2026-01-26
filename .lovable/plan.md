
# Plano: Fix Chat Bugado + Design Minimalista

## Resumo

Este plano aborda dois problemas críticos:
1. **Bug do Chat**: O texto gerado está cortado - a função `parseOpenAIStream` passa apenas o delta/chunk para `onProgress`, mas o código que usa espera o conteúdo acumulado
2. **Design com muitas cores**: Simplificar a paleta de cores para um design mais minimalista e clean

---

## Problema 1: Chat cortando texto

### Diagnóstico

O bug está na interação entre dois arquivos:

**`src/lib/parseOpenAIStream.ts`** linha 46:
```typescript
options?.onProgress?.(deltaContent);  // Passa apenas o CHUNK atual
```

**`src/hooks/useMaterialChat.ts`** linha 81-88:
```typescript
await parseOpenAIStream(reader, {
  onProgress: (content) => {
    setMessages(prev => prev.map(m => 
      m.id === assistantMessageId 
        ? { ...m, content }  // Substitui com o chunk, não acumula
        : m
    ));
  },
});
```

**Resultado**: Cada chunk sobrescreve o anterior, mostrando apenas a última parte do texto.

### Solução

Alterar `parseOpenAIStream` para passar o conteúdo **acumulado** em vez do delta:

**Arquivo:** `src/lib/parseOpenAIStream.ts`

```typescript
// Linha 46 - Antes:
options?.onProgress?.(deltaContent);

// Linha 46 - Depois:
options?.onProgress?.(finalContent);  // Passa conteúdo acumulado
```

```typescript
// Linha 69 - Antes:
options?.onProgress?.(deltaContent);

// Linha 69 - Depois:
options?.onProgress?.(finalContent);  // Passa conteúdo acumulado
```

---

## Problema 2: Paleta de Cores Excessiva

### Estado Atual

O design usa 8+ cores diferentes:
- Verde (`green-500`) - Conexão, Áudio
- Vermelho (`red-500`) - YouTube
- Azul (`blue-500`) - URLs, Output
- Laranja (`orange-500`) - PDF
- Ciano (`cyan-500`) - Imagens
- Roxo (`purple-500`) - Texto, Anexo
- Rosa (`pink-500`) - Instagram
- Emerald (`emerald-500`) - Gerador

### Nova Paleta Minimalista

Reduzir para **apenas 2-3 cores funcionais**:

| Elemento | Antes | Depois |
|----------|-------|--------|
| Headers de Nodes | Cores variadas por tipo | `bg-muted/50` (neutro) |
| Badges de Tipo | Cores variadas | `bg-muted text-muted-foreground` (monocromático) |
| Conexão ativa | `bg-green-500/10` | `bg-primary/10` |
| Estados de sucesso | Verde | `text-primary` |
| Estados de erro | Vermelho | `text-destructive` (mantém) |
| Handles | Cores por tipo | `bg-primary` (único) |

### Arquivos a Modificar

#### 2.1 `src/components/kai/canvas/components/InputPreviews.tsx`

Simplificar `TypeBadge` e `ProcessingBadge`:

```typescript
// Antes - cores variadas
const config = {
  youtube: { color: 'bg-red-500/20 text-red-600', ... },
  url: { color: 'bg-blue-500/20 text-blue-600', ... },
  ...
};

// Depois - monocromático
const config = {
  youtube: { color: 'bg-muted text-muted-foreground', ... },
  url: { color: 'bg-muted text-muted-foreground', ... },
  ...
};
```

#### 2.2 `src/components/kai/canvas/nodes/AttachmentNode.tsx`

Simplificar header:

```typescript
// Antes
"bg-purple-500/5 dark:bg-purple-500/10"
"border-purple-500/15 dark:border-purple-500/20"

// Depois
"bg-muted/50"
"border-border"
```

#### 2.3 `src/components/kai/canvas/nodes/GeneratorNode.tsx`

Simplificar header e handles:

```typescript
// Antes
"bg-emerald-500/5 dark:bg-emerald-500/10"
"!bg-emerald-500"

// Depois
"bg-muted/50"
"!bg-primary"
```

#### 2.4 `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

Simplificar header:

```typescript
// Antes
"bg-blue-500/5 dark:bg-blue-500/10"

// Depois
"bg-muted/50"
```

#### 2.5 `src/components/kai/canvas/nodes/MaterialChatNode.tsx`

Simplificar indicador de conexão:

```typescript
// Antes
"bg-green-500/10 text-green-600 dark:text-green-400"
"bg-green-500/5"

// Depois
"bg-primary/10 text-primary"
"bg-primary/5"
```

#### 2.6 Waveform e Previews

Usar cor primária em vez de verde:

```typescript
// Antes
color = 'bg-green-500'

// Depois
color = 'bg-primary'
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/lib/parseOpenAIStream.ts` | Fix: passar conteúdo acumulado em `onProgress` |
| `src/components/kai/canvas/components/InputPreviews.tsx` | Simplificar cores para monocromático |
| `src/components/kai/canvas/nodes/AttachmentNode.tsx` | Header e badges neutros |
| `src/components/kai/canvas/nodes/GeneratorNode.tsx` | Header e handles primário |
| `src/components/kai/canvas/nodes/ContentOutputNode.tsx` | Header neutro |
| `src/components/kai/canvas/nodes/MaterialChatNode.tsx` | Indicador de conexão primário |

---

## Resultado Visual Esperado

### Antes (Colorido)
- Header Anexo: Roxo
- Header Gerador: Verde
- Header Resultado: Azul
- Badges: Vermelho, Azul, Laranja, Ciano, Verde, Roxo

### Depois (Minimalista)
- Headers: Cinza neutro (`bg-muted/50`)
- Badges: Monocromático
- Destaques: Apenas cor primária (verde no dark, rosa no light)
- Erros: Apenas vermelho (destrutivo)

---

## Ordem de Implementação

1. **Fix crítico**: `parseOpenAIStream.ts` - corrigir texto cortado
2. **InputPreviews.tsx** - simplificar badges e cores
3. **AttachmentNode.tsx** - header e badges neutros
4. **GeneratorNode.tsx** - header e handles primário
5. **ContentOutputNode.tsx** - header neutro
6. **MaterialChatNode.tsx** - cores de conexão
