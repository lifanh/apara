import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "http://localhost:3000", ws: true },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
