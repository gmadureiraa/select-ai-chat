// DEPRECATED 2026-05-18 rev3 — Metricool removido. Re-exporta o hook real do
// Late/Zernio Inbox pra qualquer import legado continuar funcionando enquanto
// componentes ainda não foram atualizados. Novos componentes devem importar
// direto de `@/hooks/useLateInbox`.

export { useInboxUnreadCount } from './useLateInbox';
