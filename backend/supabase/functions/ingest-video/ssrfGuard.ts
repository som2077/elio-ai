// SSRF Protection & URL Sanitization Guard for Elio AI Ingestion Gateway
// Prevents Server-Side Request Forgery, rejects private/internal IPs, and strips tracking params.

export interface SSRFValidationResult {
  safe: boolean;
  error?: string;
  hostname?: string;
  cleanUrl?: string;
  platform?: string;
  platformVideoId?: string;
}

// 1. Authoritative Domain Whitelist for Supported Video Platforms
export const ALLOWED_DOMAINS = [
  // YouTube
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  // Instagram
  "instagram.com",
  "www.instagram.com",
  // TikTok
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  // Twitter / X
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  // Reddit
  "reddit.com",
  "www.reddit.com",
  "v.redd.it",
  "redd.it",
  // LinkedIn
  "linkedin.com",
  "www.linkedin.com",
  // Facebook
  "facebook.com",
  "www.facebook.com",
  "fb.watch",
  // Threads & Vimeo
  "threads.net",
  "www.threads.net",
  "vimeo.com",
  "www.vimeo.com",
];

// Tracking parameters stripped on ingestion
export const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "si",
  "igsh",
  "fbclid",
  "gclid",
  "msclkid",
  "tt_medium",
  "tt_content",
  "feature",
  "app",
  "ref",
  "ref_src",
  "s",
  "t_src",
  "source",
  "share_id",
  "_branch_match_id",
  "_bhs",
]);

/**
 * Checks whether an IP or hostname resolves to internal/private/loopback ranges.
 */
function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Localhost aliases and common dev hostnames
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower === "[::1]" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".corp") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".intranet") ||
    lower.includes("nip.io") ||
    lower.includes("sslip.io")
  ) {
    return true;
  }

  // Cloud metadata services
  if (
    lower === "169.254.169.254" ||
    lower === "metadata.google.internal" ||
    lower === "100.100.100.200" || // Alibaba Cloud metadata
    lower.includes("metadata")
  ) {
    return true;
  }

  // Check IPv4 numeric or octal/hex encodings
  const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);

    // 127.0.0.0/8 (Loopback)
    if (p1 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (p1 === 10) return true;
    // 172.16.0.0/12 (Private)
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (p1 === 192 && p2 === 168) return true;
    // 169.254.0.0/16 (Link Local / Cloud Metadata)
    if (p1 === 169 && p2 === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (p1 === 0) return true;
    // 224.0.0.0/4 (Multicast) or 240.0.0.0/4 (Reserved)
    if (p1 >= 224) return true;
  }

  // Single number decimal representations of IPs (e.g., http://2130706433 = 127.0.0.1)
  if (/^\d+$/.test(lower) || /^0x[0-9a-f]+$/i.test(lower)) {
    return true;
  }

  // IPv6 checks
  if (
    lower.startsWith("fe80:") || // Link-local
    lower.startsWith("fc00:") || // Unique local
    lower.startsWith("fd00:") ||
    lower.includes("::ffff:127.") // IPv4-mapped IPv6 loopback
  ) {
    return true;
  }

  return false;
}

/**
 * Validates that a hostname matches the domain whitelist.
 */
function isDomainWhitelisted(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const domain of ALLOWED_DOMAINS) {
    if (lower === domain || lower.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects the platform from a valid hostname.
 */
function detectPlatform(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return "youtube";
  }
  if (lower.includes("instagram.com")) {
    return "instagram";
  }
  if (lower.includes("tiktok.com")) {
    return "tiktok";
  }
  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return "twitter";
  }
  if (lower.includes("reddit.com") || lower.includes("redd.it")) {
    return "reddit";
  }
  if (lower.includes("linkedin.com")) {
    return "linkedin";
  }
  if (lower.includes("facebook.com") || lower.includes("fb.watch")) {
    return "facebook";
  }
  if (lower.includes("threads.net")) {
    return "threads";
  }
  if (lower.includes("vimeo.com")) {
    return "vimeo";
  }
  return "other";
}

/**
 * Extracts platform video ID and canonicalizes URL.
 */
function canonicalizeVideoUrl(
  parsedUrl: URL,
  platform: string,
): { cleanUrl: string; platformVideoId?: string } {
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;

  // 1. YouTube Canonicalization
  if (platform === "youtube") {
    let videoId: string | undefined;

    if (hostname.includes("youtu.be")) {
      videoId = pathname.slice(1).split("/")[0];
    } else if (pathname.includes("/shorts/")) {
      videoId = pathname.split("/shorts/")[1]?.split("/")[0];
    } else if (pathname.includes("/watch")) {
      videoId = parsedUrl.searchParams.get("v") || undefined;
    } else if (pathname.includes("/live/")) {
      videoId = pathname.split("/live/")[1]?.split("/")[0];
    }

    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      // Preserve timestamp ?t= if present
      const t = parsedUrl.searchParams.get("t");
      const cleanUrl = t
        ? `https://www.youtube.com/watch?v=${videoId}&t=${t}`
        : `https://www.youtube.com/watch?v=${videoId}`;
      return { cleanUrl, platformVideoId: videoId };
    }
  }

  // 2. Instagram Canonicalization
  if (platform === "instagram") {
    // Matches /reel/CODE/ or /p/CODE/
    const reelMatch = pathname.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/);
    if (reelMatch) {
      const type = reelMatch[1];
      const code = reelMatch[2];
      return {
        cleanUrl: `https://www.instagram.com/${type}/${code}/`,
        platformVideoId: code,
      };
    }
  }

  // 3. TikTok Canonicalization
  if (platform === "tiktok") {
    const videoMatch = pathname.match(/video\/(\d+)/);
    if (videoMatch) {
      const videoId = videoMatch[1];
      return {
        cleanUrl: `https://www.tiktok.com${pathname.split("?")[0]}`,
        platformVideoId: videoId,
      };
    }
  }

  // 4. Twitter / X Canonicalization
  if (platform === "twitter") {
    const statusMatch = pathname.match(/\/status\/(\d+)/);
    if (statusMatch) {
      const statusId = statusMatch[1];
      return {
        cleanUrl: `https://x.com${pathname.split("?")[0]}`,
        platformVideoId: statusId,
      };
    }
  }

  // General Fallback: Strip tracking query params
  const cleanParams = new URLSearchParams();
  for (const [key, value] of parsedUrl.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      cleanParams.set(key, value);
    }
  }

  const queryString = cleanParams.toString();
  const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${queryString ? `?${queryString}` : ""}`;

  return { cleanUrl };
}

/**
 * Main SSRF & Sanitization Guard Function.
 * Validates protocol, rejects private hosts, checks domain whitelist,
 * and produces a stripped canonical URL.
 */
export function validateAndSanitizeUrl(rawUrl: string): SSRFValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { safe: false, error: "Empty or invalid URL provided." };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, error: "Malformed URL syntax." };
  }

  // Protocol Check: HTTPS only (reject http, ftp, file, gopher, javascript)
  if (parsed.protocol !== "https:") {
    return {
      safe: false,
      error: "Insecure protocol rejected. Only HTTPS URLs are permitted.",
    };
  }

  const hostname = parsed.hostname;

  // SSRF Check: Reject Private, Loopback, and Cloud Metadata IPs
  if (isPrivateOrReservedHost(hostname)) {
    return {
      safe: false,
      error: "Forbidden host: Internal, loopback, and metadata endpoints are strictly blocked.",
      hostname,
    };
  }

  // Whitelist Check: Must belong to supported domains
  if (!isDomainWhitelisted(hostname)) {
    return {
      safe: false,
      error: `Unsupported domain: ${hostname}. Only approved video platforms (YouTube, Instagram, TikTok, X, Reddit) are accepted.`,
      hostname,
    };
  }

  const platform = detectPlatform(hostname);
  const { cleanUrl, platformVideoId } = canonicalizeVideoUrl(parsed, platform);

  return {
    safe: true,
    hostname,
    cleanUrl,
    platform,
    platformVideoId,
  };
}
