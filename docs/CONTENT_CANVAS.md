# 🎨 Content Canvas — Editor Visual
> Última atualização: 09 de Março de 2026

## Visão Geral

O Content Canvas é um editor visual baseado em **ReactFlow** que permite organizar, conectar e gerar conteúdo de forma visual. Funciona como um "whiteboard" de ideias com nós conectáveis e geração de IA integrada.

---

## 🏗️ Componentes

```
src/components/kai/canvas/
├── ContentCanvas.tsx          # Componente principal (ReactFlow)
├── CanvasToolbar.tsx          # Barra de ferramentas
├── CanvasFloatingChat.tsx     # Chat flutuante dentro do canvas
├── CanvasLibraryDrawer.tsx    # Drawer para arrastar conteúdo da library
├── ContentViewerModal.tsx     # Modal de visualização de conteúdo
├── ExtractedContentPreview.tsx # Preview de conteúdo extraído
├── ImageAnalysisModal.tsx     # Análise de imagem com IA
├── nodes/                     # Tipos de nós customizados
│   ├── IdeaNode.tsx
│   ├── ContentNode.tsx
│   ├── ReferenceNode.tsx
│   ├── ImageNode.tsx
│   ├── NoteNode.tsx
│   └── OutputNode.tsx         # Nó de resultado (texto/imagem gerado)
├── hooks/
│   ├── useCanvasState.ts      # Estado dos nós e edges
│   ├── useCanvasGeneration.ts # Lógica de geração via IA
│   └── useCanvasPersistence.ts # Auto-save no banco
└── components/
    ├── NodeContextMenu.tsx    # Menu de contexto por nó
    └── CanvasControls.tsx     # Zoom, fit, minimap
```

---

## 📦 Tipos de Nós

| Nó | Descrição | Data Fields |
|----|-----------|-------------|
| **Idea** | Ideia inicial / brainstorm | `{ text, tags[], priority }` |
| **Content** | Conteúdo gerado ou importado | `{ text, contentType, platform, libraryId? }` |
| **Reference** | Referência externa (link, artigo) | `{ url, title, excerpt, thumbnailUrl }` |
| **Image** | Imagem ou visual | `{ imageUrl, prompt?, style?, altText }` |
| **Note** | Nota livre / anotação | `{ text, color }` |
| **Output** | Resultado de geração IA | `{ text, imageUrl?, format, generatedFrom[] }` |

### Schema Genérico de Nó (ReactFlow)
```typescript
{
  id: string,
  type: 'idea' | 'content' | 'reference' | 'image' | 'note' | 'output',
  position: { x: number, y: number },
  data: {
    // Campos específicos do tipo (ver tabela acima)
    label?: string,
    createdAt: string,
    updatedAt: string,
  }
}
```

---

## 🔗 Persistência

Tabela `content_canvas`:
```sql
{
  id: uuid,
  workspace_id: uuid,
  client_id: uuid,
  user_id: uuid,
  name: text,
  nodes: jsonb,    -- Array de nós do ReactFlow
  edges: jsonb,    -- Array de conexões
  created_at, updated_at
}
```

Auto-save: debounced (2s) após qualquer alteração em nós ou edges.

---

## ✨ Funcionalidades

1. **Drag & Drop** — Arrastar conteúdo da library para o canvas
2. **Chat Flutuante** — Gerar conteúdo sem sair do canvas (CanvasFloatingChat)
3. **Conexões** — Conectar ideias → conteúdos para rastrear origem
4. **Geração de IA** — Gerar conteúdo/imagem a partir de nós conectados
5. **Análise de Imagem** — Analisar imagens com IA multimodal (ImageAnalysisModal)
6. **Extração de URL** — Extrair conteúdo de YouTube, artigos, etc.
7. **Export** — Exportar canvas como imagem (html-to-image)

---

## 🤖 Geração via Canvas

### Geração de Texto
```
Nó de Idea selecionado
  → Clica "Gerar conteúdo"
  → useCanvasGeneration:
     ├── Coleta texto do nó de ideia
     ├── Busca nós conectados (OutputNodes como contexto)
     ├── Textos de nós conectados = briefing estratégico
     └── Chama kai-content-agent ou generate-content-from-idea
  → Novo OutputNode criado e conectado automaticamente
  → Conteúdo pode ser editado inline
```

### Geração de Imagem
```
Nó de texto (Idea/Content/Output) selecionado
  → Clica "Gerar imagem"
  → Coleta texto como prompt/briefing
  → Busca ImageNodes conectados como referências de estilo
  → Chama generate-image com DNA visual do cliente
  → Novo ImageNode/OutputNode criado e conectado
```

### Continuidade e Memória
- OutputNodes conectados servem como **contexto** para gerações subsequentes
- Texto de nós anteriores = briefing estratégico para novos nós
- Imagens de nós anteriores = referência visual para manter consistência de marca

---

## ⌨️ Atalhos e Interações

| Ação | Atalho/Gesto |
|------|-------------|
| Novo nó de Idea | Double-click no canvas vazio |
| Deletar nó | `Delete` / `Backspace` |
| Conectar nós | Drag do handle de saída para handle de entrada |
| Zoom | Scroll / Pinch |
| Pan | Click + Drag no fundo |
| Fit to view | Botão "Fit" nos controles |
| Menu de contexto | Right-click no nó |

---

## 📤 Movendo para Planning

Conteúdo gerado no Canvas pode ser enviado para o Planning:
1. Seleciona OutputNode/ContentNode
2. Clica "Enviar para Planning"
3. Cria card no Kanban (coluna "Ideias" ou "Rascunho")
4. Preserva conteúdo, plataforma e metadados

---

*Última atualização: Março 2026*
