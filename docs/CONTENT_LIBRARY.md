# 📚 Content Library — Gestão de Ativos
> Última atualização: 09 de Março de 2026

## Visão Geral

A Content Library é o hub central de ativos do cliente, organizada em múltiplas abas: Conteúdo, Referências, Visuais, Estudos de Caso e Relatórios. Suporta sincronização automática via RSS/Beehiiv e integração drag-and-drop com o Canvas.

---

## 🏗️ Componentes

```
src/components/library/
├── ContentLibraryTab.tsx         # Tab principal com sub-abas
├── ContentLibraryItem.tsx        # Card individual de conteúdo
├── ContentLibraryPreview.tsx     # Modal preview otimizado para leitura longa
├── ReferenceLibraryTab.tsx       # Aba de referências (artigos, estudos)
├── VisualReferencesTab.tsx       # Aba de referências visuais
├── VisualReferenceUploader.tsx   # Upload de imagens/logos
├── RSSFeedManager.tsx            # Gerenciador de feeds RSS
└── ImportDialog.tsx              # Importação de dados (CSV, etc.)
```

---

## 📦 Tabelas

### `client_content_library`
```sql
{
  id, client_id,
  title: text,
  content: text,                    -- Conteúdo completo
  content_type: content_type_enum,  -- post, newsletter, case_study, report, thread, carousel, etc.
  content_url: text,                -- URL original
  thumbnail_url: text,              -- Capa/thumbnail
  metadata: jsonb,                  -- { source, attachments, synced_from, ... }
  is_favorite: boolean,
  created_at, updated_at
}
```

**Enum `content_type`:** `post`, `newsletter`, `case_study`, `report`, `thread`, `carousel`, `video_script`, `blog_post`, `other`

### `client_reference_library`
```sql
{
  id, client_id,
  title: text,
  content: text,
  reference_type: text,     -- article, study, competitor, inspiration
  source_url: text,
  thumbnail_url: text,
  metadata: jsonb,
  created_at, updated_at
}
```

### `client_visual_references`
```sql
{
  id, client_id,
  title: text,
  description: text,
  image_url: text,
  reference_type: text,     -- logo, product, lifestyle, brand_element, color_palette
  is_primary: boolean,      -- Referência principal do tipo
  metadata: jsonb,
  created_at, updated_at
}
```

---

## 📥 Fontes de Conteúdo

### 1. Criação Manual
- Upload direto via interface
- Importação de CSV (`validate-csv-import`)
- Cópia do Chat (salvar resposta da IA como conteúdo)

### 2. Sincronização RSS (`sync-rss-to-library`)
```
Feed RSS configurado no RSSFeedManager
  → Edge function sync-rss-to-library (cron)
  → Para cada novo item:
     ├── Extrai título, conteúdo, URL
     ├── Busca thumbnail via OpenGraph/meta tags
     ├── update-newsletter-covers (capas de newsletters)
     └── Salva em client_content_library
```

### 3. Sincronização Beehiiv (`import-beehiiv-newsletters`)
- Importa newsletters publicadas do Beehiiv
- Preserva formatação HTML e imagens
- Atualiza automaticamente capas

### 4. Sincronização do Performance Hub
- `SyncToLibraryDialog` importa posts do Instagram/LinkedIn/Twitter
- Preserva mídia, caption e metadados originais
- Marca `content_synced_at` para evitar duplicatas

### 5. Geração Automática
- Relatórios de Performance salvos como tipo `other`
- Conteúdo gerado pelo Canvas
- Output de automações

---

## ✨ Features

### Preview Modal Otimizado
- Renderização de conteúdo longo com scroll suave
- Galeria de imagens integrada (se `metadata.attachments` existe)
- Botões de ação: copiar, editar, mover para Planning

### Sistema de Favoritos
- Toggle `is_favorite` em qualquer item
- Filtro rápido por favoritos
- Favoritos aparecem primeiro na ordenação padrão

### Drag & Drop para Canvas
- Itens da biblioteca podem ser arrastados para o Content Canvas
- Cria automaticamente um nó do tipo Content ou Reference
- Preserva conexão com o item original

### Busca e Filtros
- Busca por título e conteúdo
- Filtro por `content_type`
- Filtro por favoritos
- Ordenação por data ou relevância

---

## 🔗 Hooks

| Hook | Função |
|------|--------|
| `useContentLibrary(clientId)` | CRUD completo da Content Library |
| `useReferenceLibrary(clientId)` | CRUD da Reference Library |
| `useVisualReferences(clientId)` | CRUD de Visual References |

---

## 🤖 Integração com IA

A Content Library é usada como contexto em múltiplos pontos:
- **kAI Chat**: Últimos 20 itens como contexto para geração
- **Agentes de conteúdo**: Material de referência para estilo/tom
- **Canvas**: Base para brainstorm e expansão de ideias
- **Automações**: Posts da biblioteca como inspiração temática

---

*Última atualização: Março 2026*
