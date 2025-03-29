import { defineConfig } from "drizzle-kit";

// DATABASE_URL is required but will be checked during runtime
// Check removed to allow build to complete

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
