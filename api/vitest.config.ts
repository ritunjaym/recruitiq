import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "**/.claude/**", "**/worktrees/**"],
    server: {
      deps: {
        external: [
          /node_modules\/@anthropic-ai/,
          /node_modules\/@langchain\/anthropic/,
          /node_modules\/@langchain\/community/,
          /node_modules\/langchain/,
        ],
      },
    },
  },
});
