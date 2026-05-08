/**
 * Stub de `@google/genai`. Server-only — usado em `lib/instagram-extractor.ts`
 * que não é importado pelo client. Stub previne erro de build.
 */
export class GoogleGenAI {
  constructor(..._args: unknown[]) {}
  models = {
    generateContent: async (..._args: unknown[]) => ({ text: "" }),
  };
}
export default GoogleGenAI;
