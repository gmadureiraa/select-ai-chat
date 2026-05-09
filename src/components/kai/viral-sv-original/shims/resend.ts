/**
 * Stub de `resend`. Server-only.
 *
 * Tipos com shape mínima esperada pelo SDK real (`{ data: { id }, error }`)
 * pra que call-sites como `result.data?.id` continuem checando bem mesmo
 * com o shim no-op que sempre devolve `data: null`.
 */
type ResendResult<T> = { data: T | null; error: { message: string } | null };
type EmailSendData = { id: string };
type ContactData = { id: string };
type ListData<T> = { data: T[] };

export class Resend {
  constructor(..._args: unknown[]) {}
  emails = {
    send: async (..._args: unknown[]): Promise<ResendResult<EmailSendData>> => ({
      data: null,
      error: null,
    }),
  };
  contacts = {
    create: async (..._args: unknown[]): Promise<ResendResult<ContactData>> => ({
      data: null,
      error: null,
    }),
    list: async (..._args: unknown[]): Promise<ResendResult<ListData<ContactData>>> => ({
      data: { data: [] },
      error: null,
    }),
    update: async (..._args: unknown[]): Promise<ResendResult<ContactData>> => ({
      data: null,
      error: null,
    }),
    remove: async (..._args: unknown[]): Promise<ResendResult<ContactData>> => ({
      data: null,
      error: null,
    }),
  };
  audiences = {
    list: async (..._args: unknown[]): Promise<ResendResult<ListData<{ id: string }>>> => ({
      data: { data: [] },
      error: null,
    }),
  };
}
export default Resend;
