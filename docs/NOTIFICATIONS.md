# 🔔 Sistema de Notificações
> Última atualização: 09 de Março de 2026

## Visão Geral

O sistema de notificações opera em 3 camadas: **In-App** (realtime via Supabase), **Push** (Web Push API + Service Worker) e **Email** (fila assíncrona). Cada notificação é gerada por triggers de banco de dados e processada por edge functions em ciclos de 2 minutos.

---

## 📊 Arquitetura

```
Evento (trigger/cron)
  │
  ├── INSERT INTO notifications
  │     │
  │     ├── Trigger: enqueue_notification_email()
  │     │   └── INSERT INTO email_notification_queue
  │     │       └── process-email-notifications (cron 2min)
  │     │
  │     └── Trigger: trigger_push_notification()
  │         └── INSERT INTO push_notification_queue
  │             └── process-push-queue (cron 2min)
  │
  └── Frontend (Realtime)
      └── useNotifications() → Supabase channel
          └── NotificationBell.tsx (badge + drawer/popover)
```

---

## 📦 Tabelas

### `notifications`
```sql
{
  id, user_id, workspace_id,
  type: text,           -- assignment, due_date, mention, publish_reminder,
                        --   publish_failed, publish_success, automation_completed
  title: text,
  message: text,
  entity_type: text,    -- planning_item, automation, client
  entity_id: uuid,      -- ID da entidade relacionada
  read: boolean,
  read_at: timestamp,
  metadata: jsonb,      -- { scheduled_at, client_id, platform, ... }
  created_at
}
```

### `push_notification_queue`
```sql
{
  id, user_id,
  payload: jsonb,       -- { title, body, icon, badge, tag, data }
  processed: boolean,
  processed_at: timestamp,
  created_at
}
```

### `push_subscriptions`
```sql
{
  id, user_id, workspace_id,
  endpoint: text,       -- URL do push service
  p256dh: text,         -- Chave pública ECDH
  auth: text,           -- Token de autenticação
  device_info: jsonb,   -- { userAgent, platform }
  created_at, updated_at
}
```

### `email_notification_queue`
```sql
{
  id, user_id, notification_id,
  email: text,
  sent_at: timestamp,
  error: text,
  created_at
}
```

---

## 🔔 Tipos de Notificação

| Tipo | Ícone | Descrição | Gerado por |
|------|-------|-----------|------------|
| `assignment` | 👤 | Card atribuído a você | Kanban/Planning |
| `due_date` | 📅 | Prazo se aproximando | `create_due_date_notifications()` cron |
| `mention` | 💬 | Mencionado em comentário | Chat/Comments |
| `publish_reminder` | ⏰ | Publicação agendada amanhã | `create_publish_reminders()` cron |
| `publish_failed` | ❌ | Falha na publicação | `process-scheduled-posts` |
| `publish_success` | ✅ | Publicado com sucesso | `process-scheduled-posts` |
| `automation_completed` | ⚡ | Automação executada | `process-automations` |

---

## 🌐 In-App Notifications

### Hook `useNotifications()`
```typescript
const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
```

- Busca últimas 50 notificações do workspace
- Subscribe Realtime para `INSERT` na tabela `notifications`
- Exibe push nativo se tab está em background (`showNotificationIfHidden`)
- Badge com contagem de não-lidas no `NotificationBell`

### Componente `NotificationBell`
- **Desktop**: Popover com lista de notificações
- **Mobile**: Sheet lateral (bottom sheet)
- Ícones por tipo (Zap amarelo para automações, etc.)
- Click navega para a entidade (planning item, etc.)
- "Marcar todas como lidas"

---

## 📱 Push Notifications (PWA)

### Setup
1. Service Worker registrado em `/sw.js`
2. VAPID keys configuradas via `get-vapid-public-key`
3. Usuário aceita permissão → `push_subscriptions` criada

### Hook `usePushNotifications()`
```typescript
const { permission, subscribe, showNotificationIfHidden } = usePushNotifications();
```

### Edge Functions
| Função | Descrição |
|--------|-----------|
| `get-vapid-public-key` | Retorna chave pública VAPID |
| `send-push-notification` | Envia push para um subscription |
| `process-push-queue` | Processa fila de push (cron 2min) |

### Fluxo
```
push_notification_queue (INSERT trigger)
  → process-push-queue (cron)
  → Para cada item não processado:
     ├── Busca push_subscriptions do user_id
     ├── Envia via Web Push Protocol (VAPID)
     ├── Marca como processed
     └── Remove subscriptions inválidas (410 Gone)
```

---

## 📧 Email Notifications

### Trigger `enqueue_notification_email()`
1. Verifica `profiles.notification_preferences.email_notifications`
2. Se habilitado → insere em `email_notification_queue`

### Edge Function `process-email-notifications`
- Cron job a cada 2 minutos
- Processa fila de emails pendentes
- Envia via Resend/SMTP
- Marca `sent_at` ou registra `error`

---

## ⚙️ Preferências do Usuário

Armazenadas em `profiles.notification_preferences`:
```json
{
  "email_notifications": true,    // Default: true
  "push_notifications": true,     // Default: true
  "reminder_hours_before": 24     // Horas antes para lembrete
}
```

### Cron Jobs Geradores
| Função DB | Schedule | Descrição |
|-----------|----------|-----------|
| `create_publish_reminders()` | Diário | Cria lembretes para posts agendados amanhã |
| `create_due_date_notifications()` | Diário | Notifica sobre prazos próximos |

---

*Última atualização: Março 2026*
