/**
 * Lista de admin emails. Cópia do `lib/admin-emails.ts` do standalone.
 */

const DEFAULT_ADMINS = new Set([
  "gf.madureira@hotmail.com",
  "gf.madureiraa@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEFAULT_ADMINS.has(email.toLowerCase().trim());
}
