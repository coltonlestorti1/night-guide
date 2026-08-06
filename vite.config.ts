import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // CLAUDE.md mandates working in git worktrees under .claude/worktrees/.
      // A worktree's node_modules resolves to the parent checkout, which is
      // outside the Vite root, so webfonts 403 and the app silently renders in
      // fallback typefaces. Allowing the repo root fixes dev only.
      allow: [".", "../../.."],
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
