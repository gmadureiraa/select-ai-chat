/**
 * Stub de `@google/genai`. Server-only — usado em `lib/instagram-extractor.ts`
 * que não é importado pelo client. Stub previne erro de build.
 */
export class GoogleGenAI {
  constructor(_: unknown) {}
  models = {
    generateContent: async () => ({ text: "" }),
  };
}
export default GoogleGenAI;
