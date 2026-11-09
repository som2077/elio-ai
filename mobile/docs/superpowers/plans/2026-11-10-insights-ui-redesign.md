# Insights Screen UI Redesign & Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and declutter the Insights screen (`components/InsightsView.tsx`) to match the app's OLED Obsidian & Apple/Threads minimalist design language, removing unwanted fake/gimmicky elements and redundant sections while elevating core analytics.

**Architecture:** Refactor `components/InsightsView.tsx` into a clean, modular structure with Apple-grade bento cards, a minimalist daily activity bar chart, an official brand-icon platform breakdown, and a compact watch-completion status bar. Remove dead code `components/InsightsTrendChart.tsx`.

**Tech Stack:** React Native, Expo, TypeScript, `react-native-svg`, Apple Tokens / OLED Obsidian Design System.

---

## 1. What to Remove (Unwanted / Cluttered Elements)

1. **Fake Hardcoded Data**: Remove hardcoded `+18.4%` green trend pill.
2. **Sci-Fi Gimmick**: Remove `"Live Vault Telemetry"` and the blinking green dot in the header.
3. **Redundant Video Feed**: Remove `"RECENT HIGHLIGHTS"` list at the bottom (the main tab already serves as the complete video feed; duplicating it in Insights clutters the analytics screen).
4. **28-Day Heatmap Grid**: Remove the cramped 4x7 cyan square matrix and flame streak pill (unnecessary visual noise for a video bookmark app).
5. **Bulky SVG Donut Chart**: Replace the heavy 116px SVG donut chart and its 3-line repetitive legend with a sleek, compact Apple-style segmented progress bar.
6. **Chaotic Neon Colors**: Replace the scattered cyan (`#00E5FF`), sky blue (`#38BDF8`), purple (`#A855F7`), and amber with the unified Apple OLED palette (`#000000`, `#121216`, `#FFFFFF`, `#71767B`, and authentic platform brand colors).
7. **Dead Code Cleanup**: Delete unused file `components/InsightsTrendChart.tsx`.

---

## 2. What to Keep & Enhance (Clean, Premium, High-Value Insights)

1. **OLED Minimalist Header**:
   - Title: "Insights" (aligned with bottom tab name).
   - Dynamic subtitle: shows total clips count for selected timeframe (e.g. `24 clips in range`).
   - Timeframe Selector: `7D | 14D | 30D | ALL` in Apple pill design (active: pure `#FFFFFF` background with `#000000` bold text; inactive: transparent with `#71767B` text).
2. **Apple Bento Metric Cards (4 Essential Metrics)**:
   - 2x2 Bento Grid:
     - **Saved**: Total clips saved.
     - **Queue**: Clips waiting to be watched.
     - **Watched**: Completed clips count.
     - **Completion Rate**: Real calculated percentage (e.g., `75%`).
   - Clean dark cards (`#121216`), subtle hairline borders (`rgba(255, 255, 255, 0.08)`), pure white bold typography.
3. **Daily Activity Bar Chart (Refined Minimalist)**:
   - Clean vertical bar chart showing saves per day (7 or 14 days).
   - Crisp white/light-gray pill bars on subtle dark tracks.
   - Interactive tap showing exact clip count tooltip for the selected day.
4. **Platform Distribution with Official Brand Icons**:
   - Official platform logos from `PlatformIcon` (YouTube, Instagram, X/Twitter, TikTok, Reddit, Facebook).
   - Clean horizontal progress bar for each active platform with exact clip count and percentage.
5. **Watch Completion Segmented Pill**:
   - Sleek horizontal segmented progress bar showing Watched vs In Queue ratio.
   - Clear summary row with green checkmark for watched and clean queue indicator.

---

## Task Decomposition

### Task 1: Clean Up Dead Code & Unused Assets

- Delete `components/InsightsTrendChart.tsx` (not imported or used anywhere).
- Verify type checks with `npx tsc --noEmit`.

### Task 2: Redesign `components/InsightsView.tsx` Header & Timeframe Switcher

- Update title from "Analytics" to "Insights".
- Remove "Live Vault Telemetry" and green pulse dot.
- Add dynamic subtitle showing total clips in range.
- Restyle timeframe switcher pills (`7d`, `14d`, `30d`, `all`) to Apple/Threads high-contrast style (`#FFFFFF` background + `#000000` text when active).

### Task 3: Implement 2x2 Apple Bento Metric Cards

- Replace the cramped 3-card row with a balanced 2x2 Bento grid:
  - Total Saved
  - In Queue (Unread)
  - Watched
  - Completion Rate (%)
- Remove hardcoded `+18.4%` fake trend badge.
- Apply OLED Obsidian styling (`#121216`, hairline border, white metric numbers).

### Task 4: Refactor Daily Activity Bar Chart

- Restyle the capsule bar chart to clean Apple Fitness / Threads look.
- Use subtle track background and crisp white/accent bar fills.
- Support clean tap interaction for day tooltips.

### Task 5: Enhance Platform Distribution with `PlatformIcon`

- Import and use `PlatformIcon` for each platform row.
- Show platform label, official icon, clip count, and percentage.
- Render sleek horizontal progress bars matching platform brand colors.

### Task 6: Implement Compact Watch Completion Segmented Bar & Remove Clutter

- Replace the bulky SVG donut chart with a sleek horizontal segmented progress bar.
- Remove the 28-day intensity heatmap grid.
- Remove the "RECENT HIGHLIGHTS" feed list at the bottom.
- Ensure proper bottom padding for FloatingTabBar.

### Task 7: Verification & Visual Polish

- Run `npx tsc --noEmit` to ensure 0 TypeScript errors.
- Test with empty library and active library.
