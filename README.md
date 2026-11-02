# 🚀 Elio AI

**AI-Ready Cross-Platform Video, Social Sync & Intelligent Recall Ecosystem**

---

## 📁 Project Structure

```
elio-ai/
├── extension/                       # 🌐 Chrome / Brave / Edge Extension (Manifest V3)
│   ├── manifest.json                # Extension manifest
│   ├── package.json                 # Build dependencies (Vite + TypeScript)
│   ├── dist/                        # Compiled production extension ready for browser
│   │   ├── background/service_worker.js
│   │   ├── content/youtube.js
│   │   ├── content/instagram.js
│   │   └── popup/
│   └── src/
│       ├── background/service_worker.ts
│       ├── content/youtube.ts       # YouTube & Shorts like detector & scraper
│       ├── content/instagram.ts     # Instagram Reels & Posts bookmark/like detector
│       ├── popup/popup.html & .ts   # Status & Supabase cloud config UI
│       └── utils/cleaner.ts         # Strips tracking query params (?si=, ?igsh=)
│
├── backend/                         # 🗄️ Cloud Database & Notification Engine
│   ├── schema.sql                   # Complete PostgreSQL schema (RLS, indices, tables)
│   └── supabase/functions/notify-video-saved/
│       └── index.ts                 # Edge Function for instant FCM push alerts
│
└── mobile/                          # 📱 Mobile App (React Native / Expo)
    ├── package.json
    ├── app/index.tsx                # Main Watchlist Feed, Realtime Listener & Date Filter
    ├── components/
    │   ├── VideoCard.tsx            # Video card component with badges & tactile micro-interactions
    │   ├── ActivityCalendar.tsx     # 📅 Monthly Activity Calendar & Like Heatmap
    │   └── SkeletonCard.tsx         # ⏳ Motion-fluid Skeleton Pulse Loader
    ├── services/
    │   ├── supabase.ts              # Database connection
    │   ├── deepLink.ts              # Opens native YouTube (vnd.youtube:) & Instagram apps
    │   ├── notifications.ts         # FCM push notification registration
    │   └── dateAnalytics.ts         # 📊 Peak Day, Streaks, & Daily Activity aggregation
    ├── utils/
    │   └── motion.ts                # 🎬 Standard Motion System Tokens & Transitions
    └── types/video.ts               # Data contract definitions
```

---

## ✨ Key Features

- **🌐 Cross-Platform Browser Extension:** Automatically captures YouTube, Instagram, X (Twitter), Facebook, Reddit, LinkedIn, Pinterest, and TikTok saves/likes without manual copy-paste.
- **📅 Activity Calendar & Like Heatmap:** Visual monthly heatmap showing dates with the highest save activity (Peak Days 🔥, Streaks, and 1-tap Date Filtering).
- **⚡ Instant Realtime Sync:** Syncs within seconds via Supabase Realtime & FCM push notifications.
- **🎬 Fluid UI Motion System:** Micro-interactions on video cards, tactile feedback, accordion calendar expand/collapse, and pulse skeleton loading.
- **🚀 Native Deep Linking:** Opens saved videos directly in native mobile apps (`vnd.youtube:`, Instagram app).

---

## 🛠️ How to Run & Test

### 1. Load Extension in Browser (Chrome / Brave / Edge)

1. Open your browser and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the folder: `extension/` (or compiled `extension/dist`).
5. Open YouTube, Instagram, Twitter, etc., click **Like** or **Bookmark/Save** on any video. The extension will automatically capture the metadata and sync it.

### 2. Setup Backend (Supabase)

1. Create a free project on [Supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase and paste the contents of `backend/schema.sql`.
3. Copy your `Project URL` and `anon key` into the extension popup or mobile `.env`.

### 3. Run Mobile App

```bash
cd mobile
npm install
npm run start
```

Scan the QR code with Expo Go on your Android or iPhone.
