# 📅 Planejamento — Kanban & Calendário
> Última atualização: 09 de Março de 2026

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
- Indicadores visuais: plataforma(s), data, prioridade
- **Multi-plataforma**: cards exibem até 3 ícones Lucide de plataformas + "+N" no footer

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
  platform: string;             // Plataforma principal (legacy, usado como fallback)
  content_type: string;         // tweet, carousel, newsletter, etc.
  column_id: string;            // Referência à coluna do kanban
  status: string;               // draft, scheduled, published, failed
  priority: string;             // low, medium, high
  scheduled_at: timestamp;      // Data/hora de publicação
  assigned_to: uuid;            // Responsável
  created_by: uuid;
  media_urls: json;             // URLs de mídias anexadas
  metadata: json;               // Dados extras (ver abaixo)
  late_post_id: string;         // ID do post na Late API (legacy, single-platform)
  publication_status: string;   // pending, published, failed
  publication_error: string;
}
```

### Campos de Metadata (Multi-plataforma)

```typescript
metadata: {
  // Seleção de plataformas
  target_platforms: string[];        // ["twitter", "linkedin", "instagram"]

  // Tracking de publicação multi-plataforma
  published_platforms: string[];     // ["twitter", "linkedin"] — quais já foram publicadas
  late_post_ids: Record<string, string>;   // { twitter: "abc123", linkedin: "def456" }
  published_urls: Record<string, string>;  // { twitter: "https://x.com/...", linkedin: "https://..." }

  // Controle de biblioteca
  added_to_library: boolean;         // true após salvar na content_library (evita duplicatas)

  // Conteúdo estruturado
  thread_tweets: ThreadItem[];       // Para threads Twitter/LinkedIn
  carousel_slides: SlideItem[];      // Para carrosséis Instagram
}
```

### Dialog de Edição

O `PlanningItemDialog` permite:
- Editar título e conteúdo (rich text com menções)
- **Selecionar múltiplas plataformas** via chips interativos com ícones Lucide e cores branded (sky para Twitter, pink para Instagram, blue para LinkedIn, etc.)
- Indicador de status de conexão por plataforma (dot verde = conectada)
- Resumo "X de Y conectadas" para feedback rápido
- Definir data/hora de agendamento
- Atribuir responsável
- Upload de mídias (imagens, vídeos)
- Gerar imagem com IA (`ImageGenerationModal`)
- Visualizar preview do conteúdo
- Comentários e discussão
- **Publicar em múltiplas plataformas** com mini-ícones no botão de publicação

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

### Via Late API (Multi-plataforma)

O sistema suporta publicação simultânea em múltiplas plataformas:

1. O usuário seleciona `target_platforms` no dialog (ex: Twitter + LinkedIn)
2. Ao publicar, o sistema itera sequencialmente por cada plataforma:
   - Chama `late-post` para cada plataforma individualmente
   - Registra `late_post_id` e `published_url` no metadata por plataforma
   - Adiciona a plataforma ao array `published_platforms`
3. O conteúdo é salvo na `client_content_library` apenas uma vez (`added_to_library` flag)
4. Se todas as plataformas publicarem com sucesso, o card move para coluna "Publicado"

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

*Última atualização: Março 2026*
