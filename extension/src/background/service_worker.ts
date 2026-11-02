// Background Service Worker for Elio AI Extension (Manifest V3)

import { SavedVideoPayload } from '../utils/cleaner';
import {
  AuthSession,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  getDeviceMetadata,
  checkDeviceRevocation,
  logout,
  refreshAuthSession,
} from '../services/auth';

interface StorageData {
  syncEnabled?: boolean;
  recentSaves?: SavedVideoPayload[];
  pendingSyncQueue?: SavedVideoPayload[];
  authSession?: AuthSession;
  activeQRSession?: { qr_token: string; expires_at: string };
}

let approvalPollInterval: any = null;

// Initialize on installed / updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Elio AI] Service Worker Initialized.');
  chrome.storage.local.get(['syncEnabled', 'recentSaves', 'pendingSyncQueue'], (result) => {
    chrome.storage.local.set({
      syncEnabled: result.syncEnabled !== false,
      recentSaves: result.recentSaves || [],
      pendingSyncQueue: result.pendingSyncQueue || [],
    });
  });

  // Inject content scripts into already-opened supported tabs
  injectScriptsIntoExistingTabs();
  // Start polling in background if a QR session was waiting
  checkBackgroundApproval();
});

// Watch storage changes: if authSession is added, flush pending queue immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.authSession?.newValue) {
      console.log('[Elio AI] New auth session detected. Flushing pending videos...');
      flushPendingSyncQueue();
    }
    if (changes.activeQRSession?.newValue) {
      checkBackgroundApproval();
    }
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'VIDEO_LIKED') {
    handleVideoLiked(message.payload).then((result) => {
      sendResponse(result);
    });
    return true; // Keep message port open for async response
  }

  if (message.type === 'CHECK_AUTH_APPROVAL') {
    checkBackgroundApproval().then((session) => {
      sendResponse({ approved: Boolean(session), session });
    });
    return true;
  }

  return true;
});

/**
 * Injects content scripts into active YouTube, Instagram, and social tabs so users don't have to manually refresh
 */
async function injectScriptsIntoExistingTabs() {
  const targets = [
    { urls: ['*://*.youtube.com/*'], file: 'dist/content/youtube.js' },
    { urls: ['*://*.instagram.com/*'], file: 'dist/content/instagram.js' },
    { urls: ['*://*.twitter.com/*', '*://*.x.com/*'], file: 'dist/content/twitter.js' },
    { urls: ['*://*.reddit.com/*'], file: 'dist/content/reddit.js' },
    { urls: ['*://*.tiktok.com/*'], file: 'dist/content/tiktok.js' },
  ];

  for (const target of targets) {
    try {
      const tabs = await chrome.tabs.query({ url: target.urls });
      for (const tab of tabs) {
        if (tab.id && !tab.url?.includes('chrome-extension://')) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: [target.file],
            })
            .catch(() => {
              // Tab might be in restricted state or navigating
            });
        }
      }
    } catch (err) {
      console.warn('[Elio AI] Tab injection notice for', target.file, err);
    }
  }
}

/**
 * Checks Supabase to see if the current activeQRSession has been approved by mobile
 */
async function checkBackgroundApproval(): Promise<AuthSession | null> {
  const { activeQRSession, authSession } = await chrome.storage.local.get([
    'activeQRSession',
    'authSession',
  ]);

  if (authSession?.user_id && authSession?.access_token) {
    return authSession;
  }

  if (!activeQRSession || !activeQRSession.qr_token) {
    return null;
  }

  // If expired, stop
  if (new Date(activeQRSession.expires_at).getTime() < Date.now()) {
    return null;
  }

  try {
    const url = `${DEFAULT_SUPABASE_URL}/rest/v1/qr_auth_sessions?qr_token=eq.${encodeURIComponent(
      activeQRSession.qr_token
    )}&select=*`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: DEFAULT_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].status === 'approved') {
        const row = rows[0];
        const payload = row.auth_payload || {};
        const newSession: AuthSession = {
          user_id: payload.user_id || row.user_id || '',
          email: payload.email || '',
          access_token: payload.access_token || '',
          refresh_token: payload.refresh_token || '',
        };

        if (newSession.user_id && newSession.access_token) {
          console.log('[Elio AI] Background approval confirmed for:', newSession.email);
          await chrome.storage.local.set({ authSession: newSession });
          await chrome.storage.local.remove('activeQRSession');
          await flushPendingSyncQueue();
          return newSession;
        }
      }
    }
  } catch (err) {
    console.warn('[Elio AI] Background approval check error:', err);
  }

  // Start polling if not already started
  if (!approvalPollInterval) {
    approvalPollInterval = setInterval(async () => {
      const approved = await checkBackgroundApproval();
      if (approved || !approvalPollInterval) {
        clearInterval(approvalPollInterval);
        approvalPollInterval = null;
      }
    }, 2500);
  }

  return null;
}

/**
 * Handles incoming video like event from content scripts
 */
async function handleVideoLiked(
  video: SavedVideoPayload
): Promise<{ synced: boolean; reason?: string }> {
  const data: StorageData = await chrome.storage.local.get([
    'syncEnabled',
    'recentSaves',
    'pendingSyncQueue',
    'authSession',
  ]);

  if (data.syncEnabled === false) {
    console.log('[Elio AI] Sync paused by user toggle.');
    return { synced: false, reason: 'sync_disabled' };
  }

  // Update recent saves locally
  const recent = data.recentSaves || [];
  const updatedRecent = [
    video,
    ...recent.filter((item) => item.clean_url !== video.clean_url),
  ].slice(0, 15);
  await chrome.storage.local.set({ recentSaves: updatedRecent });

  // Check auth session, or check if activeQRSession was approved
  let authSession = data.authSession;
  if (!authSession || !authSession.user_id || !authSession.access_token) {
    authSession = (await checkBackgroundApproval()) || undefined;
  }

  // If still unauthenticated, queue for offline sync
  if (!authSession || !authSession.user_id || !authSession.access_token) {
    console.warn('[Elio AI] User not logged in. Queueing video for sync upon login.');
    const queue = data.pendingSyncQueue || [];
    if (!queue.some((item) => item.clean_url === video.clean_url)) {
      await chrome.storage.local.set({ pendingSyncQueue: [...queue, video] });
    }
    return { synced: false, reason: 'unauthenticated' };
  }

  // POST directly to Supabase
  const success = await postVideoToSupabase(video, authSession);
  return { synced: success };
}

/**
 * Inserts a video record into public.saved_videos
 */
async function postVideoToSupabase(
  video: SavedVideoPayload,
  authSession: AuthSession
): Promise<boolean> {
  try {
    // Check revocation first
    const isRevoked = await checkDeviceRevocation();
    if (isRevoked) {
      console.warn('[Elio AI] Device has been revoked. Sync cancelled.');
      return false;
    }

    const endpoint = DEFAULT_SUPABASE_URL;
    const secret = DEFAULT_SUPABASE_ANON_KEY;
    const metadata = await getDeviceMetadata();

    const syncPayload = {
      ...video,
      user_id: authSession.user_id,
      device_id: metadata.device_id,
      source_device_name: metadata.device_name,
    };

    let authToken = authSession.access_token || secret;

    let response = await fetch(`${endpoint}/rest/v1/saved_videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: secret,
        Authorization: `Bearer ${authToken}`,
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(syncPayload),
    });

    // If 400 Bad Request (e.g. device_id column not in schema cache yet), retry without device fields
    if (response.status === 400) {
      console.warn('[Elio AI] Supabase schema does not have device columns yet. Retrying standard payload...');
      const fallbackPayload = {
        ...video,
        user_id: authSession.user_id,
      };
      delete (fallbackPayload as any).device_id;
      delete (fallbackPayload as any).source_device_name;

      response = await fetch(`${endpoint}/rest/v1/saved_videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: secret,
          Authorization: `Bearer ${authToken}`,
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify(fallbackPayload),
      });
    }

    // If 401 Unauthorized (access_token expired), refresh session and retry with fresh token
    if (response.status === 401) {
      console.warn('[Elio AI] User access token expired (401). Refreshing session...');
      const refreshed = await refreshAuthSession(endpoint, secret);
      if (refreshed?.access_token) {
        authToken = refreshed.access_token;
        authSession = refreshed;
        response = await fetch(`${endpoint}/rest/v1/saved_videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: secret,
            Authorization: `Bearer ${authToken}`,
            Prefer: 'resolution=ignore-duplicates',
          },
          body: JSON.stringify({
            ...syncPayload,
            user_id: refreshed.user_id,
          }),
        });

        // Retry fallback if needed
        if (response.status === 400) {
          const fallbackPayload = { ...video, user_id: refreshed.user_id };
          delete (fallbackPayload as any).device_id;
          delete (fallbackPayload as any).source_device_name;
          response = await fetch(`${endpoint}/rest/v1/saved_videos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: secret,
              Authorization: `Bearer ${authToken}`,
              Prefer: 'resolution=ignore-duplicates',
            },
            body: JSON.stringify(fallbackPayload),
          });
        }
      }
    }

    if (response.ok) {
      console.log(
        `[Elio AI] Video safely committed from ${metadata.device_name} for user ${
          authSession.email || authSession.user_id
        }`
      );

      // Heartbeat: Upsert last_active_at on linked_devices (non-blocking)
      try {
        fetch(`${endpoint}/rest/v1/linked_devices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: secret,
            Authorization: `Bearer ${authToken || secret}`,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id: authSession.user_id,
            device_id: metadata.device_id,
            device_name: metadata.device_name,
            browser_type: metadata.browser_type,
            os_name: metadata.os_name,
            last_active_at: new Date().toISOString(),
            is_revoked: false,
          }),
        }).catch(() => {});
      } catch {
        // Non-blocking
      }

      return true;
    } else {
      console.error('[Elio AI] Supabase sync returned status:', response.status);
      return false;
    }
  } catch (err) {
    console.error('[Elio AI] Network error during video sync:', err);
    return false;
  }
}

/**
 * Flushes all pending unsynced videos when authenticated
 */
async function flushPendingSyncQueue() {
  const data: StorageData = await chrome.storage.local.get([
    'pendingSyncQueue',
    'recentSaves',
    'authSession',
  ]);

  const authSession = data.authSession;
  if (!authSession || !authSession.user_id || !authSession.access_token) return;

  const queue = [
    ...(data.pendingSyncQueue || []),
    ...(data.recentSaves || []),
  ];

  if (queue.length === 0) return;

  // Deduplicate by clean_url
  const uniqueVideos = Array.from(new Map(queue.map((v) => [v.clean_url, v])).values());

  console.log(`[Elio AI] Syncing ${uniqueVideos.length} offline/recent video(s) to cloud...`);

  for (const video of uniqueVideos) {
    await postVideoToSupabase(video, authSession);
  }

  await chrome.storage.local.set({ pendingSyncQueue: [] });
}
