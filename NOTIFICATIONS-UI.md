# NOTIFICATIONS-UI

UI completa para o sistema de notificações do KAI 2.0 (push web + email + center).

## Visão geral

O backend de notificações já estava 100% funcional (`api/_handlers/{send-push-notification,process-push-queue,get-vapid-public-key}.ts` + tabelas `push_subscriptions`, `notification_preferences`, `notifications`, `push_notification_queue`). Esta entrega adiciona / consolida toda a UI necessária para o usuário:

1. Ativar push notifications no browser (com listagem de devices e remoção individual).
2. Configurar preferences granulares (email + tipos de notificação por evento).
3. Ver as últimas notificações pelo bell icon (NotificationCenter, com badge unread + mark as read).
4. Receber um permission prompt elegante após login (não popup chato).

Boa parte dos building blocks já existia. As alterações principais foram:

- Hook novo: listagem multi-device + remoção (`usePushSubscriptions`).
- Componente novo: `PushSubscriptionCard` com status, ativar/desativar e tabela de devices.
- Refator: `NotificationSettings` agora monta dois cards distintos (Push + Preferences) em vez de um único bloco.
- Refator: `NotificationPermissionPrompt` agora respeita `preferences.push_enabled`, usa o subscribe completo (`useWebPushSubscription`) — antes só pedia `Notification.requestPermission()` e não criava a subscription no DB.

## Arquivos criados

- `src/hooks/usePushSubscriptions.ts` — TanStack Query para listar todos os devices/browsers do usuário (`push_subscriptions` table) + mutation `removeSubscription` que faz unsubscribe local (se for o device atual) e delete no DB. Inclui helper `getDeviceLabel(deviceInfo)` que parseia user agent em algo amigável tipo "Chrome em macOS".
- `src/components/notifications/PushSubscriptionCard.tsx` — Card com (a) estado atual da subscription neste device + botão Ativar/Desativar usando `useWebPushSubscription` e (b) lista de todos devices ativos com botão remover. Mostra badge "Este dispositivo" quando o user agent bate com o navegador atual.

## Arquivos modificados

- `src/components/settings/NotificationSettings.tsx`
  - Importa o `PushSubscriptionCard` e renderiza-o acima do card existente.
  - Card existente renomeado de "Notificações" para "Preferências" (escopo reduzido pra email + tipos de notificação).
  - Wrapper agora é `<div className="space-y-4">` em vez de um único `<Card>`.
- `src/components/notifications/NotificationPermissionPrompt.tsx`
  - Trocou `usePushNotifications` por `useWebPushSubscription` para fazer o subscribe completo (permission + service worker + registro no DB).
  - Lê `useNotificationPreferences().preferences.push_enabled` e não mostra o prompt se o user já desabilitou push globalmente.
  - Só aparece se `permission === 'default'` (não bloqueado, não concedido) E `!isSubscribed` E `push_enabled !== false` E não foi descartado antes (localStorage).
  - Toast de confirmação após o subscribe via `useToast`.

## Hooks reutilizados (não mexi)

- `useWebPushSubscription` (`src/hooks/useWebPushSubscription.ts`) — subscribe/unsubscribe completo (VAPID + service worker + DB).
- `usePushNotifications` (`src/hooks/usePushNotifications.ts`) — Permission API + showNotification fallback.
- `useNotifications` (`src/hooks/useNotifications.ts`) — fetch + polling 30s + markAsRead/markAllAsRead. Já pluga em PushNotifications pra exibir nativa em background.
- `useNotificationPreferences` (`src/hooks/useNotificationPreferences.ts`) — preferências granulares em `profiles.notification_preferences` (JSONB).

## Pluga onde

- `NotificationBell` já estava em `src/components/kai/KaiSidebar.tsx:552` (variant sidebar) e `src/components/kai/MobileHeader.tsx:61` (variant default). Não precisou tocar.
- `NotificationPermissionPrompt` já estava em `src/pages/Kai.tsx:497` (renderiza após login na rota autenticada). Não precisou mover. Como `App.tsx` só tem rotas públicas + WorkspaceRouter, o lugar certo do prompt é mesmo dentro de Kai.tsx (após login + workspace carregado).
- `NotificationSettings` já estava em `src/components/settings/SettingsTab.tsx` na seção `notifications`. Continua igual.

## Como testar

1. `bun run dev`, logar.
2. Em ~5s (desktop) ou ~8s (mobile), o NotificationPermissionPrompt aparece no canto inferior direito (ou bottom sheet em mobile). Clicar Ativar agora → solicita permissão + cria subscription no DB. Clicar Agora não → marca dismissed em localStorage.
3. Configurações → aba Notificações:
   - Card "Push notifications": Ativar / Desativar e lista de devices com remover.
   - Card "Preferências": email toggle + 4 toggles granulares (atribuição, prazos, publicação, menções).
4. Bell icon na sidebar ou no MobileHeader: badge unread, popover/sheet com notificações, mark all as read.

## Build status

- `bun run build` → OK (6.84s, sem warnings novos).
- `bunx tsc --noEmit` → OK (sem erros TypeScript).
- Não commitei (regra do briefing).

## Bloqueios

Nenhum. Todo o backend já existia, todos os hooks já existiam. Só faltava o card multi-device de push subscription e refinar o prompt para usar o subscribe completo.
