import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against the local Supabase stack (npm run db:start).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.int.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
