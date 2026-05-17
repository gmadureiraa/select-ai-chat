/**
 * Stub de notificação Telegram pra planning items.
 *
 * O handler real do Telegram (`api/_handlers/telegram-notify.ts`) não tem
 * função dedicada pra "review de planning item" — havia uma `telegram-planning`
 * planejada que nunca foi portada do Supabase. createContent.ts ainda chama
 * `notifyPlanningItemTelegram` em fire-and-forget com .catch silencioso, então
 * o stub mantém a interface sem quebrar.
 *
 * Pra ativar de verdade no futuro: integrar com `sendTelegramMessage()` de
 * `telegram-notify.ts` montando um payload review do planning item.
 */

export interface NotifyPlanningOpts {
  mode: 'review' | 'approved' | 'published' | 'failed';
  reason?: string;
  postedUrl?: string;
}

export async function notifyPlanningItemTelegram(
  _planningItemId: string,
  _opts: NotifyPlanningOpts,
): Promise<void> {
  // no-op intencional. Console em dev pra deixar pista do TODO.
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[telegram-planning] (stub) skipped notify for item=${_planningItemId} mode=${_opts.mode}`,
    );
  }
}
