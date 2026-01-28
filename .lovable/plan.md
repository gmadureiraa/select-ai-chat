

# Plano de Correção: Geração de Imagem no Canvas + Output como Referência

## Diagnóstico

Foram identificados **dois problemas** que impedem o funcionamento correto do Canvas:

### Problema 1: GeneratorNode não aceita nodes de "Resultado" como entrada

O `GeneratorNode.tsx` possui uma função `getConnectedAttachments()` (linhas 135-162) que só reconhece estes tipos de nodes:
- `attachment` (Anexos)
- `sticky` (Notas adesivas)
- `text` (Caixas de texto)

**Não reconhece nodes do tipo `output` ou `contentOutput`** (Resultado), então quando você conecta um Resultado gerado anteriormente ao Gerador, essa conexão é simplesmente ignorada.

### Problema 2: Geração de imagem não está funcionando

O GeneratorNode faz chamada correta para `generate-content-v2` com `type: "image"`, porém:
1. Os inputs não estão sendo formatados corretamente para geração de imagem
2. O conteúdo de texto do Resultado não está sendo passado como briefing/contexto

---

## Solução

### Arquivo a Modificar

`src/components/kai/canvas/nodes/GeneratorNode.tsx`

### Mudanças Necessárias

#### 1. Adicionar suporte para nodes `output` e `contentOutput` na detecção de conexões

```text
Linha ~141-159: Expandir getConnectedAttachments() para incluir:

// Suporte para nodes de resultado (output) como referência
if ((sourceNode?.type === 'output' || sourceNode?.type === 'contentOutput') && sourceNode.data?.content) {
  const isImage = sourceNode.data?.isImage;
  attachments.push({
    type: isImage ? 'image' : 'text',
    content: sourceNode.data.content,
    imageBase64: isImage ? sourceNode.data.content : undefined,
    // Se for texto, usar como briefing
    transcription: !isImage ? sourceNode.data.content : undefined,
  });
}
```

#### 2. Melhorar a formatação de inputs para geração de imagem

Na chamada `handleGenerate`, quando `type === 'image'`:
- Garantir que texto de resultados conectados seja usado como briefing
- Garantir que imagens de resultados conectados sejam usadas como referência visual

```text
Linha ~186-205: Formatar inputs corretamente para tipo image:

// Para geração de imagem, organizar inputs
const formattedInputs = attachments.map(att => ({
  type: att.type,
  content: att.content,
  imageBase64: att.imageBase64,
  analysis: att.analysis,
  transcription: att.transcription,
}));
```

---

## Fluxo Corrigido

```text
┌───────────────────┐
│  Resultado (texto)│ ──────┐
│  Thread gerada    │       │
└───────────────────┘       │
                            ▼
                    ┌───────────────┐
                    │   Gerador     │ ──► Gera imagem baseada
                    │   (Imagem)    │     no texto da thread
                    └───────────────┘
```

---

## Mudanças Detalhadas

| Linha | Antes | Depois |
|-------|-------|--------|
| 141-158 | Só aceita `attachment`, `sticky`, `text` | Adiciona suporte para `output` e `contentOutput` |
| N/A | Resultado conectado é ignorado | Resultado conectado é usado como briefing/referência |

---

## Resultado Esperado

1. **Conectar Resultado → Gerador funciona**
   - Texto do resultado vira briefing para nova geração
   - Imagem do resultado vira referência visual

2. **Geração de imagem funciona**
   - Conteúdo de texto conectado é usado como contexto
   - Identidade visual do cliente é aplicada

3. **Contagem de conexões correta**
   - O badge "1 conexão" aparece quando um Resultado está conectado
   - Botão "Gerar Imagem" fica habilitado

---

## Sequência de Implementação

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Modificar GeneratorNode.tsx:                             │
│    - Adicionar detecção de nodes 'output' e 'contentOutput' │
│    - Extrair content como texto ou imagem conforme isImage  │
├─────────────────────────────────────────────────────────────┤
│ 2. Testar fluxos:                                           │
│    - Gerar texto → Conectar ao Gerador → Gerar imagem       │
│    - Gerar imagem → Conectar ao Gerador → Gerar variação    │
├─────────────────────────────────────────────────────────────┤
│ 3. Verificar logs da edge function                          │
└─────────────────────────────────────────────────────────────┘
```

