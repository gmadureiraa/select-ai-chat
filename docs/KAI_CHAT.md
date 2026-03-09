# 🤖 kAI Chat — Motor Principal

## Visão Geral

O kAI Chat é o motor central do Kaleidos, implementado na edge function `kai-simple-chat` (~2600 linhas). É um assistente de IA contextual que detecta intenções, carrega contexto do cliente e executa ações especializadas.

---

## 🧠 Detecção de Intenção

O chat analisa cada mensagem e roteia para o handler correto:

| Intenção | Detector | Handler |
|----------|----------|---------|
| **Criação de conteúdo** | `detectContentCreation()` + `CONTENT_FORMAT_KEYWORDS` | Gera conteúdo via streaming com contexto completo |
| **Métricas / Performance** | `isMetricsQuery()` + `isSpecificContentQuery()` | Consulta dados reais e analisa com IA |
| **Relatório completo** | `isReportRequest()` | Gera relatório multi-plataforma |
| **Planejamento** | `detectPlanningIntent()` | Cria cards no Kanban |
| **Pesquisa web** | `isWebSearchQuery()` | Pesquisa via Gemini com Google Grounding |
| **Análise de imagem** | Detecta `imageUrls` no payload | Analisa imagens com modelo multimodal |
| **Conversa geral** | Fallback | Chat conversacional com contexto do cliente |

### Detecção de Formato de Conteúdo

Keywords mapeadas em `_shared/format-constants.ts`:

```
carrossel → ["carrossel", "carousel"]
newsletter → ["newsletter"]
post_instagram → ["post", "postagem"]
linkedin → ["linkedin", "post linkedin"]
thread → ["thread"]
tweet → ["tweet", "tuit"]
reels → ["reels", "reel", "vídeo curto"]
stories → ["stories", "story"]
artigo → ["artigo"]
blog → ["blog post", "blog"]
email → ["email", "email marketing"]
```

### Detecção Implícita de Formato

Quando o usuário diz "cria outro" sem especificar formato, o sistema:
1. Analisa as últimas 5 mensagens do histórico
2. Detecta se houve geração de conteúdo anterior
3. Reutiliza o formato detectado

---

## 📋 Contexto Carregado

Para cada mensagem, o kAI Chat carrega:

1. **Identity Guide** — Guia de identidade da marca (limitado a 8000 chars)
2. **Content Library** — Top performers do tipo relevante (max 12000 chars citados)
3. **Voice Profile** — Perfil de voz estruturado do cliente
4. **Format Rules** — Regras customizadas do formato (da tabela `format_rules`)
5. **Format Documentation** — Documentação técnica do formato (da tabela `kai_documentation`)
6. **Global Knowledge** — Base de conhecimento global do workspace
7. **Visual References** — Referências visuais da marca (quando relevante)
8. **Métricas** — Dados reais de performance (quando query de métricas)

### Citações

O sistema identifica quais materiais foram usados como referência e retorna `citations` no payload:

```typescript
interface Citation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}
```

---

## 🎯 Criação de Conteúdo no Chat

### Fluxo
1. Detecta formato (explícito ou implícito)
2. Carrega `kai_documentation` para o formato
3. Carrega `format_rules` customizadas do workspace
4. Busca top performers do tipo na `client_content_library`
5. Monta system prompt com:
   - Identity guide + voice profile
   - Regras do formato + checklist
   - Exemplos da library (top performers)
   - Global knowledge relevante
6. Gera conteúdo via streaming (Gemini ou GPT)
7. Retorna com `sources_used` e `citations`

### Instruções do Usuário (Override)

O sistema detecta instruções explícitas que têm **prioridade máxima**:

| Instrução | Trigger | Efeito |
|-----------|---------|--------|
| Sem imagens | "sem imagens", "apenas texto" | Remove sugestões de imagem |
| Só URL | "só a URL", "apenas o link" | Usa apenas link, sem mídia |
| Sem emoji | "sem emoji", "zero emoji" | Remove todos os emojis |
| Usar capa | "usar capa", "apenas a capa" | Usa só imagem de capa |

---

## 📊 Consultas de Métricas

### Dados Consultados
- `instagram_posts` — Posts com métricas (likes, comments, reach, saves, shares, engagement_rate)
- `linkedin_posts` — Posts LinkedIn com métricas
- `youtube_videos` — Vídeos com views, likes, comments
- `instagram_stories` — Stories com retention, views, interactions

### Análise Inteligente
- Identifica top performers
- Calcula médias e tendências
- Compara períodos (7d, 30d, 90d)
- Detecta padrões de melhor performance (horário, tipo, tema)

---

## 📅 Criação de Cards no Planejamento

### Detecção de Planning Intent

O chat detecta pedidos como:
- "Crie 5 cards no planejamento para Instagram"
- "Agende um post para amanhã sobre IA"
- "Distribua 3 posts ao longo da semana"
- "Coloca isso no planejamento"

### Informações Extraídas
- **Quantidade** — Número de cards (default: 1)
- **Plataforma** — Instagram, Twitter, LinkedIn, etc.
- **Data** — Absoluta (DD/MM/YYYY) ou relativa (amanhã, segunda)
- **URL fonte** — Para extração de conteúdo
- **Tópico** — Tema do conteúdo

### Follow-up Inteligente

Se faltam informações, o kAI pergunta:
1. "Para qual plataforma?"
2. "Para qual data?"
3. "Sobre qual tema?"

E detecta as respostas como continuação do fluxo.

### Criação com Geração de Conteúdo

Para cada card:
1. Chama `kai-content-agent` para gerar conteúdo
2. Cria `planning_item` com título, conteúdo, plataforma, data
3. Move para coluna "Rascunho"
4. Retorna confirmação com links

---

## 🔍 Pesquisa Web

Quando detecta intenção de pesquisa:
1. Usa Gemini 2.5 Flash com Google Search Grounding
2. Retorna resultados com fontes citadas
3. Contextualiza para o nicho do cliente

---

## 🖼️ Análise de Imagens

Quando o usuário envia imagens:
1. Detecta presença de `imageUrls` no payload
2. Usa modelo multimodal (Gemini) para analisar
3. Contextualiza análise para o formato/objetivo do cliente

---

## ⚙️ Configurações

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `MAX_IDENTITY_GUIDE_LENGTH` | 8000 | Limite do identity guide |
| `MAX_CITED_CONTENT_LENGTH` | 12000 | Limite de conteúdo citado |
| `MAX_HISTORY_MESSAGES` | 15 | Mensagens de histórico enviadas |
| `MAX_METRICS_CONTEXT_LENGTH` | 8000 | Limite de contexto de métricas |
| `ALLOWED_PLANS` | pro, enterprise, agency | Planos com acesso ao kAI |

---

*Última atualização: Março 2025*
