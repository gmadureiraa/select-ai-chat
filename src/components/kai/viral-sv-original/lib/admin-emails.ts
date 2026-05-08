/**
 * Lista de emails com acesso ao painel admin — usada CLIENT-SIDE apenas
 * como UX gate (mostrar/esconder nav item, redirect em rotas /app/admin/*).
 *
 * Source of truth de auth é `lib/server/auth.ts::requireAdmin` (server-side).
 * Mantemos a lista aqui só pra evitar duplicação das 5+ cópias que existiam
 * hardcoded em client pages.
 */
export const ADMIN_EMAILS = [
  "gf.madureiraa@gmail.com",
  "gf.madureira@hotmail.com",
];

/** True se email normalizado bate na lista. Safe pra undefined/null. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
