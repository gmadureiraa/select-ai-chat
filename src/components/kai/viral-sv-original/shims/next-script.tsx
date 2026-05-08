/**
 * Stub de `next/script` → renderiza um `<script>` nativo.
 * Estratégias do Next (`afterInteractive`, `lazyOnload`, etc) viram no-op.
 */
import { useEffect, type ScriptHTMLAttributes } from "react";

interface NextScriptProps
  extends Omit<ScriptHTMLAttributes<HTMLScriptElement>, "children"> {
  id?: string;
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload" | "worker";
  onLoad?: () => void;
  children?: string;
}

export default function Script({
  id,
  src,
  strategy: _strategy,
  onLoad,
  children,
  ...rest
}: NextScriptProps) {
  useEffect(() => {
    if (!src) return;
    const existing = id ? document.getElementById(id) : null;
    if (existing) {
      onLoad?.();
      return;
    }
    const tag = document.createElement("script");
    if (id) tag.id = id;
    tag.src = src;
    tag.async = true;
    if (onLoad) tag.onload = () => onLoad();
    document.head.appendChild(tag);
    return () => {
      // não remove — gtag/posthog persistem ao longo da sessão
    };
  }, [id, src, onLoad]);

  if (children) {
    // inline script
    return (
      <script
        id={id}
        {...rest}
        dangerouslySetInnerHTML={{ __html: children }}
      />
    );
  }

  return null;
}
