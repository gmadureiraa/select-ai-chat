# Auditoria do Canvas (KAINOVO)

Este documento consolida **problemas reais** encontrados no projeto relacionados a “o canvas não estar gerando um bom conteúdo”, conectando-os aos sintomas da imagem (“overengineering”, “reinventa a roda”, “não sabe fazer algo”, “repete trechos de código”, “junta tudo no mesmo lugar”).

## 1) O que é “Canvas” no projeto (contexto rápido)

O “Canvas” aqui é um **grafo do ReactFlow** com nós (anexos, gerador, output, chat/whiteboard) e Edge Functions que fazem geração e extrações.

- **UI principal**: `src/components/kai/canvas/ContentCanvas.tsx`
- **Nós do canvas**: `src/components/kai/canvas/nodes/*`
- **Geração** (pelo nó Gerador): `supabase/functions/generate-content-v2/index.ts`
- **Agente de conteúdo (regras fortes de formato)**: `supabase/functions/kai-content-agent/*`

## 2) Problema central: qualidade de conteúdo (por que sai “ruim”)

### 2.1 Regras de formato fortes existiam, mas o Canvas não as usava

O projeto já tem um pacote de regras bem detalhado em `supabase/functions/kai-content-agent/format-rules.ts` (carrossel, thread, newsletter, reels etc).

Porém o Canvas estava gerando texto via `generate-content-v2`, que tinha **regras muito mais rasas** e um “prompt guide” simplificado.

- **Impacto**:
  - Saída mais genérica
  - Estrutura inconsistente com o formato (carrossel/thread)
  - “Cara de IA” e repetição de padrões (“frases genéricas”, pouca validação)

### 2.2 Inconsistência de nomes de formatos (quebra de regras / regra errada)

No frontend e backend, havia divergências como:
- `carrossel` vs `carousel`
- `reels` vs `reel_script`
- `story/stories`

Quando formato diverge, a camada de regras pode cair no **default errado** (ex.: virar `post`), causando conteúdo fora do esperado.

**Evidência**:
- UI do gerador usando `carrossel`/`reels`: `src/components/kai/canvas/nodes/GeneratorNode.tsx`
- Estruturas do canvas e outputs usando `carousel`/`reel_script`: `src/components/kai/canvas/hooks/useCanvasState.ts` e `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

### 2.3 Prompt “pesado” e “poluído” (degrada a geração)

O `generate-content-v2` acumulava contextos sem limites claros (transcrições longas, JSON de análise de imagem), o que:
- aumenta ruído
- dificulta o modelo seguir estrutura
- aumenta chance de respostas genéricas e inconsistentes

## 3) Problemas da imagem (mapeados para o código)

### 3.1 Overengineering

- **Sintoma**: múltiplas camadas e features no canvas (whiteboard, chat, biblioteca, autosave, múltiplas fontes) no mesmo componente/hook.
- **Evidência**: `src/components/kai/canvas/ContentCanvas.tsx` e `src/components/kai/canvas/hooks/useCanvasState.ts` concentram muita responsabilidade.

### 3.2 Reinventa a roda

Existem múltiplos sistemas para “gerar conteúdo” no repo:
- `kai-content-agent` (bem rico, com regras de formato + contexto do cliente)
- `generate-content-v2` (mais simples)
- fluxos adicionais em hooks como `usePlanningContentGeneration.ts` e `useContentCreator.ts`

Resultado: funcionalidades paralelas com qualidade/inputs diferentes.

### 3.3 Não sabe fazer algo (no sentido de: decisão técnica não fecha o loop)

Exemplo concreto: o projeto tinha regras fortes prontas (`format-rules.ts`), mas o fluxo do Canvas não as usava, então o produto final fica “pior do que poderia”.

### 3.4 Repete trechos de código

Há várias implementações de “montar prompt”, “mapear formato”, “juntar contexto” em lugares diferentes:
- `supabase/functions/kai-content-agent/index.ts`
- `supabase/functions/generate-content-v2/index.ts`
- `src/hooks/usePlanningContentGeneration.ts`
- `src/hooks/useContentCreator.ts`

Isso cria divergência de comportamento e manutenção difícil.

### 3.5 Junta tudo no mesmo lugar

`useCanvasState.ts` mistura:
- persistência (save/load/delete/autosave)
- extração de URLs (youtube/instagram/artigos)
- transcrição de mídia
- análise de imagem (OCR/JSON)
- geração de texto/imagem
- templates do canvas

Isso torna difícil testar, otimizar e evoluir sem regressões.

## 4) Correções implementadas nesta auditoria (impacto direto na qualidade)

### 4.1 Padronização de formato no gerador (UI)

- Ajustado o template rápido “Carrossel” para usar `carousel` (em vez de `carrossel`).
- Ajustado `GeneratorNode` para usar formatos internos consistentes:
  - `carousel`, `thread`, `newsletter`, `reel_script`, `post`, `stories`

Arquivos:
- `src/components/kai/canvas/CanvasToolbar.tsx`
- `src/components/kai/canvas/nodes/GeneratorNode.tsx`

### 4.2 `generate-content-v2` agora injeta regras completas de formato

O `generate-content-v2` passou a importar e usar `getFormatRules(...)` de `kai-content-agent/format-rules.ts`, garantindo:
- estrutura rígida por formato
- checklist de validação
- diretrizes universais (anti-repetição, CTA, limites etc)

Além disso, foi adicionado:
- **normalização de formatos** (carrossel/carousel/reel_script → reels etc)
- **limites de tamanho** em transcrições, textos e JSON para reduzir ruído

Arquivo:
- `supabase/functions/generate-content-v2/index.ts`

## 5) Recomendações (próximos passos)

- **Unificar pipelines**: escolher **uma** abordagem de geração (idealmente `kai-content-agent`) e tornar o Canvas um “cliente” dela; reduzir duplicidade (`generate-content-v2` vs `kai-content-agent`).
- **Extrair responsabilidades do `useCanvasState`**:
  - `canvasPersistence.ts`
  - `canvasExtraction.ts`
  - `canvasGeneration.ts`
  - `canvasTemplates.ts`
- **Criar um “Format Registry” único** (enum + mapeamentos) para frontend e backend:
  - evitar `carrossel/carousel`, `reels/reel_script`, etc.
- **Limitar contexto por fonte** (sempre):
  - transcrições com teto
  - OCR/JSON resumidos
  - preferir “resumo estruturado” ao invés de colar JSON bruto

## 6) Checklist de validação (para você testar rápido)

- Gerador → Texto → Formato “Carrossel”: saída vem com estrutura coerente e sem “cara genérica”.
- Gerador → Texto → Formato “Roteiro Reels”: saída segue regras do formato (gancho, timing, CTA).
- Inputs com transcrição grande não “explodem” o prompt (resposta mantém foco).

