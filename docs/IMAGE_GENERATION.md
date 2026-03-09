# 🎨 Image Generation — Pipeline de Geração de Imagens
> Última atualização: 09 de Março de 2026

## Visão Geral

O sistema de geração de imagens utiliza **Gemini 2.0 Flash** (modelo `google/gemini-2.5-flash-image`) para criar visuais personalizados que integram a identidade visual do cliente e o contexto do conteúdo. Suporta geração standalone, integrada ao Canvas e automática em automações.

---

## 🔄 Pipeline de Geração

```
Input (prompt + contexto)
  │
  ├── 1. DNA Visual — Carrega client_visual_references
  │     ├── Paletas de cores do cliente
  │     ├── Estilo de fotografia preferido
  │     └── Ativos de marca (logos, elementos visuais)
  │
  ├── 2. Briefing Contextual
  │     ├── Extrai temas do conteúdo textual associado
  │     ├── Aplica modificador de estilo selecionado
  │     └── Adiciona contexto profissional/marca
  │
  ├── 3. Prompt Enrichment
  │     ├── Combina: prompt base + DNA visual + briefing
  │     ├── Adiciona instruções "NO TEXT" em múltiplos idiomas
  │     └── Especifica aspect ratio e resolução
  │
  ├── 4. Geração (Gemini 2.0 Flash)
  │     └── POST ai.gateway.lovable.dev/v1/chat/completions
  │         ├── model: google/gemini-2.5-flash-image
  │         ├── modalities: ["image", "text"]
  │         └── Retorna base64 PNG
  │
  └── 5. Validação + Retry
        ├── Verifica se imagem foi retornada
        ├── Se falhar → retry automático (até 2x)
        └── Upload para Storage bucket
```

---

## 🚫 Regra "Sem Texto" (No-Text Policy)

O sistema inclui instruções enfáticas em múltiplos idiomas para evitar texto renderizado nas imagens:

```
CRITICAL: DO NOT include ANY text, words, letters, numbers...
IMPORTANTE: NÃO inclua NENHUM texto, palavra, letra...
重要: テキスト、文字、数字を一切含めないでください
```

### Retry de Detecção de Texto
Se artefatos de texto são detectados na imagem gerada:
1. Sistema regenera com prompt reforçado
2. Máximo de 2 tentativas adicionais
3. Log do resultado de cada tentativa

---

## 🎨 Modificadores de Estilo

| Modificador | Descrição |
|-------------|-----------|
| `photographic` | Fotografia profissional, iluminação natural |
| `illustration` | Ilustração digital, estilo editorial |
| `abstract` | Formas abstratas, composição artística |
| `minimalist` | Design limpo, poucos elementos |
| `corporate` | Visual corporativo, profissional |
| `cinematic` | Estilo cinematográfico, dramático |

---

## 📐 Aspect Ratios

| Plataforma | Ratio | Uso |
|-----------|-------|-----|
| Instagram Feed | `1:1` | Posts quadrados |
| Instagram Stories/Reels | `9:16` | Vertical |
| LinkedIn | `1.91:1` | Landscape profissional |
| Twitter/X | `16:9` | Timeline cards |
| YouTube Thumbnail | `16:9` | Thumbnails |

---

## 🔗 DNA Visual do Cliente

Tabela `client_visual_references`:
```sql
{
  id, client_id,
  title, description,
  image_url,
  reference_type,   -- logo, product, lifestyle, brand_element, color_palette
  is_primary,       -- Referência principal (prioridade no prompt)
  metadata: jsonb   -- { colors: [...], style_notes: "..." }
}
```

### Como é Usado
1. Busca referências visuais do cliente antes de gerar
2. Referências `is_primary = true` são incluídas primeiro
3. Descrições e metadados são injetados no prompt
4. Cores da paleta são mencionadas explicitamente

---

## 🏗️ Pontos de Integração

### Canvas (Content Canvas)
- Nós de imagem podem ser gerados a partir de nós de texto conectados
- Texto de nós conectados é usado como briefing visual
- Imagens geradas são usadas como referência de estilo para nós subsequentes

### Automações (process-automations)
- Automações com `generate_image: true` geram imagem automaticamente
- Prompt de imagem derivado do conteúdo textual gerado
- Upload via service_role com fallback de path (clientId ou "automation")
- Retry resiliente com log de tentativas

### Chat (kai-simple-chat)
- Usuário pode pedir geração de imagem no chat
- Imagem retornada como base64 e exibida inline
- Suporta edição de imagem (enviar imagem + instrução)

### Planning (Planning Items)
- Cards podem ter `media_urls` com imagens geradas
- Imagem pode ser regenerada a qualquer momento

---

## 📦 Storage

Imagens geradas são armazenadas no bucket `generated-images`:
```
generated-images/
├── {user_id}/
│   ├── {timestamp}-{hash}.png
│   └── ...
└── automation/          # Fallback para service_role
    └── {timestamp}-{hash}.png
```

---

## 🔧 Edge Functions

| Função | Descrição |
|--------|-----------|
| `generate-image` | Geração standalone de imagens |
| `prepare-image-generation` | Prepara prompt enriquecido com DNA visual |
| `analyze-image-complete` | Análise de imagem existente com IA multimodal |

---

*Última atualização: Março 2026*
