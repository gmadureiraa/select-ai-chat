/**
 * Stub de `resend`. Server-only.
 */
export class Resend {
  constructor(..._args: unknown[]) {}
  emails = {
    send: async (..._args: unknown[]) => ({ data: null, error: null }),
  };
  contacts = {
    create: async (..._args: unknown[]) => ({ data: null, error: null }),
    list: async (..._args: unknown[]) => ({ data: { data: [] }, error: null }),
    update: async (..._args: unknown[]) => ({ data: null, error: null }),
    remove: async (..._args: unknown[]) => ({ data: null, error: null }),
  };
  audiences = {
    list: async (..._args: unknown[]) => ({ data: { data: [] }, error: null }),
  };
}
export default Resend;
