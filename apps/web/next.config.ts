import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { NextConfig } from "next";

/* Load the monorepo root .env so keys like MAPBOX_ACCESS_TOKEN are available
   during config evaluation. Next.js only reads .env from its own project root,
   which is apps/web — not the monorepo root where the real .env lives. */
function loadRootEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      const lines = readFileSync(candidate, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      process.env.MAPBOX_ACCESS_TOKEN ||
      "",
  },
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["@eleos/config", "@eleos/db", "@eleos/shared", "@eleos/ui"],
};

export default nextConfig;
