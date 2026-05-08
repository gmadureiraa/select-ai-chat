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
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "@radix-ui/react-accordion",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
          ],
          "data-vendor": ["@tanstack/react-query", "@supabase/supabase-js"],
          "auth-vendor": ["@neondatabase/auth", "@neondatabase/auth-ui"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "chart-vendor": ["recharts"],
          // Bibliotecas pesadas usadas só em features específicas (export PDF/imagem,
          // upload XLSX, animações). Ficam em chunks próprios pra não inflar o initial.
          "export-vendor": ["jspdf", "jszip", "html-to-image", "xlsx"],
          "motion-vendor": ["framer-motion"],
          "flow-vendor": ["reactflow"],
          "dnd-vendor": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "icons-vendor": ["lucide-react"],
        },
      },
    },
  },
}));
