import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

/**
 * Identifies this build. Vercel exposes the commit it is building; locally we
 * ask git; failing both (a tarball, a shallow CI checkout) we fall back to a
 * timestamp, which is still unique per build and that is all this needs to be.
 */
function resolveBuildId(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return `t${Date.now()}`;
  }
}

/**
 * Writes the build id to dist/version.json so a running client can ask the
 * server which build is live. It cannot be a file in public/ — those are copied
 * verbatim and cannot carry a per-build value.
 */
function emitVersionFile(buildId: string): Plugin {
  return {
    name: "endz-build-id",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Resolved once and shared by both consumers below. Two separate
  // computations would drift and report a permanent phantom update.
  const buildId = resolveBuildId();

  return {
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
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      emitVersionFile(buildId),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "node",
      // supabase/functions is included because plan-guest runs on the SERVICE
      // ROLE and therefore enforces its own authorization in code — RLS does not
      // apply to it. That logic needs tests like any other; it shipped without
      // them and a self-approval bypass survived until the 2026-08-09 review.
      // scripts/ is included because the launch-screen art is GENERATED: the
      // startup PNGs and the inline splash in index.html are two renderings of
      // one source, and if they disagree the mark jumps at the moment iOS hands
      // the screen over. That is a correctness property, so it gets tests.
      include: [
        "src/**/*.test.ts",
        "supabase/functions/**/*.test.ts",
        "scripts/**/*.test.mjs",
      ],
    },
  };
});
