# Twitter (X) & Telegram UI Transformation Plan

> **For agentic workers:** Execute task-by-task with strict TypeScript checks (`npx tsc --noEmit`).

**Goal:** Transform Elio AI's mobile UI into the world-class look and feel of Twitter / X and Telegram iOS with post feed architecture, Telegram folder filter tabs, Telegram double-checkmarks, and X action engagement bar.

---

### Task 1: Refactor `VideoCard.tsx` to Twitter (X) Post Anatomy
**Files:**
- Modify: `mobile/components/VideoCard.tsx`
**Step 1:** Implement X Post layout with creator circular avatar, verified badge, `@handle · timestamp` metadata row, title, 16:9 media embed, and 5-icon engagement bar (💬 notes, 🔁 status, 🔖 bookmark, 📤 share, 🔗 open) with hairline bottom divider `#2F3336`.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 2: Enhance `AppleFilterPills.tsx` to Telegram Folder Tabs
**Files:**
- Modify: `mobile/components/AppleFilterPills.tsx`
**Step 1:** Implement Telegram-style chat folder tabs with numeric unread count badges, smooth pill shape, and Telegram cyan (`#2AABEE`) active state.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 3: Enhance `VideoGridCard.tsx` with Telegram Double-Checkmarks & Clean Poster Layout
**Files:**
- Modify: `mobile/components/VideoGridCard.tsx`
**Step 1:** Integrate Telegram's iconic double-checkmark (`checkmark-done` in `#2AABEE`) for watched status and clean duration/platform badge.
**Step 2:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 3:** Commit.

---

### Task 4: Polish `AppleHeader.tsx` & Theme Tokens for Twitter "Lights Out"
**Files:**
- Modify: `mobile/theme/appleTokens.ts`
- Modify: `mobile/components/AppleHeader.tsx`
**Step 1:** Update theme tokens with X Lights Out colors (`#000000`, `#2F3336`, `#71767B`, `#00BA7C`, `#2AABEE`).
**Step 2:** Update `AppleHeader.tsx` with sleek X-style typography and Telegram live sync indicator.
**Step 3:** Verify TypeScript check: `cd mobile && npx tsc --noEmit`.
**Step 4:** Commit.

---

### Task 5: Full Integration & Verification
**Files:**
- Modify: `mobile/app/index.tsx`
**Step 1:** Ensure all handlers (share, notes preview, status toggle, deep link, detail sheet) work seamlessly.
**Step 2:** Verify `cd mobile && npx tsc --noEmit` and `cd extension && npm run build`.
**Step 3:** Commit.
