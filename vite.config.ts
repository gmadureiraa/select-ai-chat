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
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
}));
