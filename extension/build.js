import { build } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load local environment variables from extension/.env (gitignored)
const envVars = {};
const envPath = resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      envVars[key] = val;
    }
  }
}

const supabaseUrl = envVars.SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  envVars.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

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
      define: {
        __SUPABASE_URL__: JSON.stringify(supabaseUrl),
        __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
        "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
        "process.env.SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      },
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

  // Ensure popup.html is copied to dist/src/popup/
  const srcPopupHtml = resolve(__dirname, "src/popup/popup.html");
  const distPopupHtml = resolve(__dirname, "dist/src/popup/popup.html");
  if (fs.existsSync(srcPopupHtml)) {
    fs.mkdirSync(resolve(__dirname, "dist/src/popup"), { recursive: true });
    fs.copyFileSync(srcPopupHtml, distPopupHtml);
  }

  // Copy icons to dist/icons
  const srcIcons = resolve(__dirname, "icons");
  const distIcons = resolve(__dirname, "dist/icons");
  if (fs.existsSync(srcIcons)) {
    fs.mkdirSync(distIcons, { recursive: true });
    for (const iconFile of fs.readdirSync(srcIcons)) {
      fs.copyFileSync(
        resolve(srcIcons, iconFile),
        resolve(distIcons, iconFile),
      );
    }
  }

  // Also keep src/popup/popup.js synced for backward compatibility with cached manifests (gitignored)
  const distPopupJs = resolve(__dirname, "dist/src/popup/popup.js");
  const srcPopupJs = resolve(__dirname, "src/popup/popup.js");
  if (fs.existsSync(distPopupJs)) {
    fs.copyFileSync(distPopupJs, srcPopupJs);
  }

  console.log(
    "✓ Elio AI Extension built successfully with environment variables injected.",
  );
}

run();
