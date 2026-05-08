/**
 * Stub de `resend`. Server-only.
 */
export class Resend {
  constructor(_: string) {}
  emails = {
    send: async () => ({ data: null, error: null }),
  };
  contacts = {
    create: async () => ({ data: null, error: null }),
    list: async () => ({ data: { data: [] }, error: null }),
    update: async () => ({ data: null, error: null }),
    remove: async () => ({ data: null, error: null }),
  };
  audiences = {
    list: async () => ({ data: { data: [] }, error: null }),
  };
}
export default Resend;
