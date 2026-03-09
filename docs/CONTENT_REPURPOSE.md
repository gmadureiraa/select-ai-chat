# ♻️ Content Repurpose — YouTube → Multi-formato
> Última atualização: 09 de Março de 2026

## Visão Geral

O sistema de Content Repurpose permite transformar vídeos do YouTube em múltiplos formatos de conteúdo (tweets, threads, carrosséis, newsletters, posts LinkedIn, blog posts) automaticamente, usando a transcrição como base.

---

## 🔄 Fluxo Completo

```
1. ENTRADA
   └── Usuário cola URL do YouTube

2. EXTRAÇÃO (extract-youtube)
   ├── Obtém transcrição via YouTube API / fallback scraping
   ├── Extrai título e thumbnail
   └── Resolve channel info (resolve-youtube-channel)

3. CONFIGURAÇÃO
   ├── Usuário seleciona formatos desejados:
   │   ├── Tweet (único)
   │   ├── Thread (5-12 tweets)
   │   ├── Carrossel (slides visuais)
   │   ├── Newsletter (email longo)
   │   ├── Post LinkedIn (profissional)
   │   └── Blog Post (artigo completo)
   │
   └── Define objetivo:
       ├── "educar" — foco em ensinar
       ├── "vender" — foco em conversão
       └── "entreter" — foco em engajamento

4. GERAÇÃO (paralela por formato)
   └── Para cada formato selecionado:
       └── unified-content-api ou kai-content-agent
           ├── Brief = transcrição + objetivo
           ├── Contexto do cliente (identity guide, tom)
           └── Regras do formato (_shared/format-schemas.ts)

5. RESULTADOS
   ├── Preview de cada formato gerado
   ├── Edição inline
   ├── Salvar na Content Library
   └── Criar cards no Planning
```

---

## 🏗️ Componentes

```
src/components/repurpose/
├── RepurposePage.tsx           # Página principal
├── YouTubeInput.tsx            # Input de URL + preview do vídeo
├── FormatSelector.tsx          # Seleção de formatos com toggles
├── ObjectiveSelector.tsx       # Seleção de objetivo
├── RepurposeResults.tsx        # Lista de resultados gerados
├── RepurposeResultCard.tsx     # Card individual com preview + ações
└── TranscriptPreview.tsx       # Visualização da transcrição
```

---

## 📦 Tabela

```sql
content_repurpose_history {
  id, workspace_id, client_id,
  youtube_url: text,
  video_title: text,
  video_thumbnail: text,
  transcript: text,              -- Transcrição completa
  objective: text,               -- educar, vender, entreter
  generated_contents: jsonb,     -- Array de { format, content, title, metadata }
  created_by: uuid,
  created_at, updated_at
}
```

### Estrutura de `generated_contents`
```json
[
  {
    "format": "tweet",
    "title": "Tweet sobre...",
    "content": "Texto do tweet...",
    "metadata": {
      "char_count": 245,
      "generated_at": "2026-03-09T..."
    }
  },
  {
    "format": "linkedin",
    "title": "Post LinkedIn...",
    "content": "Texto longo...",
    "metadata": { ... }
  }
]
```

---

## ✨ Features

- **Extração automática** de transcrição (multi-idioma)
- **Thumbnail e título** do vídeo exibidos como preview
- **Múltiplos formatos** gerados em paralelo (Promise.all)
- **Objetivo customizável** que influencia tom e estrutura
- **Salvar na Content Library** com um click
- **Criar cards no Planning** diretamente dos resultados
- **Edição inline** antes de salvar
- **Histórico** de repurposes anteriores por cliente

---

## 🔗 Edge Functions Envolvidas

| Função | Papel |
|--------|-------|
| `extract-youtube` | Extrai transcrição e metadados do vídeo |
| `resolve-youtube-channel` | Resolve info do canal (nome, avatar, subscribers) |
| `unified-content-api` | Gera conteúdo por formato com regras |
| `kai-content-agent` | Alternativa de geração via agente especializado |

---

*Última atualização: Março 2026*
