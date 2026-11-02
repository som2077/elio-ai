import { build } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const entries = [
  {
    name: "youtube",
    input: resolve(__dirname, "src/content/youtube.ts"),
    out: "content/youtube.js",
  },
  {
    name: "instagram",
    input: resolve(__dirname, "src/content/instagram.ts"),
    out: "content/instagram.js",
  },
  {
    name: "twitter",
    input: resolve(__dirname, "src/content/twitter.ts"),
    out: "content/twitter.js",
  },
  {
    name: "facebook",
    input: resolve(__dirname, "src/content/facebook.ts"),
    out: "content/facebook.js",
  },
  {
    name: "reddit",
    input: resolve(__dirname, "src/content/reddit.ts"),
    out: "content/reddit.js",
  },
  {
    name: "linkedin",
    input: resolve(__dirname, "src/content/linkedin.ts"),
    out: "content/linkedin.js",
  },
  {
    name: "pinterest",
    input: resolve(__dirname, "src/content/pinterest.ts"),
    out: "content/pinterest.js",
  },
  {
    name: "tiktok",
    input: resolve(__dirname, "src/content/tiktok.ts"),
    out: "content/tiktok.js",
  },
  {
    name: "service_worker",
    input: resolve(__dirname, "src/background/service_worker.ts"),
    out: "background/service_worker.js",
  },
  {
    name: "popup",
    input: resolve(__dirname, "src/popup/popup.ts"),
    out: "src/popup/popup.js",
  },
];

async function run() {
  for (const entry of entries) {
    await build({
      configFile: false,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: entry.input,
          name: entry.name,
          formats: ["iife"],
          fileName: () => entry.out,
        },
        rollupOptions: {
          output: {
            extend: true,
          },
        },
      },
    });
  }
}

run();
