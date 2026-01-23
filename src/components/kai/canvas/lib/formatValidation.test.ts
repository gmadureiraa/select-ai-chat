import { describe, expect, it } from "vitest";
import { extractTopicKeywords, validateContent } from "./formatValidation";

describe("formatValidation", () => {
  it("extractTopicKeywords should include eth/ethereum and 100k variants", () => {
    const keywords = extractTopicKeywords("ETH em 100k");
    expect(keywords).toContain("eth");
    expect(keywords).toContain("ethereum");
    expect(keywords).toContain("100k");
  });

  it("validateContent should error when topic missing", () => {
    const issues = validateContent({
      format: "carousel",
      platform: "instagram",
      content: "Slide 1:\nWeb3 assusta?\n\n---\n\nSlide 2:\nO que é Web3?",
      topic: "ETH em 100k",
    });
    expect(issues.some((i) => i.code === "topic_missing" && i.severity === "error")).toBe(true);
  });

  it("validateContent should pass topic when mentioned", () => {
    const issues = validateContent({
      format: "carousel",
      platform: "instagram",
      content: "Slide 1:\nETH pode chegar em 100k?\n\n---\n\nSlide 2:\nEthereum: tese e riscos.",
      topic: "ETH em 100k",
    });
    expect(issues.some((i) => i.code === "topic_missing")).toBe(false);
  });
});

