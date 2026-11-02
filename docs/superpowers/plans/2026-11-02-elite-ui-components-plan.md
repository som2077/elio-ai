# Elite Mobile UI Components Implementation Plan

> **For agentic workers:** Implement task-by-task with strict TypeScript checks (`npx tsc --noEmit`).

**Goal:** Elevate Elio AI's mobile UI to Mobbin/Pinterest/Awwwards top-tier standard with interactive Video Detail Sheet, Dynamic Island Toast HUD, Bento Stats Strip, Cosmos 2-column Grid Skeletons, and tactile microinteractions.

---

### Task 1: Create Dynamic Island Floating Toast HUD (`ToastHUD.tsx`)
**Files:**
- Create: `mobile/components/ToastHUD.tsx`
**Step 1:** Implement floating capsule with animated spring drop, leading icon, message, and auto-dismiss timer.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 2: Create Bento Stats Telemetry Strip (`BentoStatsStrip.tsx`)
**Files:**
- Create: `mobile/components/BentoStatsStrip.tsx`
**Step 1:** Implement 3-cell bento container displaying Vault Total, Unread Queue, and Dominant Source with tabular numbers and glass borders.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 3: Create Cosmos Grid Shimmer Skeleton (`GridSkeletonCard.tsx`)
**Files:**
- Create: `mobile/components/GridSkeletonCard.tsx`
**Step 1:** Implement 4:5 aspect ratio shimmer loader matching `VideoGridCard.tsx` dimensions for seamless 2-column loading.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 4: Create Interactive Video Detail & Action Sheet (`VideoDetailSheet.tsx`)
**Files:**
- Create: `mobile/components/VideoDetailSheet.tsx`
**Step 1:** Implement modal bottom sheet with grabber handle, 16:9 thumbnail, creator info, full notes/transcription viewer, and 4 action buttons (Play, Toggle Status, Share, Delete).
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 5: Enhance Cards with Long-Press & More Options (`VideoCard.tsx`, `VideoGridCard.tsx`)
**Files:**
- Modify: `mobile/components/VideoCard.tsx`
- Modify: `mobile/components/VideoGridCard.tsx`
**Step 1:** Add `onLongPress` & quick-detail trigger button to both components.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 6: Wire Full Integration in `mobile/app/index.tsx` & Verify
**Files:**
- Modify: `mobile/app/index.tsx`
**Step 1:** Integrate `ToastHUD`, `BentoStatsStrip`, `GridSkeletonCard`, and `VideoDetailSheet`.
**Step 2:** Wire delete functionality and toast triggers.
**Step 3:** Verify TypeScript check: `cd mobile && npx tsc --noEmit` & extension build: `cd extension && npm run build`.
**Step 4:** Commit.
