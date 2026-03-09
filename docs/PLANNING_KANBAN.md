# 📅 Planejamento — Kanban & Calendário

## Visão Geral

O sistema de Planejamento é o hub de gestão editorial do Kaleidos. Combina um **Kanban Board** com um **Calendário** para gerenciar o ciclo de vida completo de conteúdo: ideação → rascunho → revisão → aprovação → agendamento → publicação.

---

## 🏗️ Estrutura

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `planning_items` | Cards de conteúdo (título, conteúdo, plataforma, data, status, etc.) |
| `kanban_columns` | Colunas configuráveis por workspace |
| `planning_item_comments` | Comentários em cards |
| `scheduled_posts` | Posts agendados para publicação |
| `recurring_content_templates` | Templates de conteúdo recorrente |

### Colunas Padrão

Inicializadas por `initialize_kanban_columns()`:

| Posição | Nome | Tipo | Cor |
|---------|------|------|-----|
| 0 | Ideias | `idea` | purple |
| 1 | Rascunho | `draft` | blue |
| 2 | Revisão | `review` | yellow |
| 3 | Aprovado | `approved` | green |
| 4 | Agendado | `scheduled` | orange |
| 5 | Publicado | `published` | gray |

---

## 🎯 Views

### Kanban View
- Colunas drag-and-drop (mover cards entre colunas)
- Cards virtualizados para performance (`react-window`)
- Filtros por: cliente, plataforma, responsável, status
- Indicadores visuais: plataforma, data, prioridade

### Calendar View
- Visualização mensal/semanal
- Cards posicionados por `scheduled_at`
- Drag para reagendar
- Indicadores de publicação (sucesso/falha)

---

## 📝 Card de Planejamento

### Campos do Planning Item

```typescript
{
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  description: string;          // Conteúdo principal (markdown)
  platform: string;             // instagram, twitter, linkedin, etc.
  content_type: string;         // tweet, carousel, newsletter, etc.
  column_id: string;            // Referência à coluna do kanban
  status: string;               // draft, scheduled, published, failed
  priority: string;             // low, medium, high
  scheduled_at: timestamp;      // Data/hora de publicação
  assigned_to: uuid;            // Responsável
  created_by: uuid;
  media_urls: json;             // URLs de mídias anexadas
  metadata: json;               // Dados extras (thread_items, etc.)
  late_post_id: string;         // ID do post na Late API
  publication_status: string;   // pending, published, failed
  publication_error: string;
}
```

### Dialog de Edição

O `PlanningItemDialog` permite:
- Editar título e conteúdo (rich text com menções)
- Selecionar plataforma e tipo de conteúdo
- Definir data/hora de agendamento
- Atribuir responsável
- Upload de mídias (imagens, vídeos)
- Gerar imagem com IA (`ImageGenerationModal`)
- Visualizar preview do conteúdo
- Comentários e discussão
- Publicar diretamente via Late API

---

## 🔄 Conteúdo Recorrente

### Configuração
Via `RecurrenceConfig` component:
- **Tipo**: Diário, Semanal, Quinzenal, Mensal
- **Dias**: Seleção de dias da semana
- **Horário**: Hora de criação do card
- **Data fim**: Quando parar de recorrer
- **Gerar com IA**: Flag para geração automática

### Processamento
Edge function `process-recurring-content`:
1. Roda via cron job
2. Busca templates ativos que devem ser criados hoje
3. Se `generate_with_ai = true` → chama `unified-content-api`
4. Cria `planning_item` na coluna de destino
5. Registra execução

---

## 📤 Publicação

### Via Late API
O `late-post` Edge Function:
1. Busca credenciais sociais do cliente (`client_social_credentials`)
2. Envia para Late API (getlate.dev)
3. Suporta: Twitter, LinkedIn, Instagram, TikTok, YouTube, Facebook, Threads
4. Suporta publicação imediata ou agendada
5. Suporta threads nativas (Twitter, LinkedIn)
6. Atualiza `publication_status` no planning_item

### Plataformas Suportadas
- Instagram (post, carousel, reels, stories)
- Twitter/X (tweet, thread)
- LinkedIn (post, artigo)
- TikTok (vídeo)
- YouTube (vídeo)
- Threads (post)

---

## 🔔 Notificações

- **Lembrete de publicação**: Cron `send-publish-reminders` → notifica 1 dia antes
- **Due date**: `process-due-date-notifications` → notifica cards vencidos
- Push + Email + In-app

---

## 🤖 Integração com kAI Chat

O kAI Chat pode criar cards diretamente:
- "Crie 5 posts para Instagram sobre IA"
- "Agende um tweet para amanhã"
- "Distribua 3 newsletters ao longo da semana"

Veja [KAI_CHAT.md](./KAI_CHAT.md) para detalhes da detecção de planning intent.

---

*Última atualização: Março 2025*
