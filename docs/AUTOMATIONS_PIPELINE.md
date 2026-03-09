# Pipeline de Automações - Documentação Técnica

**Arquivo principal:** `supabase/functions/process-automations/index.ts`  
**Última atualização:** Março 2026

---

## 🔄 FLUXO COMPLETO

```
Trigger (RSS/Schedule/Webhook)
  ↓
Verificar condições de disparo
  ↓
Criar planning_item (Kanban)
  ↓
Carregar contexto enriquecido (knowledge-loader)
  ↓
Injetar Voice Profile (getStructuredVoice)
  ↓
Construir prompt com variação editorial
  ↓
Chamar unified-content-api
  ↓ (Writer → Validate → Repair → Review)
Limpar output (cleanContentOutput)
  ↓
Gerar imagem (se habilitado)
  ↓
Salvar na biblioteca do cliente
  ↓
Auto-publicar (se habilitado)
  ↓
Registrar run na planning_automation_runs
```

---

## 🎯 TRIGGERS

### Schedule (Diário/Semanal/Mensal)
- `shouldTriggerSchedule()` verifica dia/hora atual vs configuração
- Previne duplo disparo no mesmo dia (`last_triggered_at`)
- Tipos: `daily` (ignora `days`), `weekly` (days = dia da semana 0-6), `monthly` (days = dia do mês)

### RSS Feed
- `checkRSSTrigger()` busca e parseia o feed (RSS 2.0 ou Atom/YouTube)
- Compara `guid` do item mais recente com `last_guid` salvo
- Suporta YouTube (Atom), newsletters (RSS) e qualquer feed padrão
- Extrai imagens de `<media:content>`, `<enclosure>`, e HTML inline

### Webhook
- Disparo externo via HTTP POST (reservado para futuro)

---

## 📚 CONTEXTO ENRIQUECIDO

### Camadas de contexto (em ordem de prioridade):

1. **Identity Guide** - Guia mestre da marca do cliente
2. **Voice Profile** - Listas de "Use" e "Evite" + tom de voz
3. **Biblioteca de Favoritos** - Conteúdos marcados como `is_favorite` para replicação de estilo
4. **Top Performers** - Posts com melhor engagement para padrões de sucesso
5. **Referências do Cliente** - Artigos, estudos e materiais de referência
6. **Anti-exemplos** - Últimos 7 posts publicados para evitar repetição
7. **Global Knowledge** - Base de conhecimento do workspace
8. **Deep Research** - Pesquisa em tempo real (apenas newsletters, via Gemini + Google Search)

### Voice Profile (dupla injeção)
O Voice Profile é injetado em **dois momentos**:
1. No `process-automations`: concatenado ao `enrichedContext` antes de montar o prompt final
2. No `unified-content-api`: carregado novamente via `getStructuredVoice()` no sistema de geração

Isso cria uma **dupla camada de reforço** que garante aderência ao tom de voz.

---

## 🎲 SISTEMA DE ROTAÇÃO EDITORIAL

### Twitter/X (8 categorias)
Rotação automática entre:
1. Provocação
2. Insight técnico
3. Pergunta
4. Storytelling micro
5. Call-to-action
6. Dado/Métrica
7. Humor/Ironia
8. Observação aguda

**Mecanismo:** `variation_index` salvo no `trigger_config` da automação, incrementado a cada disparo.

### LinkedIn (3 tipos editoriais × 4-5 variações)
- **Opinion**: Contrarian Take, Dados & Análise, Framework Próprio, Tendência Emergente, Lição do Fracasso
- **Building in Public**: Bastidores, Números Abertos, Aprendizado, Ferramenta/Stack, Decisão Difícil
- **Case Study**: Resultados & Métricas, Processo Revelado, Transformação, Erro que Virou Acerto

**Detecção:** Baseada no nome da automação (contém "building" → building_in_public, etc.)

---

## 🧹 CLEANING RULES

`cleanContentOutput()` é aplicado a **todo** conteúdo gerado:

1. Remove wrappers de code block (```)
2. Para plataformas text-only (Twitter, Threads, LinkedIn): extrai apenas LEGENDA quando há TEXTO DO VISUAL
3. Remove markdown (bold, headers, separadores, bullet points)
4. Remove labels de IA (TWEET:, LEGENDA:, CAPTION:, etc.)
5. Limpa whitespace excessivo
6. Remove aspas envolventes

---

## 🖼️ GERAÇÃO DE IMAGEM

Quando `auto_generate_image` está habilitado:
1. Monta prompt de imagem usando `image_prompt_template` + dados do RSS
2. Aplica modificador de estilo (`photographic`, `illustration`, `minimalist`, `vibrant`)
3. Chama `prepare-image-generation` → `generate-image`
4. Anexa URL da imagem gerada ao planning_item

---

## 📤 AUTO-PUBLICAÇÃO

Quando `auto_publish` está habilitado:
1. Move o card para a coluna "Publicado" do Kanban
2. Chama a API de publicação da plataforma correspondente (Twitter, LinkedIn, etc.)
3. Registra resultado na `planning_automation_runs`

---

## 📊 RASTREAMENTO

Cada execução gera um registro em `planning_automation_runs`:
- `status`: running → completed/failed/skipped
- `duration_ms`: tempo total da execução
- `result`: resumo do que foi criado
- `error`: mensagem de erro (se falhou)
- `content_generated`: conteúdo produzido

---

## 🔗 DEPENDÊNCIAS

- `knowledge-loader.ts` → `getFullContentContext()`, `getStructuredVoice()`
- `format-constants.ts` → `FORMAT_MAP`, `PLATFORM_MAP`, `CONTENT_TYPE_LABELS`
- `unified-content-api` → Pipeline Writer → Validate → Repair → Review
- `research-newsletter-topic` → Deep Research para newsletters
- `youtube-transcribe` → Transcrição de vídeos YouTube
- `firecrawl-scrape` → Extração de conteúdo de URLs genéricos
- `prepare-image-generation` / `generate-image` → Geração de imagens

---

*Última atualização: Março 2026*
