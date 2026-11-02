# Mobbin-Inspired Mobile UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Elio AI mobile application into a world-class Mobbin-inspired visual experience featuring a floating glass bottom navigation dock, Cosmos-style dual layout (2-column poster grid vs editorial list), cinematic "Up Next" spotlight card, live instant search, and dedicated Activity and Devices tabs.

**Architecture:** 
1. Build reusable Mobbin-grade UI components (`FloatingTabBar`, `VideoGridCard`, `HeroSpotlightCard`, `SearchBar`, `InsightsView`, `DevicesView`).
2. Refactor `AppleHeader` into a spacious, uncluttered top bar with Mascot brand icon and grid/list toggle.
3. Wire `mobile/app/index.tsx` to handle 4 distinct views (`feed`, `search`, `insights`, `devices`) with smooth tab switching and state preservation.

**Tech Stack:** React Native 0.74, Expo 51, TypeScript 5.3, `@expo/vector-icons`, `react-native-safe-area-context`, `expo-haptics`, `expo-blur`.

**Spec:** [`docs/superpowers/specs/2026-11-02-mobbin-inspired-ui-overhaul-design.md`](file:///home/som2077/Desktop/Clipper/docs/superpowers/specs/2026-11-02-mobbin-inspired-ui-overhaul-design.md)

---

## Global Constraints

- **Type Safety:** 100% strict TypeScript checks (`npx tsc --noEmit` must pass with 0 errors).
- **Zero Breakage:** Deep-linking (`openVideoDirectly`), Supabase Realtime synchronization, QR Scanner modal, and unread toggle functions must remain fully operational.
- **Performance:** Smooth 60fps scrolling on both Android and iOS without dropped frames or image flicker.
- **Haptic Feedback:** Tactile haptics on tab changes, card presses, and status toggles.

---

## Review Focus

1. **Grid vs List Rendering:** Switching between 2-column grid and list view without layout shifts or list re-mounting bugs.
2. **Floating Dock Safe Insets:** Floating bottom tab bar must account for bottom safe area insets on iPhone notch/home bar and Android gesture pill.
3. **Live Search Filtering:** Real-time search query matching titles, creator names, and platform tags seamlessly.
4. **Spotlight Card Fallback:** Graceful handling when no videos or unread clips exist.
5. **Cold Start & Status Bar:** Seamless obsidian status bar (`#070A11`) preserved across all tabs.

---

### Task 1: Create Floating Glass Tab Bar (`FloatingTabBar.tsx`)

**Files:**
- Create: `mobile/components/FloatingTabBar.tsx`

**Interfaces:**
- Consumes: `activeTab: 'feed' | 'search' | 'insights' | 'devices'`, `unreadCount: number`, `onTabSelect: (tab) => void`.
- Produces: Elevated, detached floating frosted glass bottom dock with animated active indicator and haptics.

- [ ] **Step 1: Implement `FloatingTabBar.tsx`**
Create detached floating pill dock with 4 icon items:
- Feed (`film-outline` / `film`)
- Search (`search-outline` / `search`)
- Insights (`stats-chart-outline` / `stats-chart`)
- Devices (`hardware-chip-outline` / `hardware-chip` with live status indicator)

- [ ] **Step 2: Verify TypeScript compilation**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add mobile/components/FloatingTabBar.tsx
git commit -m "feat(mobile): add floating glass bottom navigation dock"
```

---

### Task 2: Create Cosmos-Style 2-Column Poster Grid Card (`VideoGridCard.tsx`)

**Files:**
- Create: `mobile/components/VideoGridCard.tsx`

**Interfaces:**
- Consumes: `video: SavedVideo`, `onPress: () => void`, `onToggleStatus: () => void`.
- Produces: Visual poster card with 4:5 aspect ratio, gradient text protection scrim, platform glyph badge, duration pill, and unread indicator.

- [ ] **Step 1: Implement `VideoGridCard.tsx`**
Card with:
- Thumbnail image filling container with rounded corners (16dp).
- Gradient dark scrim at the bottom for crisp white title readability.
- Platform badge in top-left with brand-colored accent.
- Unread pulse dot in top-right.
- Creator name in subtle font.
- Scale spring press animation on tap.

- [ ] **Step 2: Verify TypeScript compilation**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add mobile/components/VideoGridCard.tsx
git commit -m "feat(mobile): add Cosmos-inspired 2-column video grid poster card"
```

---

### Task 3: Create Cinematic "Up Next" Spotlight Hero Card (`HeroSpotlightCard.tsx`)

**Files:**
- Create: `mobile/components/HeroSpotlightCard.tsx`

**Interfaces:**
- Consumes: `video: SavedVideo | null`, `onPress: () => void`, `onDismiss?: () => void`.
- Produces: Prominent widescreen hero card showcasing next unread video to watch with ambient backdrop.

- [ ] **Step 1: Implement `HeroSpotlightCard.tsx`**
Card with:
- "UP NEXT IN YOUR WATCHLIST" neon tag.
- 16:9 featured thumbnail with play button overlay.
- Title and creator name.
- 1-tap "Watch Now" action capsule with haptic trigger.

- [ ] **Step 2: Verify TypeScript compilation**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add mobile/components/HeroSpotlightCard.tsx
git commit -m "feat(mobile): add cinematic Up Next spotlight hero card"
```

---

### Task 4: Create Search & Discover View (`SearchBar.tsx` & Search Tab)

**Files:**
- Create: `mobile/components/SearchBar.tsx`

**Interfaces:**
- Consumes: `query: string`, `onChangeQuery: (q: string) => void`, `onClear: () => void`.
- Produces: Minimalist Apple search input with instant clear button and search icon.

- [ ] **Step 1: Implement `SearchBar.tsx`**
- [ ] **Step 2: Verify TypeScript compilation**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.
- [ ] **Step 3: Commit**
```bash
git add mobile/components/SearchBar.tsx
git commit -m "feat(mobile): add instant search bar component"
```

---

### Task 5: Create Dedicated Insights & Devices Views (`InsightsView.tsx`, `DevicesView.tsx`)

**Files:**
- Create: `mobile/components/InsightsView.tsx`
- Create: `mobile/components/DevicesView.tsx`

**Interfaces:**
- `InsightsView`: Renders `ActivityCalendar`, weekly streak metrics, and platform breakdown stats.
- `DevicesView`: Renders active paired browsers with "+ Link PC" QR scanner button.

- [ ] **Step 1: Implement `InsightsView.tsx`**
- [ ] **Step 2: Implement `DevicesView.tsx`**
- [ ] **Step 3: Verify TypeScript compilation**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.
- [ ] **Step 4: Commit**
```bash
git add mobile/components/InsightsView.tsx mobile/components/DevicesView.tsx
git commit -m "feat(mobile): add dedicated Insights and Devices view screens"
```

---

### Task 6: Refactor AppleHeader & Assemble Complete App in `mobile/app/index.tsx`

**Files:**
- Modify: `mobile/components/AppleHeader.tsx`
- Modify: `mobile/app/index.tsx`

**Interfaces:**
- Integrates all components into unified tabbed flow with grid/list switcher, live search, and floating navigation dock.

- [ ] **Step 1: Update `AppleHeader.tsx`** to show brand mascot, clean status, and grid/list layout toggle button.
- [ ] **Step 2: Update `mobile/app/index.tsx`** to integrate `FloatingTabBar`, view switching, 2-column grid vs list feed, and spotlight card.
- [ ] **Step 3: Run comprehensive TypeScript and build check**
Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.
- [ ] **Step 4: Commit and verify**
```bash
git add mobile/components/AppleHeader.tsx mobile/app/index.tsx
git commit -m "feat(mobile): integrate Mobbin-inspired UI redesign with floating dock, grid feed, and multi-view tabs"
```
