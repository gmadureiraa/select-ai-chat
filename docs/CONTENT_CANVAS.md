# 🎨 Content Canvas — Editor Visual

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
├── hooks/                     # Hooks do canvas
└── components/                # Sub-componentes
```

---

## 📦 Tipos de Nós

| Nó | Descrição |
|----|-----------|
| **Idea** | Ideia inicial / brainstorm |
| **Content** | Conteúdo gerado ou importado |
| **Reference** | Referência externa (link, artigo) |
| **Image** | Imagem ou visual |
| **Note** | Nota livre / anotação |

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

---

## ✨ Funcionalidades

1. **Drag & Drop** — Arrastar conteúdo da library para o canvas
2. **Chat Flutuante** — Gerar conteúdo sem sair do canvas
3. **Conexões** — Conectar ideias → conteúdos para rastrear origem
4. **Geração de IA** — Gerar conteúdo a partir de um nó de ideia
5. **Análise de Imagem** — Analisar imagens com IA multimodal
6. **Extração** — Extrair conteúdo de URLs (YouTube, artigos, etc.)
7. **Export** — Exportar canvas como imagem

---

## 🤖 Geração via Canvas

1. Usuário cria nó de ideia
2. Clica "Gerar conteúdo"
3. Chama `generate-content-from-idea` ou `kai-content-agent`
4. Novo nó de conteúdo é criado e conectado
5. Conteúdo pode ser editado e movido para o planejamento

---

*Última atualização: Março 2025*
