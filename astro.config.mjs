import process from "node:process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { isProductionLaunchGateActive } from "./scripts/launch-gate.js";

const launchGate = {
  name: "production-launch-gate",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      if (!isProductionLaunchGateActive()) return;

      const outputDirectory = fileURLToPath(dir);
      for (const route of ["design-system", "fr/design-system", "rw/design-system"]) {
        await rm(resolve(outputDirectory, route), { recursive: true, force: true });
      }
      logger.info("Excluded design-system routes from the production build.");
    },
  },
};

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL,
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "rw"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [launchGate],
});
