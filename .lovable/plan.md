
# Plano: Canvas Design & Identidade Visual + Fix Troca de Cliente

## Resumo

Este plano aborda duas melhorias críticas:
1. **Design e Identidade Visual** - Refinar a estética do Canvas para ambos os temas (claro e escuro)
2. **Fix Troca de Cliente** - Resolver o bug onde o Canvas não atualiza quando o usuário troca de cliente

---

## Problema 1: Canvas não atualiza ao trocar de cliente

### Diagnóstico

O problema está em `useCanvasPersistence.ts`. O auto-load só funciona se:
- `nodes.length === 0` E `edges.length === 0`

Quando você troca de cliente com o Canvas aberto, os nodes do cliente anterior ainda estão carregados, então a condição nunca é satisfeita e o Canvas do novo cliente não é carregado.

### Solução

Detectar mudança de `clientId` e resetar o Canvas automaticamente:

```typescript
// useCanvasPersistence.ts

// Adicionar ref para rastrear clientId anterior
const previousClientIdRef = useRef<string | null>(null);

// Effect para detectar mudança de cliente
useEffect(() => {
  if (previousClientIdRef.current && previousClientIdRef.current !== clientId) {
    // Cliente mudou - resetar tudo
    console.log(`[useCanvasPersistence] Client changed from ${previousClientIdRef.current} to ${clientId}`);
    setNodes([]);
    setEdges([]);
    setCurrentCanvasId(null);
    setCurrentCanvasName("Novo Canvas");
    lastSavedRef.current = '';
    autoLoadAttemptedRef.current = false; // Permitir auto-load novamente
  }
  previousClientIdRef.current = clientId;
}, [clientId, setNodes, setEdges]);
```

**Arquivo:** `src/components/kai/canvas/hooks/useCanvasPersistence.ts`

---

## Problema 2: Design e Identidade Visual do Canvas

### Análise do Estado Atual (Screenshot)

A partir da imagem fornecida:
- Os nodes têm bordas verdes (cor primária do tema escuro) ✅
- O header "Anexo" tem fundo roxo/magenta que destoa
- Os badges de tipo (YouTube, Imagem, etc.) estão funcionais
- A toolbar está bem integrada com glassmorphism

### Melhorias Propostas

#### 2.1 Harmonização de Cores dos Headers dos Nodes

**Objetivo:** Cores sólidas e sutis que respeitem o tema, sem destaques exagerados.

| Node | Tema Escuro | Tema Claro |
|------|------------|------------|
| Anexo | bg-purple-500/10, border-purple-500/20 | bg-purple-500/5, border-purple-500/15 |
| Gerador | bg-emerald-500/10, border-emerald-500/20 | bg-emerald-500/5, border-emerald-500/15 |
| Resultado | bg-blue-500/10, border-blue-500/20 | bg-blue-500/5, border-blue-500/15 |

**Arquivos:**
- `src/components/kai/canvas/nodes/AttachmentNode.tsx`
- `src/components/kai/canvas/nodes/GeneratorNode.tsx`
- `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

#### 2.2 Refinar Cores dos Ícones de Tipo

Os badges de tipo (YouTube, Imagem, etc.) já têm cores consistentes no `InputPreviews.tsx`. Aplicar no AttachmentNode para consistência visual.

**Atualização de cores:**

```typescript
const TYPE_COLORS = {
  youtube: 'text-red-500 bg-red-500/10',
  url: 'text-blue-500 bg-blue-500/10',
  pdf: 'text-orange-500 bg-orange-500/10',
  image: 'text-cyan-500 bg-cyan-500/10',
  audio: 'text-green-500 bg-green-500/10',
  text: 'text-purple-500 bg-purple-500/10',
  video: 'text-pink-500 bg-pink-500/10',
};
```

#### 2.3 Melhorar Estado Vazio do Node Anexo

O estado vazio (sem conteúdo) deve ter visual mais limpo:

- Bordas tracejadas mais sutis
- Cores de drop zone mais suaves
- Ícones com opacidade reduzida

```tsx
// Estado vazio melhorado
<div className={cn(
  "border-2 border-dashed rounded-lg p-4 transition-colors",
  "border-border/50 bg-muted/30",
  "hover:border-primary/30 hover:bg-primary/5",
  "dark:border-border/30 dark:bg-muted/20"
)}>
```

#### 2.4 Tabs do AttachmentNode mais Elegantes

As tabs atuais (YouTube | URL | Arquivo | Texto) podem ser mais compactas:

```tsx
// Tabs refinadas com ícones menores
<TabsList className="grid grid-cols-4 h-8 bg-muted/50">
  <TabsTrigger value="youtube" className="text-xs px-2 gap-1">
    <Play className="h-3 w-3" /> YT
  </TabsTrigger>
  <TabsTrigger value="url" className="text-xs px-2 gap-1">
    <Globe className="h-3 w-3" /> URL
  </TabsTrigger>
  <TabsTrigger value="file" className="text-xs px-2 gap-1">
    <Upload className="h-3 w-3" /> Arquivo
  </TabsTrigger>
  <TabsTrigger value="text" className="text-xs px-2 gap-1">
    <Type className="h-3 w-3" /> Texto
  </TabsTrigger>
</TabsList>
```

#### 2.5 Handles (Pontos de Conexão) mais Visíveis

Os handles de conexão podem ser mais visíveis e consistentes:

```tsx
// Handle com transição suave
<Handle
  type="source"
  position={Position.Right}
  className={cn(
    "!w-3 !h-3 transition-all duration-200",
    "!bg-primary !border-2 !border-background",
    "hover:!scale-125 hover:!shadow-md hover:!shadow-primary/30"
  )}
/>
```

#### 2.6 Contraste do Preview de Conteúdo

Os previews de conteúdo extraído precisam de melhor contraste:

```tsx
// Preview com contraste melhorado
<div className={cn(
  "rounded-lg p-3 text-xs overflow-hidden",
  "bg-muted/50 dark:bg-muted/30",
  "border border-border/50"
)}>
  {/* Conteúdo */}
</div>
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `useCanvasPersistence.ts` | Detectar mudança de clientId e resetar Canvas |
| `AttachmentNode.tsx` | Refinar header, tabs, estado vazio, handles, cores |
| `GeneratorNode.tsx` | Refinar header, handles (já feito parcialmente) |
| `ContentOutputNode.tsx` | Refinar header, handles (já feito parcialmente) |

---

## Detalhes Técnicos

### Fix de Troca de Cliente

```typescript
// useCanvasPersistence.ts - Adicionar após linha 33

const previousClientIdRef = useRef<string | null>(null);

// Detectar mudança de cliente - inserir após as declarações de estado
useEffect(() => {
  // Se já temos um cliente anterior e ele é diferente do atual
  if (previousClientIdRef.current && previousClientIdRef.current !== clientId) {
    console.log(`[useCanvasPersistence] Client changed: ${previousClientIdRef.current} -> ${clientId}`);
    
    // Resetar estado do canvas
    setNodes([]);
    setEdges([]);
    setCurrentCanvasId(null);
    setCurrentCanvasName("Novo Canvas");
    lastSavedRef.current = '';
    autoLoadAttemptedRef.current = false;
  }
  
  previousClientIdRef.current = clientId;
}, [clientId, setNodes, setEdges]);
```

### Refinamento Visual do AttachmentNode

1. **Header com cor suave:**
```tsx
<CardHeader className={cn(
  "pb-2 rounded-t-xl border-b",
  "bg-purple-500/5 dark:bg-purple-500/10",
  "border-purple-500/15 dark:border-purple-500/20"
)}>
```

2. **Tabs compactas:**
```tsx
<TabsList className="grid grid-cols-4 h-8 bg-muted/30 p-0.5">
  {/* Tab triggers com ícones menores */}
</TabsList>
```

3. **Drop zone refinada:**
```tsx
<div className={cn(
  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all",
  "border-muted-foreground/20 bg-muted/20",
  "hover:border-primary/40 hover:bg-primary/5"
)}>
```

---

## Resultado Esperado

1. **Troca de Cliente:** Canvas atualiza instantaneamente ao mudar de cliente
2. **Tema Claro:** Cores suaves com toques de rosa/magenta da marca
3. **Tema Escuro:** Cores com toque de verde neon da marca
4. **Consistência:** Mesma linguagem visual entre todos os nodes
5. **Contraste:** Texto legível em ambos os temas
6. **Handles:** Pontos de conexão mais visíveis e responsivos

---

## Ordem de Implementação

1. **Fix crítico:** Troca de cliente em `useCanvasPersistence.ts`
2. **AttachmentNode:** Header, tabs, drop zone, handles
3. **GeneratorNode:** Pequenos ajustes de cores
4. **ContentOutputNode:** Pequenos ajustes de cores
