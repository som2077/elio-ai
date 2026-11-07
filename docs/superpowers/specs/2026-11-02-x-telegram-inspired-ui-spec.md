# Twitter (X) & Telegram-Inspired Mobile UI Specification

**Date:** 2026-11-02  
**Inspiration:** Twitter / X ("Lights Out" dark feed, Tweet card anatomy, action engagement row) & Telegram iOS (Folder tabs, double-check status indicators, fluid micro-haptics, shared media grid).

---

## 1. Executive Summary

This specification transforms Elio AI's mobile UI by fusing the two most beloved, high-speed mobile interfaces in modern engineering:

1. **Twitter / X Post Architecture (`VideoCard.tsx`):**
   - Circular creator avatar with platform badge.
   - Display name, `@creator` handle, middle dot (`·`), relative timestamp, and options menu.
   - Widescreen 16:9 media embed with 1px hairline border (`#2F3336`) and duration/platform tag.
   - Iconic 5-item engagement action bar:
     - 💬 Notes / AI Summary (`chatbubble-outline`)
     - 🔁 Watched toggle (`repeat` turning X-green `#00BA7C` with spring bounce)
     - 🔖 Vault status (`bookmark` in X-blue `#1D9BF0`)
     - 📤 Native OS Share (`share-outline`)
     - 🔗 Open original clip (`open-outline`)
2. **Telegram iOS Folder Navigation (`AppleFilterPills.tsx`):**
   - Telegram-style chat folder tabs with numeric unread count badges.
   - Active Telegram cyan (`#2AABEE`) active state.
3. **Telegram Shared Media Grid (`VideoGridCard.tsx`):**
   - 4:5 aspect ratio posters with Telegram-style duration pill.
   - Telegram's iconic double-checkmark indicator (`checkmark-done` in `#2AABEE` for watched/synced vs `time-outline` for in-queue).
4. **X / Telegram "Lights Out" Aesthetic:**
   - Deep `#000000` / `#050811` background, `#E7E9EA` primary text, `#71767B` muted secondary text, and hairline `#2F3336` dividers.

---

## 2. Component Blueprint

### 2.1 `VideoCard.tsx` (Twitter/X Post Card)

- **Structure:**
  ```text
  [Avatar]  [Creator Name] [@handle] · [Time]        [...]
            [Video Title]
            [Embedded 16:9 Media Frame with Play FAB]
            [💬 Notes]   [🔁 Status]   [🔖 Save]   [📤 Share]   [🔗 Open]
  ------------------------------------------------------------- (Hairline)
  ```
- **Tokens:**
  - Background: `#000000` / `#070A11`
  - Border: 1px bottom border `#2F3336`
  - Action row icon size: 18, color `#71767B`
  - Active Retweet/Status color: `#00BA7C` (X Green)

### 2.2 `AppleFilterPills.tsx` (Telegram Folder Tabs)

- **Structure:**
  - Horizontal scroll of capsule buttons.
  - Active button: Telegram Cyan (`#2AABEE`) border and text, or filled pill with unread count badge.
  - Numeric badge: Telegram bubble pill with active contrast.

### 2.3 `VideoGridCard.tsx` (Telegram Shared Media Grid)

- **Structure:**
  - 4:5 poster card.
  - Top-left: Platform glyph with translucent dark scrim.
  - Top-right: Telegram status glyph (`checkmark-done` in `#2AABEE` for watched, `time-outline` for in-queue).
  - Bottom-left: Title & creator.
  - Bottom-right: Category pill.

---

## 3. Interaction Mechanics & Verification

- 100% strict TypeScript checks (`npx tsc --noEmit`).
- Extension build passes (`npm run build`).
- Tactile haptic feedback on all interactions.
