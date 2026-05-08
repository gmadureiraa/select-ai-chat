/**
 * Stub de `@react-email/components`. Email templates são server-only,
 * usados só em `api/_handlers/`. No client, esses imports nunca são
 * exercitados — stub previne build error.
 */
import type { ReactNode } from "react";

type WrapperProps = {
  children?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  [k: string]: unknown;
};

const make = (tag: keyof JSX.IntrinsicElements) =>
  function Stub(props: WrapperProps) {
    const Tag = tag as unknown as React.ElementType;
    return <Tag {...props} />;
  };

export const Html = make("html");
export const Head = make("head");
export const Body = make("body");
export const Container = make("div");
export const Section = make("section");
export const Row = make("div");
export const Column = make("div");
export const Text = make("p");
export const Heading = make("h1");
export const Hr = make("hr");
export const Img = make("img");
export const Link = make("a");
export const Button = make("a");
export const Preview = make("span");
export const Tailwind = make("div");
export const Font = make("span");
export const CodeBlock = make("pre");
export const CodeInline = make("code");
