# Implementation Plan: Mixpanel Analytics & Smart "Liked but Not Watched" Notifications

**Date:** 2026-11-09  
**Status:** In Progress / Ready for Execution  
**Goal:** Integrate Mixpanel Analytics into the Elio AI mobile application, and implement a smart, time-slot based notification system that notifies users at their free time if they have liked a video but have not yet watched it.

---

## 1. System Architecture & Strategy

### 1.1 Mixpanel Analytics Integration

- Package: `mixpanel-react-native`
- Service: `services/analytics.ts`
- Environment Variable: `EXPO_PUBLIC_MIXPANEL_TOKEN`
- Events to Track:
  - `Video Liked`: Triggered when `is_favorite` is set to `true`. Properties: `video_id`, `video_title`, `platform`, `was_watched`, `scheduled_reminder_slot`, `scheduled_reminder_time`.
  - `Video Unliked`: Triggered when `is_favorite` is set to `false`. Properties: `video_id`.
  - `Video Watched`: Triggered when `status` is set to `'watched'` or `onPlay` is initiated. Properties: `video_id`, `video_title`, `platform`, `source`.
  - `Notification Clicked`: Triggered when user opens the app by tapping the notification. Properties: `video_id`, `notification_type`, `slot`.
  - `App Opened` / `User Identified`: User identity linking on Supabase auth.

### 1.2 Free-Time Slot Engine

When a user likes a video that has `status !== 'watched'`, the app schedules a local reminder for their next free time window:

| User Liked Time Window           | Slot Name   | Target Time            | Logic / Guard            |
| :------------------------------- | :---------- | :--------------------- | :----------------------- |
| **Night (10:00 PM – 6:00 AM)**   | `morning`   | 9:30 AM (Next morning) | Coffee/commute free time |
| **Morning (6:00 AM – 12:00 PM)** | `afternoon` | 2:00 PM (Same day)     | Lunch break free time    |
| **Day (12:00 PM – 5:00 PM)**     | `evening`   | 7:30 PM (Same day)     | Evening relax/tea time   |
| **Evening (5:00 PM – 10:00 PM)** | `night`     | 10:00 PM (Same day)    | Bedtime leisure watch    |

**Buffer Guard:** A minimum threshold of 2 hours is enforced. If a user likes a video within 2 hours of the next slot's target time, the notification automatically rolls forward to the following slot to avoid immediate spam.

### 1.3 Cancellation & Lifecycle Rules

- **Video Watched:** If the user marks the video as watched (`toggleStatus`) or plays the video (`onPlay`), any pending notification for that `videoId` is immediately cancelled via `Notifications.cancelScheduledNotificationAsync`.
- **Video Unliked:** If the user unlikes the video (`is_favorite = false`), any pending reminder for that `videoId` is cancelled.
- **Video Deleted:** If the user removes the clip, any pending reminder is cancelled.
- **Persistence:** Scheduled notification IDs are stored in `AsyncStorage` under `@elio_video_reminders` (`{ [videoId]: notificationId }`).

---

## 2. File Structure Impact

| File                        | Action | Purpose                                                                                                                                     |
| :-------------------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`              | Modify | Add `mixpanel-react-native` dependency                                                                                                      |
| `.env.example` & `.env`     | Modify | Add `EXPO_PUBLIC_MIXPANEL_TOKEN`                                                                                                            |
| `services/analytics.ts`     | Create | Mixpanel client wrapper, safe initialization, event dispatchers                                                                             |
| `services/notifications.ts` | Modify | Add `getNextFreeTimeSlot`, `scheduleLikedVideoReminder`, `cancelLikedVideoReminder`, notification listener registration                     |
| `app/_layout.tsx`           | Modify | Initialize analytics on app start; register notification tap listener and navigation                                                        |
| `app/index.tsx`             | Modify | Integrate `toggleFavorite`, `toggleStatus`, `handleDeleteVideo`, and `onPlay` to trigger reminder scheduling/cancelling and Mixpanel events |

---

## 3. Tasks Breakdown

### Task 1: Mixpanel Dependency & Environment Setup

- **Deliverable:** Install `mixpanel-react-native` and declare env tokens.
- **Files:** `package.json`, `.env.example`, `.env`
- **Steps:**
  1. Run `npx expo install mixpanel-react-native` (or `npm install mixpanel-react-native`).
  2. Add `EXPO_PUBLIC_MIXPANEL_TOKEN=your-token-here` to `.env.example` and `.env`.
  3. Verify TypeScript compiles without type errors.

### Task 2: Create Analytics Service (`services/analytics.ts`)

- **Deliverable:** Safe, robust Mixpanel wrapper that handles offline, missing token, and error states gracefully.
- **Files:** `services/analytics.ts`
- **Functions:**
  - `initAnalytics(): Promise<void>`: Reads token, initializes Mixpanel with opt-out check.
  - `identifyUser(userId: string, traits?: Record<string, any>): void`: Sets distinct user ID in Mixpanel.
  - `resetUser(): void`: Clears user on logout.
  - `trackEvent(eventName: string, props?: Record<string, any>): void`: Base tracking method.
  - `trackVideoLiked(video: SavedVideo, reminderSlot?: string, reminderTime?: string): void`
  - `trackVideoUnliked(videoId: string): void`
  - `trackVideoWatched(video: SavedVideo, source: 'notification' | 'app'): void`
  - `trackNotificationClicked(videoId: string, slot?: string): void`

### Task 3: Implement Smart Slot Calculation & Reminder Scheduling in `services/notifications.ts`

- **Deliverable:** Slot calculation engine and notification scheduling / cancellation methods.
- **Files:** `services/notifications.ts`
- **Functions:**
  - `getNextFreeTimeSlot(now?: Date): { targetDate: Date; slotName: 'morning' | 'afternoon' | 'evening' | 'night' }`
  - `scheduleLikedVideoReminder(video: SavedVideo): Promise<string | null>`:
    - Generates dynamic copy based on `slotName` and `video.title`.
    - Calls `Notifications.scheduleNotificationAsync({ content, trigger: { date: targetDate } })`.
    - Persists `notificationId` into `@elio_video_reminders` map in `AsyncStorage`.
    - Calls `analytics.trackVideoLiked`.
  - `cancelLikedVideoReminder(videoId: string): Promise<void>`:
    - Reads `notificationId` from `@elio_video_reminders`.
    - Calls `Notifications.cancelScheduledNotificationAsync(notificationId)`.
    - Deletes key from `AsyncStorage`.

### Task 4: Connect Triggers in `app/index.tsx`

- **Deliverable:** Link video liking, watching, playing, and deleting to scheduling and cancellation.
- **Files:** `app/index.tsx`
- **Changes:**
  - `toggleFavorite`:
    - If `newFav === true`:
      - If `video.status !== 'watched'`, call `scheduleLikedVideoReminder(video)`.
      - Else call `analytics.trackVideoLiked(video)`.
    - If `newFav === false`:
      - Call `cancelLikedVideoReminder(video.id)`.
      - Call `analytics.trackVideoUnliked(video.id)`.
  - `toggleStatus`:
    - If `newStatus === 'watched'`, call `cancelLikedVideoReminder(video.id)` and `analytics.trackVideoWatched(video, 'app')`.
  - `handleDeleteVideo`:
    - Call `cancelLikedVideoReminder(video.id)`.
  - `VideoDetailSheet.onPlay`:
    - Call `cancelLikedVideoReminder(video.id)` and `analytics.trackVideoWatched(video, 'app')`.

### Task 5: Notification Click Listener & Navigation in `app/_layout.tsx`

- **Deliverable:** Handle notification response when tapped (both background and foreground).
- **Files:** `app/_layout.tsx` (and `app/index.tsx` param/listener handling)
- **Changes:**
  - Add `Notifications.addNotificationResponseReceivedListener` inside `useEffect`.
  - If notification response has `data.videoId` and `data.type === 'liked_not_watched'`:
    - Call `analytics.trackNotificationClicked(videoId, slot)`.
    - Navigate / trigger detail sheet for that video.

### Task 6: Verification & Testing

- **Deliverable:** Confirm that:
  1. `getNextFreeTimeSlot` produces correct target dates across all hours (morning, day, evening, night).
  2. Liking an unread video schedules a notification and writes to `AsyncStorage`.
  3. Marking the video as watched or playing it cancels the scheduled notification.
  4. Unliking the video cancels the scheduled notification.
  5. Mixpanel event tracking executes without errors.
