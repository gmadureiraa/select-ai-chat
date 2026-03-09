# ♻️ Content Repurpose — YouTube → Multi-formato

## Visão Geral

O sistema de Content Repurpose permite transformar vídeos do YouTube em múltiplos formatos de conteúdo (tweets, carrosséis, newsletters, etc.) automaticamente.

---

## 🔄 Fluxo

```
URL do YouTube
  │
  ├── 1. extract-youtube → Extrai transcrição
  │
  ├── 2. Usuário seleciona formatos desejados
  │     ├── Tweet
  │     ├── Thread
  │     ├── Carrossel
  │     ├── Newsletter
  │     ├── Post LinkedIn
  │     └── Blog Post
  │
  ├── 3. Para cada formato selecionado:
  │     └── unified-content-api (ou kai-content-agent)
  │         ├── Brief = transcrição + objetivo
  │         ├── Contexto do cliente
  │         └── Regras do formato
  │
  └── 4. Resultados salvos em content_repurpose_history
```

---

## 📦 Tabela

```sql
content_repurpose_history {
  id, workspace_id, client_id,
  youtube_url,
  video_title, video_thumbnail,
  transcript,
  objective,
  generated_contents: jsonb,  -- Array de {format, content, ...}
  created_by, created_at, updated_at
}
```

---

## ✨ Features

- Extração automática de transcrição
- Thumbnail e título do vídeo
- Múltiplos formatos em paralelo
- Objetivo customizável ("educar", "vender", "entreter")
- Salvar conteúdos na Content Library
- Criar cards no Planning diretamente

---

*Última atualização: Março 2025*
