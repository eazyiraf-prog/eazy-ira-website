import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ??
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL,
  vite: {
    plugins: [tailwindcss()],
  },
});
