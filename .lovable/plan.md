

# Plano: Canvas Perfeito - Paridade com Landing Page + Animações de Geração

## Resumo

Atualizar o Canvas funcional para ter a mesma qualidade visual da landing page, incluindo:
1. Todas as opções de input (incluindo áudio dedicado e URL genérica)
2. Animações visuais durante a geração real
3. Feedback visual rico com ícones animados
4. Conexões curvas animadas estilo landing page

---

## Análise: Landing Page vs Canvas Atual

| Feature | Landing Page | Canvas Atual | Status |
|---------|--------------|--------------|--------|
| YouTube | ✅ Com play animado | ✅ Funciona | OK |
| URL/Link genérico | ✅ Com typing animation | ❌ Só YouTube | FALTA |
| PDF/Docs | ✅ Com scan effect | ❌ Não suportado | FALTA |
| Texto Livre | ✅ Com cursor piscando | ✅ Funciona | OK |
| Imagem | ✅ Com scan effect | ✅ Funciona | OK |
| Áudio dedicado | ✅ Com waveform animado | ⚠️ Misturado em "Arquivo" | MELHORAR |
| Animação de geração | ✅ Pulse, conexões animadas | ⚠️ Básico (apenas progress bar) | MELHORAR |

---

## Fase 1: Expandir Tipos de Input no AttachmentNode

### 1.1 Adicionar Tab de Áudio Dedicada
**Arquivo:** `src/components/kai/canvas/nodes/AttachmentNode.tsx`

Trocar tabs de 3 para 5:
```
Arquivo | Link | Texto | Imagem | Áudio
```

Ou simplificar para manter 4 tabs mas com UX melhor:
```
YouTube | URL | Arquivo | Texto
```

Onde:
- **YouTube**: Link do YouTube (como já funciona)
- **URL**: Qualquer link (artigos, blogs, Medium, Substack) - NOVO
- **Arquivo**: Imagens, PDFs, Vídeos, Áudios
- **Texto**: Texto livre

### 1.2 Implementar Extração de URL Genérica
**Arquivo:** `src/components/kai/canvas/nodes/AttachmentNode.tsx`

```typescript
// Adicionar detecção de tipo de URL
const getUrlType = (url: string): 'youtube' | 'article' | 'instagram' => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  return 'article';
};

// Para URLs genéricas, chamar scrape-research-link
if (urlType === 'article') {
  const { data: result } = await supabase.functions.invoke('scrape-research-link', {
    body: { url: urlInput }
  });
  // ...
}
```

### 1.3 Adicionar Suporte a PDF
Já existe lógica para upload de arquivos. Adicionar accept para PDF e chamar edge function `extract-pdf`.

---

## Fase 2: Animações Visuais nos Nodes

### 2.1 Adicionar Ícones Animados por Tipo de Conteúdo
**Arquivo:** `src/components/kai/canvas/nodes/AttachmentNode.tsx`

Criar componentes de preview animados inspirados na landing page:

```typescript
// Waveform para áudio
const AnimatedWaveform = () => (
  <div className="flex items-center gap-0.5 h-6">
    {[...Array(12)].map((_, i) => (
      <motion.div
        key={i}
        className="w-0.5 rounded-full bg-green-500"
        animate={{
          height: [4, 12 + Math.random() * 8, 4],
        }}
        transition={{
          duration: 0.5 + Math.random() * 0.3,
          repeat: Infinity,
          delay: i * 0.05,
        }}
      />
    ))}
  </div>
);

// Scan effect para PDF/Imagem
const ScanEffect = () => (
  <motion.div
    className="absolute inset-0 bg-primary/20"
    animate={{ y: ['-100%', '100%'] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
);
```

### 2.2 Melhorar Preview de YouTube
Adicionar thumbnail real quando disponível e barra de progresso animada.

### 2.3 Adicionar Preview de URL
Mostrar mini-browser com typing animation como na landing page.

---

## Fase 3: Animações Durante Geração

### 3.1 Conexões Curvas Animadas (Bezier)
**Arquivo:** `src/components/kai/canvas/components/AnimatedEdge.tsx`

Atualizar para usar curvas bezier mais suaves e adicionar animação de "pulse" percorrendo o caminho durante geração:

```typescript
// Adicionar círculo pulsante que percorre o caminho
{isGenerating && (
  <>
    <motion.circle
      r="5"
      fill="hsl(var(--primary))"
      animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      <animateMotion dur="1s" repeatCount="indefinite">
        <mpath href={`#${id}`} />
      </animateMotion>
    </motion.circle>
    
    {/* Segundo círculo com delay */}
    <motion.circle
      r="3"
      fill="hsl(var(--primary))"
      opacity="0.5"
    >
      <animateMotion dur="1s" repeatCount="indefinite" begin="0.5s">
        <mpath href={`#${id}`} />
      </animateMotion>
    </motion.circle>
  </>
)}
```

### 3.2 Glow Effect no GeneratorNode Durante Geração
**Arquivo:** `src/components/kai/canvas/nodes/GeneratorNode.tsx`

Adicionar anel pulsante quando gerando:

```typescript
{isGenerating && (
  <motion.div
    className="absolute -inset-2 rounded-xl border-2 border-primary/50"
    animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
    transition={{ duration: 1, repeat: Infinity }}
  />
)}
```

### 3.3 Shimmer Effect no OutputNode
**Arquivo:** `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

Adicionar shimmer enquanto aguarda conteúdo:

```typescript
{isStreaming && (
  <motion.div
    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
    animate={{ x: ['-100%', '200%'] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
)}
```

---

## Fase 4: Melhorias de UX

### 4.1 Status Visual por Tipo de Conteúdo
Mostrar badges coloridos consistentes:

| Tipo | Cor | Ícone |
|------|-----|-------|
| YouTube | Vermelho | Play |
| URL | Azul | Globe |
| PDF | Laranja | FileText |
| Imagem | Ciano | Image |
| Áudio | Verde | Mic |
| Texto | Roxo | Type |

### 4.2 Feedback de Processamento por Etapa
Atualizar os labels de step no GeneratorNode:

```typescript
const STEP_LABELS = {
  idle: '',
  extracting: 'Extraindo conteúdo...',
  analyzing: 'Analisando contexto...',
  loading_rules: 'Carregando regras...',
  generating: 'Gerando com IA...',
  streaming: 'Recebendo resposta...',
  saving: 'Finalizando...',
  done: 'Concluído!',
};
```

### 4.3 Tooltip com Detalhes do Conteúdo
Ao hover em attachment preenchido, mostrar preview expandido.

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/kai/canvas/nodes/AttachmentNode.tsx` | Tabs expandidas (URL genérica, PDF), animações de preview, badges coloridos |
| `src/components/kai/canvas/nodes/GeneratorNode.tsx` | Glow effect, steps melhorados, ring pulsante |
| `src/components/kai/canvas/nodes/ContentOutputNode.tsx` | Shimmer durante streaming, badges de formato |
| `src/components/kai/canvas/components/AnimatedEdge.tsx` | Múltiplos círculos animados, efeito pulse |
| Novo: `src/components/kai/canvas/components/InputPreviews.tsx` | Componentes reutilizáveis de preview animado |

---

## Dependências

- `framer-motion` já instalado ✅

---

## Resultado Esperado

1. **Paridade visual** com landing page
2. **Todos os tipos de input** suportados (YouTube, URL, PDF, Texto, Imagem, Áudio)
3. **Animações ricas** durante processamento:
   - Waveform para áudio
   - Scan effect para PDF/imagem
   - Pulse nas conexões durante geração
   - Shimmer no output enquanto aguarda
   - Glow no gerador ativo
4. **Feedback claro** sobre cada etapa do processo
5. **UX consistente** com cores e ícones padronizados por tipo

---

## Ordem de Implementação

1. **InputPreviews.tsx** - Componentes de preview animados reutilizáveis
2. **AttachmentNode.tsx** - Expandir tabs, adicionar URL genérica, integrar previews animados
3. **AnimatedEdge.tsx** - Múltiplos círculos pulsantes durante geração
4. **GeneratorNode.tsx** - Glow ring, steps melhorados
5. **ContentOutputNode.tsx** - Shimmer effect durante streaming

