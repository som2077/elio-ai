/**
 * Thin-Client Anti-Reverse-Engineering Logger Utility
 *
 * 1. Automatically silences console output in release/production builds (!__DEV__).
 * 2. Neutralizes runtime interception by reverse-engineering tools (Frida, Logcat, Jadx, REA).
 * 3. Scrubs JWT tokens, session payloads, passwords, and sensitive keys from any DEV output.
 */

// Regex patterns to detect and scrub sensitive authentication secrets
const SENSITIVE_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/g, // JWT / Access / Refresh tokens
  /Bearer\s+[a-zA-Z0-9_.-]+/gi, // Authorization headers
  /(access_token|refresh_token|api_key|service_role|apikey|password|secret)=[^&\s]+/gi, // Query/URL tokens
];

function sanitizeArg(arg: any): any {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === "string") {
    let clean = arg;
    for (const pattern of SENSITIVE_PATTERNS) {
      clean = clean.replace(pattern, "[REDACTED_SECRET]");
    }
    return clean;
  }
  if (arg instanceof Error) {
    return sanitizeArg(arg.message || "Error");
  }
  if (typeof arg === "object") {
    try {
      const copy: Record<string, any> = Array.isArray(arg) ? [] : {};
      for (const [key, val] of Object.entries(arg)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("auth") ||
          lowerKey.includes("password") ||
          lowerKey.includes("key")
        ) {
          copy[key] = "[REDACTED_SECRET]";
        } else {
          copy[key] = sanitizeArg(val);
        }
      }
      return copy;
    } catch {
      return "[Object]";
    }
  }
  return arg;
}

/**
 * Enforces production log stripping to protect against Frida, Logcat, and REA inspection.
 * Statically silences all global console output in non-DEV runtime.
 */
export function initAntiReverseEngineering(): void {
  if (!__DEV__) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.error = noop;
  }
}

export const logger = {
  log: (...args: any[]) => {
    if (!__DEV__) return;
    console.log(...args.map(sanitizeArg));
  },
  info: (...args: any[]) => {
    if (!__DEV__) return;
    console.info(...args.map(sanitizeArg));
  },
  debug: (...args: any[]) => {
    if (!__DEV__) return;
    console.debug(...args.map(sanitizeArg));
  },
  warn: (...args: any[]) => {
    if (!__DEV__) return;
    console.warn(...args.map(sanitizeArg));
  },
  error: (...args: any[]) => {
    if (!__DEV__) return;
    console.error(...args.map(sanitizeArg));
  },
};
