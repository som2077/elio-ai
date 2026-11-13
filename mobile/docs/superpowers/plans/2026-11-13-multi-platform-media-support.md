# Multi-Platform Media Support (All 9 Platforms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable complete, end-to-end support for saving, analyzing, displaying with authentic branding, filtering, and deep-linking videos from all 9 platforms specified in the screenshot (`Facebook`, `Instagram`, `X (Twitter)`, `Threads`, `Pinterest`, `Snapchat`, `YouTube`, `Reddit`, `TikTok`).

**Architecture:** Implement Option 1 (Rich Preview Cards in OLED obsidian feed with authentic thumbnails, title/creator metadata, AI summaries, and one-tap deep-linking into native official apps/browsers). Extend the 4 core layers of the system:

1. Backend SSRF security guard & ingestion edge function domain whitelists.
2. Backend metadata scrapers (OpenGraph/oEmbed/public crawler for Threads, Snapchat, Pinterest, and Facebook).
3. Mobile client types, regex URL cleaners, and platform share handlers.
4. Mobile design system: official authentic brand icons/colors, filter pills, analytics breakdown, and deep-link router.

**Tech Stack:** React Native 0.74 (Expo 51), TypeScript 5.3, Supabase Edge Functions (Deno), `react-native-svg`, Apple Tokens / OLED Obsidian UI.

**Spec:** Screenshot `/home/som2077/Pictures/Screenshots/Screenshot From 2026-11-13 21-12-40.png` specifying the 9 target media platforms + User Decision for Option 1 (Rich Preview Cards + Direct App Deep-Link).

## Global Constraints

- Never break existing supported platforms (`youtube`, `instagram`, `twitter`, `tiktok`, `reddit`).
- All incoming URLs must pass strict HTTPS and SSRF validation in `backend/supabase/functions/ingest-video/ssrfGuard.ts`.
- Every platform must have a deterministic brand color and official icon in `components/PlatformIcon.tsx`.
- Deep-links must check `Linking.canOpenURL()` and always gracefully fallback to sanitized web URLs in default browser.
- All code changes must strictly pass `npx tsc --noEmit` with zero errors.

## Review Focus

1. **Snapchat URLs with tracking tokens:** URLs like `https://story.snapchat.com/s/xyz?share_id=abc&sender_web_id=123` must strip tracking tokens and pass SSRF whitelist.
2. **Threads post URLs:** URLs like `https://www.threads.net/@user/post/xyz` must correctly map to `platform: "threads"` and display authentic Threads branding.
3. **Facebook Watch / Reel URLs:** URLs like `https://fb.watch/xyz` or `https://www.facebook.com/reel/123` must canonicalize cleanly.
4. **Platform filter sync:** Selecting `Threads` or `Snapchat` in `PlatformFilterModal` or `AppleHeader` must filter the feed without crashes.
5. **Insights platform breakdown:** `InsightsView.tsx` must render platform stats without missing keys for any of the 9 platforms.

---

### Task 1: Type System & Domain Constants Extension

**Files:**

- Modify: `types/video.ts:3-15`
- Test: `npx tsc --noEmit`

**Interfaces:**

- Consumes: Existing `PlatformType` union
- Produces: Updated `PlatformType` including `"threads"` and `"snapchat"`

- [ ] **Step 1: Update `PlatformType` in `types/video.ts`**
      Add `"threads"` and `"snapchat"` to `PlatformType`:

```typescript
export type PlatformType =
  | "youtube"
  | "instagram"
  | "twitter"
  | "facebook"
  | "reddit"
  | "linkedin"
  | "pinterest"
  | "tiktok"
  | "threads"
  | "snapchat"
  | "other";
```

- [ ] **Step 2: Run type check**
      Run: `npx tsc --noEmit`
      Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add types/video.ts
git commit -m "feat(types): add threads and snapchat to PlatformType"
```

---

### Task 2: Backend SSRF Guard & Domain Whitelist Extension

**Files:**

- Modify: `../backend/supabase/functions/ingest-video/ssrfGuard.ts:14-55, 170-205, 250-290`
- Test: TypeScript check or deno check on `ssrfGuard.ts`

**Interfaces:**

- Consumes: Inbound URL strings
- Produces: `SSRFValidationResult` with detected platform and sanitized canonical URL

- [ ] **Step 1: Add Snapchat & Threads domains to `ALLOWED_DOMAINS` in `ssrfGuard.ts`**
      Add:
- `"threads.net"`, `"www.threads.net"`
- `"snapchat.com"`, `"www.snapchat.com"`, `"story.snapchat.com"`, `"snap.com"`
- `"pinterest.com"`, `"www.pinterest.com"`, `"pin.it"`
- `"facebook.com"`, `"www.facebook.com"`, `"fb.watch"`

- [ ] **Step 2: Add `snapchat` and `threads` detection to `detectPlatform()`**

```typescript
if (lower.includes("snapchat.com") || lower.includes("snap.com")) {
  return "snapchat";
}
if (lower.includes("threads.net") || lower.includes("threads.com")) {
  return "threads";
}
if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
  return "pinterest";
}
```

- [ ] **Step 3: Add tracking parameter cleanup in `TRACKING_PARAMS`**
      Add Snapchat & Threads parameters: `sender_web_id`, `share_id`, `xmt`, `sref`.

- [ ] **Step 4: Commit**

```bash
git add ../backend/supabase/functions/ingest-video/ssrfGuard.ts
git commit -m "feat(backend): whitelist Snapchat, Threads, Pinterest and Facebook in ssrfGuard"
```

---

### Task 3: Backend Multi-Platform Metadata Scraper

**Files:**

- Modify: `../backend/supabase/functions/process-video-ai/socialScraper.ts`
- Modify: `../backend/supabase/functions/process-video-ai/types.ts`

**Interfaces:**

- Consumes: Video URL and platform string
- Produces: `SocialScrapedContent` with title, creator, caption, and `thumbnailUrl`

- [ ] **Step 1: Add `scrapeSnapchatContent()` in `socialScraper.ts`**
      Extract `og:title`, `og:description`, `og:image`, and author from public Snapchat story and spotlight URLs.

- [ ] **Step 2: Add `scrapeThreadsContent()` in `socialScraper.ts`**
      Extract author handle, post text, and media thumbnail from Threads meta tags.

- [ ] **Step 3: Add `scrapeFacebookContent()` and `scrapePinterestContent()`**
      Extract title, creator name, and high-res thumbnail preview from Facebook Reels/Watch and Pinterest pins.

- [ ] **Step 4: Update `extractSocialContent()` dispatcher**
      Route `platform === "snapchat"`, `platform === "threads"`, `platform === "facebook"`, `platform === "pinterest"` to their respective scrapers with generic fallback.

- [ ] **Step 5: Commit**

```bash
git add ../backend/supabase/functions/process-video-ai/socialScraper.ts
git commit -m "feat(ai): add metadata and thumbnail scrapers for Snapchat, Threads, Facebook, Pinterest"
```

---

### Task 4: Mobile URL Extraction & Analysis Service

**Files:**

- Modify: `services/shareHandler.ts:85-195`
- Test: `npx tsc --noEmit`

**Interfaces:**

- Consumes: Raw shared URL string from system share sheet or clipboard
- Produces: `{ platform: PlatformType, category: ContentCategory, title: string, thumbnailUrl: string }`

- [ ] **Step 1: Enhance `analyzeSharedUrl()` in `services/shareHandler.ts`**
      Add explicit detection blocks for:

1. **Facebook (`facebook.com`, `fb.watch`):**
   - Category: `reel` (if `/reel/` or `fb.watch`) else `post`
   - Title: `"Facebook Reel / Video"`
   - Default thumbnail: High-res authentic Unsplash Facebook social backdrop.
2. **Threads (`threads.net`):**
   - Category: `post`
   - Title: `"Threads Post / Clip"`
   - Default thumbnail: Minimalist black OLED Threads backdrop.
3. **Snapchat (`snapchat.com`, `snap.com`):**
   - Category: `short`
   - Title: `"Snapchat Spotlight / Story"`
   - Default thumbnail: Vibrant Snapchat amber-yellow gradient backdrop.
4. **Pinterest (`pinterest.com`, `pin.it`):**
   - Category: `post`
   - Title: `"Pinterest Idea / Video Pin"`

- [ ] **Step 2: Run type check**
      Run: `npx tsc --noEmit`
      Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add services/shareHandler.ts
git commit -m "feat(services): support Snapchat, Threads, and Facebook in shareHandler"
```

---

### Task 5: Mobile Brand Icons & Authentic Design System Styling

**Files:**

- Modify: `components/PlatformIcon.tsx:18-55, 60-115`
- Test: `npx tsc --noEmit`

**Interfaces:**

- Consumes: `platform: string`, `size?: number`, `color?: string`
- Produces: Rendered authentic brand icon (PNG asset or SVG vector) with official brand color

- [ ] **Step 1: Add brand colors in `PLATFORM_BRAND_COLORS`**

```typescript
export const PLATFORM_BRAND_COLORS: Record<string, string> = {
  youtube: "#FF0033",
  instagram: "#E1306C",
  twitter: "#FFFFFF",
  x: "#FFFFFF",
  threads: "#FFFFFF",
  tiktok: "#00F2FE",
  reddit: "#FF4500",
  snapchat: "#FFFC00",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  all: "#FFFFFF",
};
```

- [ ] **Step 2: Add SVG vector icons for Threads and Snapchat in `PlatformIcon.tsx`**
      For `threads`: render the authentic minimalist `@` infinity loop vector.
      For `snapchat`: render the iconic authentic ghost vector with `#FFFC00` background pill or silhouette.

- [ ] **Step 3: Run type check**
      Run: `npx tsc --noEmit`
      Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/PlatformIcon.tsx
git commit -m "feat(ui): add authentic brand icons and colors for Threads and Snapchat"
```

---

### Task 6: Filter UI & Analytics Integration for All 9 Platforms

**Files:**

- Modify: `components/PlatformFilterModal.tsx:24-81`
- Modify: `components/AppleHeader.tsx:40-50`
- Modify: `components/InsightsView.tsx:35-46`
- Test: `npx tsc --noEmit`

**Interfaces:**

- Consumes: `PlatformConfig[]`, `selectedPlatform` string
- Produces: Interactive filter switches, header tabs, and analytics breakdown for all 9 platforms

- [ ] **Step 1: Add Threads & Snapchat to `ALL_AVAILABLE_PLATFORMS` in `PlatformFilterModal.tsx`**

```typescript
  {
    key: "threads",
    label: "Threads",
    icon: "at-outline",
    color: "#FFFFFF",
    bgColor: "rgba(255, 255, 255, 0.12)",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    icon: "logo-snapchat",
    color: "#FFFC00",
    bgColor: "rgba(255, 252, 0, 0.15)",
  },
```

- [ ] **Step 2: Add platform accent colors & labels to `AppleHeader.tsx`**
      Add `threads: "#FFFFFF"`, `snapchat: "#FFFC00"`.

- [ ] **Step 3: Update `PLATFORM_NAMES` in `InsightsView.tsx`**
      Add `threads: "Threads"`, `snapchat: "Snapchat"`.

- [ ] **Step 4: Run type check**
      Run: `npx tsc --noEmit`
      Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/PlatformFilterModal.tsx components/AppleHeader.tsx components/InsightsView.tsx
git commit -m "feat(ui): integrate Threads and Snapchat in platform filter modal, header tabs and insights"
```

---

### Task 7: Deep-Link Launcher & Universal Player Navigation

**Files:**

- Modify: `services/deepLink.ts:15-65`
- Test: `npx tsc --noEmit`

**Interfaces:**

- Consumes: `url: string`, `platform: PlatformType`, `videoId?: string`
- Produces: Opens official native app deep-link with graceful fallback to system browser

- [ ] **Step 1: Extend `openVideoDirectly()` in `services/deepLink.ts`**
      Add native app deep-link URI schemes:
- **Snapchat:** `snapchat://` with fallback to `https://story.snapchat.com/...`
- **Threads:** `barcelona://` / `threads://` with fallback to `https://www.threads.net/...`
- **Facebook:** `fb://facewebmodal/f?href=` with fallback to `https://facebook.com/...`
- **Twitter / X:** `twitter://` / `x://` with fallback to `https://x.com/...`
- **TikTok:** `snssdk1233://` with fallback to `https://www.tiktok.com/...`
- **Reddit:** `reddit://` with fallback to `https://reddit.com/...`
- **Pinterest:** `pinterest://` with fallback to `https://pinterest.com/...`

- [ ] **Step 2: Run type check**
      Run: `npx tsc --noEmit`
      Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add services/deepLink.ts
git commit -m "feat(navigation): add app deep-links for Snapchat, Threads, Facebook, Pinterest and X"
```

---

### Task 8: End-to-End Verification on Real Device

**Files:**

- Verify: Mobile client & running Android device process
- Commands: `npx tsc --noEmit`, `adb shell monkey ...`

- [ ] **Step 1: Run complete TypeScript build check**
      Run: `npx tsc --noEmit`
      Expected: 0 errors across all modified files.

- [ ] **Step 2: Restart app on connected Android device & check logcat**
      Run: `adb shell am force-stop com.elioai.android && sleep 1 && adb shell monkey -p com.elioai.android -c android.intent.category.LAUNCHER 1`
      Verify: PID is active, zero runtime warnings or errors.

- [ ] **Step 3: Final branch verification and review summary**
      Ensure all 9 platforms are clean, verified, and ready.
