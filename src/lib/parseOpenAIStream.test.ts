import { describe, expect, it } from "vitest";
import { parseOpenAIStream } from "./parseOpenAIStream";

function makeReader(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    async read() {
      if (i >= chunks.length) return { done: true, value: undefined as any };
      const value = encoder.encode(chunks[i++]);
      return { done: false, value };
    },
  } as ReadableStreamDefaultReader<Uint8Array>;
}

describe("parseOpenAIStream", () => {
  it("extracts delta.content across multiple SSE chunks", async () => {
    const reader = makeReader([
      'data: {"choices":[{"delta":{"content":"Olá"}}]}\n',
      'data: {"choices":[{"delta":{"content":" mundo"}}]}\n',
      "data: [DONE]\n",
    ]);

    const out = await parseOpenAIStream(reader);
    expect(out).toBe("Olá mundo");
  });
});

