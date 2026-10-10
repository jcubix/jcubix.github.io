import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { createHash } from "node:crypto";

const staticFiles = [
  "config.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "vendor/jspdf.umd.min.js",
];
function appAssets(): Plugin {
  return {
    name: "eburum-static-assets",
    generateBundle(_options, bundle) {
      for (const fileName of staticFiles)
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(new URL(fileName, import.meta.url)),
        });
      const assets = [
        "./",
        ...Object.keys(bundle)
          .filter((name) => !name.endsWith(".map"))
          .map((name) => "./" + name),
        ...staticFiles.map((name) => "./" + name),
      ];
      const id = createHash("sha256")
        .update(assets.join("|"))
        .digest("hex")
        .slice(0, 12);
      const template = readFileSync(
        new URL("src/sw-template.js", import.meta.url),
        "utf8",
      );
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replace("__CACHE_ID__", id)
          .replace(
            "__PRECACHE_ASSETS__",
            JSON.stringify([...new Set([...assets, "./index.html"])]),
          ),
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), tailwindcss(), appAssets()],
  publicDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    sourcemap: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@supabase/")) return "supabase-vendor";
          if (
            /\/node_modules\/(react|react-dom|react-router|scheduler)\//.test(
              id,
            )
          )
            return "react-vendor";
        },
      },
    },
  },
});
