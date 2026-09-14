import { defineConfig } from "vitest/config";

export default defineConfig({
  css: {
    postcss: false,
  },
  server: {
    fs: {
      strict: true,
      allow: ["."],
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
