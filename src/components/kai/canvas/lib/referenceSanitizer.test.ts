import { describe, expect, it } from "vitest";
import { clampText, sanitizeReferenceText } from "./referenceSanitizer";

describe("referenceSanitizer", () => {
  it("sanitizeReferenceText removes markdown images and image URLs", () => {
    const input =
      "Intro\n\n![img](https://example.com/a.png)\n\nhttps://cdn.site.com/x.jpg\n\nTexto final";
    const out = sanitizeReferenceText(input);
    expect(out).toContain("Intro");
    expect(out).toContain("Texto final");
    expect(out).not.toContain("example.com/a.png");
    expect(out).not.toContain("cdn.site.com/x.jpg");
  });

  it("sanitizeReferenceText collapses URLs to domain hints", () => {
    const input = "Leia: https://www.beehiiv.com/post/abc e https://sub.domain.com/x";
    const out = sanitizeReferenceText(input);
    expect(out).toContain("beehiiv.com");
    expect(out).toContain("sub.domain.com");
  });

  it("clampText truncates long content", () => {
    const input = "a".repeat(200);
    const out = clampText(input, 50);
    expect(out).toContain("...conteúdo truncado");
  });
});

