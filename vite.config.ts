import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    // Ensures Vite pre-bundles these with a single shared React instance
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@radix-ui/react-tooltip",
    ],
  },
  resolve: {
    // Prevent invalid hook calls caused by multiple React module instances.
    // IMPORTANT: Do NOT alias React to a specific file path in dev, because it can
    // split React between Vite's optimized deps and direct node_modules imports.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      // SV alias precisa vir ANTES de @ pra não casar com o regex genérico.
      { find: "@sv", replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original") },
      // Shims pra Next 16 imports (next/link, next/image, next/navigation, next/font/google).
      // Usados pelas pages copiadas literalmente do app standalone.
      { find: /^next\/link$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next-link.tsx") },
      { find: /^next\/image$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next-image.tsx") },
      { find: /^next\/navigation$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next-navigation.ts") },
      { find: /^next\/font\/google$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next-font-google.ts") },
      { find: /^next\/script$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next-script.tsx") },
      { find: /^next$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/next.ts") },
      // Stubs pra deps server-only ou tracking que o KAI não usa.
      { find: /^posthog-js$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/posthog-js.ts") },
      { find: /^posthog-node$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/posthog-node.ts") },
      { find: /^@google\/genai$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/google-genai.ts") },
      { find: /^@react-email\/components$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/react-email-components.tsx") },
      { find: /^resend$/, replacement: path.resolve(__dirname, "./src/components/kai/viral-sv-original/shims/resend.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    // Target moderno corta polyfills core-js (jspdf/html2canvas trazem ~50kB
    // de core-js — vira inútil em browsers modernos que rodam ESM nativo).
    target: "es2020",
    // 2026-05-17 — controla modulepreload na HTML. Por default Vite preloada
    // TUDO que entry chunk pode dynamic-importar, inflando first-paint mesmo
    // com lazy() (browser baixa em parallel mesmo que código nunca rode).
    // Filter remove chunks heavy que só viram úteis em rota/feature específica:
    //   - chart-vendor (406kB recharts) — só em Performance tab + ClientAnalytics
    //   - export-pdf-vendor (617kB jspdf+html2canvas) — só em export PDF
    //   - export-zip-vendor (97kB jszip) — só em download multiplo
    //   - markdown-vendor (117kB react-markdown) — chat/library
    //   - motion-vendor (114kB framer-motion) — usado mas não no first paint
    //   - auth-vendor (315kB neon-auth) — só Login/Signup/session
    //   - supabase-vendor (170kB) — fetchs após login
    // Continua sendo carregado on-demand (Vite gera o <link modulepreload> só
    // quando o chunk-de-quem-dinamically-importa for fetched).
    modulePreload: {
      polyfill: false,
      resolveDependencies(filename, deps, { hostType }) {
        if (hostType !== 'html') return deps;
        const HEAVY_LAZY = [
          'chart-vendor',
          'export-pdf-vendor',
          'export-zip-vendor',
          'export-html-vendor',
          'markdown-vendor',
          'motion-vendor',
        ];
        return deps.filter((dep) => {
          return !HEAVY_LAZY.some((heavy) => dep.includes(heavy));
        });
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Radix dividido: o "core" Dialog/Tooltip/Popover/DropdownMenu/Tabs
          // entra no shell (sidebar, modais comuns), o restante vai pra
          // chunk separado que só baixa quando a feature pede (Toast, Slider,
          // Switch, Checkbox, Radio, Accordion, Collapsible, Select, Avatar etc).
          "ui-vendor-core": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-slot",
          ],
          "ui-vendor-extra": [
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "@radix-ui/react-accordion",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
            "@radix-ui/react-avatar",
            "@radix-ui/react-progress",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-label",
          ],
          // 2026-05-17 — supabase-js (~150kB) separado de tanstack-query (~50kB).
          // Antes "data-vendor" = 248kB. Agora ambos chunks menores podem ser
          // baixados em paralelo no http/2, e supabase-vendor não bloqueia
          // updates de @tanstack/react-query.
          "query-vendor": ["@tanstack/react-query"],
          "supabase-vendor": ["@supabase/supabase-js"],
          // 2026-05-10 — @neondatabase/auth-ui removida (órfã, 60MB no node_modules).
          // 2026-05-17 — Neon auth tem peer-deps client-only (~320kB raw). Lazy
          // automaticamente porque só useAuth e signIn/Up batem nele.
          "auth-vendor": ["@neondatabase/auth"],
          // 2026-05-10 — form-vendor removida (react-hook-form + @hookform/resolvers
          // não estão sendo usados no app — bundle audit). zod fica no chunk default.
          "chart-vendor": ["recharts"],
          // Bibliotecas pesadas usadas só em features específicas (export PDF/imagem,
          // upload XLSX, animações). Ficam em chunks próprios pra não inflar o initial.
          //
          // 2026-05-08 — `export-vendor` consolidado mediu ~960kB raw / 314kB gzip
          // (Audit B perf). Mitigação aplicada em duas frentes:
          // 1) Todos os call-sites em `src/components/posts`, `src/components/planning`,
          //    `src/components/kai/library` e `src/components/kai/viral-sv-original/lib/`
          //    agora usam `await import('html-to-image' | 'jspdf' | 'jszip' | 'xlsx')`
          //    dentro dos handlers de exportação.
          // 2) Os 4 libs ficam em CHUNKS SEPARADOS — só desce o que o user
          //    realmente usa. PNG export → só html-to-image (~200kB). PDF → só
          //    jspdf+html-to-image. ZIP → só jszip+html-to-image. CSV/XLSX upload
          //    → só xlsx. Nada de baixar 960kB de uma vez.
          "export-html-vendor": ["html-to-image"],
          // jspdf importa html2canvas internamente — sem isso, html2canvas vira
          // chunk órfão de 198KB que carrega junto com o PDF de qualquer forma.
          "export-pdf-vendor": ["jspdf", "html2canvas"],
          "export-zip-vendor": ["jszip"],
          // 2026-05-10 — xlsx removida (órfã) e reactflow removida (visual-builder
          // morto). Chunks export-xlsx-vendor + flow-vendor sem produção.
          "motion-vendor": ["framer-motion"],
          "dnd-vendor": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "icons-vendor": ["lucide-react"],
          // 2026-05-17 — markdown-vendor isola react-markdown + transitivos
          // (micromark, mdast, hast, etc — ~80-100kB raw). Antes virava parte
          // do chunk de quem importava (chat, library, planning). Agora chunk
          // único, cacheável independente, e split-friendly se algum lazy
          // boundary não precisar.
          "markdown-vendor": ["react-markdown"],
          // 2026-05-17 — date-fns chunk próprio. App importa ~10 helpers
          // diferentes + pt-BR locale; antes ficavam soltos em múltiplos chunks
          // duplicando helpers. Vendor único = dedupe automático.
          "date-vendor": ["date-fns", "date-fns/locale"],
          // 2026-05-17 — zustand é o menor (5kB) mas vendoring evita
          // re-render dele em chunks de feature.
          "state-vendor": ["zustand"],
        },
      },
    },
  },
}));
