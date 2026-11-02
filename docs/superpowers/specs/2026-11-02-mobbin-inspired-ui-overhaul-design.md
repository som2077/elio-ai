# Elio AI Mobile UI Redesign Specification (Mobbin-Inspired)

**Date:** 2026-11-02  
**Status:** Approved  
**Inspiration Benchmark:** Mobbin 2026 curated mobile patterns (Cosmos, Arc Search, Opal, Linear Mobile, Sofa, Amie)

---

## 1. Intent & The "Why"
The current mobile app UI presents all features on a single flat scrolling view, with utility actions (QR scanner, device management, activity calendar, logout) compressed into a single top header bar. 

This redesign transforms Elio AI into a world-class, media-first video watchlist and recall tool inspired by Mobbin's top curation and productivity apps. It separates concerns across clear views, introduces a floating frosted glass bottom dock, provides a Cosmos-style dual layout (Visual 2-Column Poster Grid vs Editorial List), cinematic spotlight hero card, and real-time instant search.

---

## 2. Goals & Non-Goals

### Goals
- **Floating Glass Capsule Dock (Bottom Tab Bar):** Detached, elevated bottom navigation (`Watchlist`, `Search`, `Activity / Insights`, `Devices & Sync`).
- **Dual Feed Layout Switcher:** Instant 1-tap toggle between **2-Column Media Poster Grid** (Cosmos-style) and **Editorial List View** (detailed metadata card).
- **Cinematic Spotlight Card:** Prominent "Up Next" hero card featuring the latest unread saved video with ambient backplate and 1-tap "Watch Now" action.
- **Dedicated Navigation Views:** Clean separation of Search, Activity/Streaks, and Connected Browser devices so the main feed is focused strictly on videos.
- **De-cluttered Apple-Grade Header:** Clean header showing brand mascot, greeting/status, and layout toggle without button congestion.
- **Tactile Multimodal Haptics:** Polished haptic feedback on tab changes, card taps, status toggles, and layout switches.

### Non-Goals
- Changing backend Supabase schemas or video sync data contracts.
- Altering Chrome extension sync worker logic.

### Anti-Goals
- Generic, boxy SaaS templates with identical borders and washed-out gray backgrounds.
- Cluttered headers with 5+ competing icon buttons.
- Slow render performance or layout jumpiness during tab switches.

---

## 3. Visual Tokens & Aesthetic Architecture

- **Canvas & Elevation:**
  - Obsidian Base: `#070A11`
  - Card Glass Surface: `rgba(255, 255, 255, 0.04)`
  - Elevated Glass Dock: `rgba(14, 18, 28, 0.88)` with `rgba(255, 255, 255, 0.12)` border
  - Ambient Accent Glow: `#00E5FF` (Electric Cyan) & `#6366F1` (Indigo Neon)
- **Typography:**
  - SF Pro Display / Rounded weights (Heavy 800 for counts, Bold 700 for titles, Medium 500 for creator metadata).
- **Layout Grid:**
  - 2-Column Masonry/Grid: Card width `(screenWidth - 44) / 2`, aspect ratio 4:5 with gradient scrim and top-right platform badge.
  - List View: Full-width card with 16:9 thumbnail on left, title and tags on right.

---

## 4. Architectural Decomposition

1. `mobile/components/FloatingTabBar.tsx`: Elevated floating glass dock with 4 active tabs.
2. `mobile/components/VideoGridCard.tsx`: 2-column aesthetic poster card with gradient overlay, duration pill, and unread indicator.
3. `mobile/components/HeroSpotlightCard.tsx`: Featured "Up Next in Watchlist" hero card.
4. `mobile/components/SearchBar.tsx`: Instant search input with filter chips.
5. `mobile/components/InsightsView.tsx`: Dedicated tab for activity heatmap, saving streaks, and platform statistics.
6. `mobile/components/DevicesView.tsx`: Dedicated tab for connected browser profiles with QR scanner launcher.
7. `mobile/components/AppleHeader.tsx`: Refactored spacious header with brand mascot and layout toggle.
8. `mobile/app/index.tsx`: Orchestrates the 4 views, active tab switching, and state.
