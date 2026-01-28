
# Plano: Melhorar Geração de Imagem com Contexto Completo do Cliente

## Diagnóstico

Foram identificados **4 problemas** principais:

### Problema 1: Instrução "Sem texto" não está sendo aplicada corretamente
Na edge function `generate-content-v2`, a instrução `noText` é adicionada apenas na seção "AVOID" do prompt (linha 535-538), mas o modelo Gemini Image não está respeitando. Precisamos de:
- Instrução MUITO mais enfática no prompt principal
- Instrução em inglês e português
- Repetição da restrição em múltiplos pontos

### Problema 2: Falta de busca de referências visuais do cliente
A edge function `generate-content-v2` busca apenas dados da tabela `clients` (linha 59-63), mas **não busca as referências visuais** da tabela `client_visual_references`. Isso significa que:
- Logos, fotos de estilo, paletas de cores enviadas pelo cliente são ignoradas
- A análise de estilo (`metadata.styleAnalysis`) não é usada

### Problema 3: Briefing incompleto para geração de imagem
O prompt atual é genérico. Quando um texto gerado é conectado, ele deveria:
- Extrair o tema principal do texto
- Identificar elementos visuais mencionados
- Criar um briefing estruturado em inglês para o modelo

### Problema 4: Falta de preview de contexto no Gerador
O usuário não sabe quais informações serão usadas. Devemos mostrar:
- Quantas referências visuais do cliente serão usadas
- Se o perfil tem cores/estilo definidos
- Um resumo do briefing que será enviado

---

## Solução

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/generate-content-v2/index.ts` | Buscar referências visuais, melhorar prompt noText |
| `src/components/kai/canvas/nodes/GeneratorNode.tsx` | Adicionar preview de contexto do cliente |

---

## Mudanças Detalhadas

### 1. Edge Function: Buscar Referências Visuais do Cliente

Adicionar nova função após `fetchClientBrandContext`:

```typescript
async function fetchClientVisualReferences(
  supabaseClient: any,
  clientId: string | null
): Promise<Array<{
  imageUrl: string;
  type: string;
  styleAnalysis?: any;
  isPrimary: boolean;
}>> {
  if (!clientId) return [];

  const { data, error } = await supabaseClient
    .from('client_visual_references')
    .select('image_url, reference_type, is_primary, metadata')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .limit(5);

  if (error || !data) return [];

  return data.map((ref: any) => ({
    imageUrl: ref.image_url,
    type: ref.reference_type,
    styleAnalysis: ref.metadata?.styleAnalysis,
    isPrimary: ref.is_primary,
  }));
}
```

### 2. Edge Function: Melhorar Instrução "Sem Texto"

Substituir a lógica atual (linhas 535-538) por uma instrução MUITO mais enfática:

```typescript
if (config.noText) {
  // Instrução principal - no início do prompt
  imagePrompt = `CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT:
This image MUST NOT contain ANY text, letters, numbers, symbols, words, typography, captions, 
watermarks, logos with text, or ANY written content in ANY language.
If you add ANY text, the image will be rejected.

` + imagePrompt;

  // Instrução adicional na seção AVOID
  imagePrompt += `
STRICTLY FORBIDDEN (image will be rejected if present):
- ANY text, letters, or numbers
- Typography of any kind
- Words or symbols
- Watermarks with text
- Logos that contain text
`;
}
```

### 3. Edge Function: Incorporar Referências Visuais no Prompt

Na seção de geração de imagem (após linha 508), adicionar:

```typescript
// Fetch visual references
const visualRefs = await fetchClientVisualReferences(supabaseClient, clientId || null);

if (visualRefs.length > 0) {
  imagePrompt += `CLIENT VISUAL REFERENCES:\n`;
  
  for (const ref of visualRefs) {
    if (ref.styleAnalysis) {
      imagePrompt += `- ${ref.type.toUpperCase()} STYLE: ${ref.styleAnalysis.style_summary || ''}\n`;
      if (ref.styleAnalysis.visual_elements?.photography_style) {
        imagePrompt += `  Photography: ${ref.styleAnalysis.visual_elements.photography_style}\n`;
      }
      if (ref.styleAnalysis.visual_elements?.color_palette) {
        imagePrompt += `  Colors: ${ref.styleAnalysis.visual_elements.color_palette.join(', ')}\n`;
      }
    }
  }
  imagePrompt += "\n";
}
```

### 4. Edge Function: Melhorar Extração de Briefing do Texto

Quando um texto é passado como input, extrair o tema de forma mais inteligente:

```typescript
if (briefingText.trim()) {
  // Traduzir/resumir o tema para inglês (melhora aderência do modelo)
  const themePrompt = `Based on this content, create a visual representation:

CONTENT THEME: "${briefingText.trim().substring(0, 500)}"

Visual interpretation: Create an image that captures the essence and mood of this content.
The image should evoke the main topic without being literal.
`;
  imagePrompt += themePrompt + "\n";
}
```

### 5. GeneratorNode: Preview de Contexto

Adicionar um componente que mostra o contexto que será usado:

```tsx
// Novo componente dentro do GeneratorNode, acima do botão
{generationType === 'image' && connectedCount > 0 && !isGenerating && (
  <div className="bg-muted/50 rounded-lg p-2 text-[10px] space-y-1">
    <div className="flex items-center gap-1 text-muted-foreground">
      <Brain className="h-3 w-3" />
      <span className="font-medium">Contexto detectado:</span>
    </div>
    <div className="text-muted-foreground pl-4 space-y-0.5">
      <p>• {connectedCount} input(s) conectado(s)</p>
      {data.noText && <p>• Sem texto na imagem ✓</p>}
      <p className="text-[9px] opacity-70">
        + Identidade visual e referências do cliente
      </p>
    </div>
  </div>
)}
```

---

## Fluxo Visual da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       GERAÇÃO DE IMAGEM MELHORADA                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │  Resultado  │ ──▶ │   Gerador   │ ──▶ │  generate-content-v2    │   │
│  │   (texto)   │     │   (imagem)  │     └───────────┬─────────────┘   │
│  └─────────────┘     └─────────────┘                 │                 │
│                              │                       ▼                 │
│                              │        ┌──────────────────────────────┐ │
│                              │        │ 1. Buscar brand_assets       │ │
│                              │        │ 2. Buscar visual_references  │ │
│                              │        │ 3. Extrair tema do texto     │ │
│                              │        │ 4. Montar briefing completo  │ │
│                              │        │ 5. Aplicar noText enfático   │ │
│                              │        └──────────────┬───────────────┘ │
│                              │                       │                 │
│                              ▼                       ▼                 │
│                    ┌─────────────────────────────────────────────────┐ │
│                    │    Gemini 2.0 Flash Image Generation            │ │
│                    │    (com contexto completo do cliente)           │ │
│                    └─────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **Opção "Sem texto" funciona** - Instrução enfática impede texto bugado
2. **Imagens relevantes ao tema** - Briefing extraído do texto conectado
3. **Identidade visual aplicada** - Cores, estilo do perfil do cliente são usados
4. **Referências visuais incorporadas** - Análises de estilo salvos são aplicadas
5. **Preview de contexto** - Usuário vê o que será usado antes de gerar

---

## Sequência de Implementação

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Atualizar generate-content-v2/index.ts:                              │
│    - Adicionar função fetchClientVisualReferences                       │
│    - Melhorar instrução noText (enfática, repetida)                     │
│    - Incorporar referências visuais no prompt                           │
│    - Melhorar extração de briefing do texto                             │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Atualizar GeneratorNode.tsx:                                         │
│    - Adicionar preview de contexto detectado                            │
│    - Mostrar que referências do cliente serão usadas                    │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Deploy e teste                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```
