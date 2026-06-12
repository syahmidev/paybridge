import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// The API source uses NodeNext ".js" specifiers that point at ".ts" files.
// Vite doesn't rewrite those by default, so do it here for relative imports.
function resolveJsToTs(): Plugin {
  return {
    name: "resolve-js-to-ts",
    enforce: "pre",
    async resolveId(source, importer) {
      if (importer && source.startsWith(".") && source.endsWith(".js")) {
        const resolved = await this.resolve(
          `${source.slice(0, -3)}.ts`,
          importer,
          { skipSelf: true },
        );
        if (resolved) return resolved;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Tests share one database; keep them serial and deterministic.
    fileParallelism: false,
    hookTimeout: 30_000,
    // Transform the workspace packages (they ship TS source, not built JS).
    server: { deps: { inline: [/@paybridge\//] } },
  },
});
