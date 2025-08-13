import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readdirSync, copyFileSync, mkdirSync } from "node:fs";

// Simple plugin to copy manifest.json to dist
function copyManifest() {
  return {
    name: "copy-manifest",
    writeBundle() {
      mkdirSync("dist", { recursive: true });
      copyFileSync("manifest.json", "dist/manifest.json");
    }
  };
}

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  plugins: [copyManifest()],
  base: ""
});
