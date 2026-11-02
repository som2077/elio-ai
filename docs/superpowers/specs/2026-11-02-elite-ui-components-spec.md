# Elite Mobile UI Components & Microinteractions Specification
**Date:** 2026-11-02  
**Inspirations:** Mobbin (YouTube/Netflix Action Drawer, Cosmos Grid, Spotify), Pinterest (Bento Cards, Media Scrims), Raycast iOS & Apple HIG (Dynamic Island Toast HUD, Concentric Radii, Tactile Springs).

---

## 1. Executive Summary

Following deep research into Mobbin, Pinterest, and modern 2026 mobile design systems, Elio AI's mobile application is being upgraded with high-end, tactile, and modular UI components:
1. **Interactive Video Detail & Action Sheet (`VideoDetailSheet.tsx`):** A fluid modal bottom sheet providing full media preview, AI notes/transcription display, native app deep-link, status toggle, OS share sheet, and clip deletion.
2. **Dynamic Island Floating Toast HUD (`ToastHUD.tsx`):** An animated pill notification dropping from the top notch with spring physics to give immediate feedback when copying links, archiving, or updating status.
3. **Bento Quick Telemetry Strip (`BentoStatsStrip.tsx`):** A 3-cell modular dashboard widget displaying total saved clips, unread backlog, and dominant platform distribution.
4. **Cosmos Grid Shimmer Skeletons (`GridSkeletonCard.tsx`):** 2-column 4:5 aspect ratio pulse skeletons eliminating layout shifts during loading in grid mode.
5. **Tactile Microinteractions & Concentric Radii:** Long-press to peek, optical alignment of icons, and smooth spring-backed animations across all video cards.

---

## 2. Component Specifications

### 2.1 `VideoDetailSheet.tsx` (Bottom Sheet Drawer)
- **Visual Design:**
  - Dark obsidian glass container with 28dp top border radius.
  - Centered grabber pill (`width: 36, height: 5, borderRadius: 2.5`).
  - Specular top rim border (`rgba(255, 255, 255, 0.12)`).
  - Widescreen 16:9 thumbnail preview with gradient text scrim and large optical play button.
  - Platform identity pill (brand color + logo icon) & category tag.
  - AI Notes & Transcript block with copy button and clean typography.
  - 4-pill horizontal action grid:
    1. **Play / Open:** Direct native app link (`openVideoDirectly`).
    2. **Status:** Toggle "Mark as Watched" / "Mark as Unread".
    3. **Share:** Native OS share sheet (`Share.share`).
    4. **Delete:** Destructive action with confirmation alert.

### 2.2 `ToastHUD.tsx` (Floating Island Notification)
- **Visual Design:**
  - Elevated capsule (`height: 44, borderRadius: 22`) floating at `top: 54`.
  - Frosted dark glass background (`#101524` with `borderWidth: 1`, `borderColor: rgba(255, 255, 255, 0.14)`).
  - Ambient glow shadow.
  - Leading status icon (checkmark, copy glyph, trash glyph) + succinct active copy ("Link Copied to Clipboard").
  - Spring enter animation (`translateY: -30 -> 0`) with 2200ms auto-dismiss.

### 2.3 `BentoStatsStrip.tsx` (Compact Telemetry Widget)
- **Visual Design:**
  - 3 modular bento blocks (`flex: 1` each) arranged horizontally.
  - Block 1: **Vault Total** (Total clips with `layers-outline` glyph).
  - Block 2: **Up Next** (Unread count with accent-colored pulse dot).
  - Block 3: **Top Source** (Dominant platform like "YouTube 65%" or "Instagram").
  - Monospace / Tabular numerals for steady counters.

### 2.4 `GridSkeletonCard.tsx` (Cosmos 2-Column Shimmer)
- **Visual Design:**
  - 4:5 aspect ratio card matching `VideoGridCard.tsx`.
  - Harmonious opacity wave oscillation (35% -> 75% -> 35%).
  - Rounded corners (`borderRadius: 18`) with interior shimmer blocks for platform tag, title, and creator.

---

## 3. Interaction Mechanics & Haptics

| Interaction | Visual Motion | Haptic Feedback |
| :--- | :--- | :--- |
| Long-press card | Scale squish (`0.96`), opens `VideoDetailSheet` | `haptics.selection()` |
| Toggle watch status | Icon scale bounce (`0.8 -> 1.25 -> 1.0`), HUD toast | `haptics.success()` |
| Copy Link | ToastHUD drops from top, auto-hides after 2.2s | `haptics.light()` |
| Share Clip | Opens system dialog via `Share.share` | `haptics.light()` |
| Delete Clip | Confirmation modal -> optimistic removal | `haptics.warning()` |
