// Background Service Worker for Elio AI Extension (Manifest V3)

import { SavedVideoPayload } from '../utils/cleaner';
import {
  AuthSession,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from '../services/auth';

interface StorageData {
  syncEnabled?: boolean;
  recentSaves?: SavedVideoPayload[];
  authSession?: AuthSession;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Elio AI] Service Worker Initialized.');
  chrome.storage.local.get(['syncEnabled'], (result) => {
    if (result.syncEnabled === undefined) {
      chrome.storage.local.set({
        syncEnabled: true,
        recentSaves: [],
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'VIDEO_LIKED') {
    handleVideoLiked(message.payload);
    sendResponse({ received: true });
  }
  return true;
});

async function handleVideoLiked(video: SavedVideoPayload) {
  const data: StorageData = await chrome.storage.local.get([
    'syncEnabled',
    'recentSaves',
    'authSession',
  ]);

  if (data.syncEnabled === false) {
    console.log('[Elio AI] Sync paused by user.');
    return;
  }

  // Update recent cache in popup/storage
  const recent = data.recentSaves || [];
  const updatedRecent = [
    video,
    ...recent.filter((item) => item.clean_url !== video.clean_url),
  ].slice(0, 10);
  await chrome.storage.local.set({ recentSaves: updatedRecent });

  const authSession = data.authSession;

  // If not logged in, log warning and keep local recentSaves only
  if (!authSession || !authSession.user_id || !authSession.access_token) {
    console.warn(
      '[Elio AI] User not logged in. Video saved locally in recentSaves. Scan QR code in popup to link with mobile app.'
    );
    return;
  }

  try {
    const endpoint = DEFAULT_SUPABASE_URL;
    const secret = DEFAULT_SUPABASE_ANON_KEY;

    const syncPayload = {
      ...video,
      user_id: authSession.user_id,
    };

    const response = await fetch(`${endpoint}/rest/v1/saved_videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: secret,
        Authorization: `Bearer ${authSession.access_token}`,
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(syncPayload),
    });

    if (response.ok) {
      console.log(
        `[Elio AI] Video safely committed to cloud inbox for user ${authSession.email || authSession.user_id}`
      );
    } else {
      console.error('[Elio AI] Sync status code:', response.status);
    }
  } catch (err) {
    console.error('[Elio AI] Secure network error:', err);
  }
}
