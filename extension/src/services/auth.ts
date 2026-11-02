// Authentication service for Elio AI Browser Extension
// Handles dynamic QR code creation, cross-device Supabase linking, and session persistence

import * as QRCode from "qrcode";

export interface AuthSession {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface DeviceMetadata {
  device_id: string;
  device_name: string;
  browser_type: string;
  os_name: string;
}

export interface QRSession {
  qr_token: string;
  expires_at: string;
  universal_url: string;
}

function _d(b: string): string {
  try {
    return atob(b);
  } catch {
    return "";
  }
}

export const DEFAULT_SUPABASE_URL = "https://msphrcukcgfchodxhgot.supabase.co";

export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcGhyY3VrY2dmY2hvZHhoZ290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1ODkyNTksImV4cCI6MjEwOTE2NTI1OX0.gB69GOJ9z8r3EfcywfUoELsI1WoF11pEV1vJgbvc7xI";

/**
 * Returns the Universal Smart URL for mobile deep link redirect
 */
export function getUniversalSmartUrl(qrToken: string): string {
  return `https://msphrcukcgfchodxhgot.supabase.co/functions/v1/app-redirect?token=${qrToken}`;
}

/**
 * Returns or generates a persistent device UUID for this browser profile
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const data = await chrome.storage.local.get("device_id");
    if (data.device_id) {
      return data.device_id as string;
    }
    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ device_id: newId });
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Detects browser brand, OS, and friendly nickname for this browser profile
 */
export async function getDeviceMetadata(): Promise<DeviceMetadata> {
  const device_id = await getOrCreateDeviceId();

  // Detect browser type
  let browser_type = "Chrome";
  const ua = navigator.userAgent;
  if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === "function") {
    browser_type = "Brave";
  } else if (ua.includes("Edg/")) {
    browser_type = "Edge";
  } else if (ua.includes("OPR/") || ua.includes("Opera")) {
    browser_type = "Opera";
  } else if (ua.includes("Firefox")) {
    browser_type = "Firefox";
  }

  // Detect OS
  let os_name = "Linux";
  if (ua.includes("Win")) os_name = "Windows";
  else if (ua.includes("Mac")) os_name = "macOS";
  else if (ua.includes("CrOS")) os_name = "ChromeOS";
  else if (ua.includes("Android")) os_name = "Android";

  // Check custom user nickname
  let device_name = `${browser_type} on ${os_name}`;
  try {
    const custom = await chrome.storage.local.get("device_nickname");
    if (custom.device_nickname && typeof custom.device_nickname === "string") {
      device_name = custom.device_nickname.trim();
    }
  } catch {
    // Keep default name
  }

  return {
    device_id,
    device_name,
    browser_type,
    os_name,
  };
}

/**
 * Updates the friendly nickname of this browser extension instance
 */
export async function updateDeviceNickname(
  newName: string,
  endpoint: string = DEFAULT_SUPABASE_URL,
  apikey: string = DEFAULT_SUPABASE_ANON_KEY
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) return;

  await chrome.storage.local.set({ device_nickname: trimmed });

  // Sync to Supabase if logged in
  try {
    const session = await getAuthSession();
    const deviceId = await getOrCreateDeviceId();
    if (session?.user_id) {
      await fetch(
        `${endpoint}/rest/v1/linked_devices?device_id=eq.${encodeURIComponent(
          deviceId
        )}&user_id=eq.${encodeURIComponent(session.user_id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: apikey,
            Authorization: `Bearer ${apikey}`,
          },
          body: JSON.stringify({ device_name: trimmed }),
        }
      );
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Checks if this device has been revoked on mobile
 */
export async function checkDeviceRevocation(
  endpoint: string = DEFAULT_SUPABASE_URL,
  apikey: string = DEFAULT_SUPABASE_ANON_KEY
): Promise<boolean> {
  try {
    const session = await getAuthSession();
    if (!session?.user_id) return false;

    const deviceId = await getOrCreateDeviceId();
    const res = await fetch(
      `${endpoint}/rest/v1/linked_devices?device_id=eq.${encodeURIComponent(
        deviceId
      )}&user_id=eq.${encodeURIComponent(session.user_id)}&select=is_revoked`,
      {
        headers: {
          apikey: apikey,
          Authorization: `Bearer ${apikey}`,
        },
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].is_revoked === true) {
        console.warn("[Elio AI] Device has been revoked by user on mobile.");
        await logout();
        return true;
      }
    }
  } catch {
    // Suppress network notice
  }
  return false;
}

/**
 * Creates a pending row in Supabase qr_auth_sessions
 * status: 'pending', qr_token: randomUUID, expires_at: 15 mins from now
 * includes device_metadata for seamless multi-device recognition on mobile
 */
export async function createQRSession(
  endpoint: string = DEFAULT_SUPABASE_URL,
  apikey: string = DEFAULT_SUPABASE_ANON_KEY,
): Promise<QRSession> {
  const qr_token = crypto.randomUUID();
  // 15 minutes TTL for generous scanning buffer
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const universal_url = getUniversalSmartUrl(qr_token);
  const metadata = await getDeviceMetadata();

  let response = await fetch(`${endpoint}/rest/v1/qr_auth_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apikey,
      Authorization: `Bearer ${apikey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      qr_token,
      status: "pending",
      expires_at,
      device_metadata: metadata,
    }),
  });

  // If Supabase schema does not have device_metadata column yet, gracefully retry without it
  if (!response.ok && response.status === 400) {
    console.warn(
      "[Elio AI] Supabase schema does not have device_metadata column yet. Falling back..."
    );
    response = await fetch(`${endpoint}/rest/v1/qr_auth_sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apikey,
        Authorization: `Bearer ${apikey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        qr_token,
        status: "pending",
        expires_at,
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Failed to create QR session: ${response.status} - ${errText}`,
    );
  }

  return {
    qr_token,
    expires_at,
    universal_url,
  };
}

/**
 * Generates a QR Code Data URL string from a QR token or universal smart URL
 */
export async function generateQRCode(
  qrTokenOrUrl: string,
  options?: QRCode.QRCodeToDataURLOptions,
): Promise<string> {
  const url = qrTokenOrUrl.startsWith("http")
    ? qrTokenOrUrl
    : getUniversalSmartUrl(qrTokenOrUrl);

  return await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    ...options,
  });
}

/**
 * Renders the QR code directly onto a canvas element
 */
export async function renderQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  qrTokenOrUrl: string,
): Promise<void> {
  const url = qrTokenOrUrl.startsWith("http")
    ? qrTokenOrUrl
    : getUniversalSmartUrl(qrTokenOrUrl);

  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 170,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Listens for the session to be marked 'approved' in Supabase
 * When approved, persists authSession to chrome.storage.local and calls onApproved
 * Returns a cancel/unsubscribe function
 */
export function listenForApproval(
  endpoint: string = DEFAULT_SUPABASE_URL,
  apikey: string = DEFAULT_SUPABASE_ANON_KEY,
  qrToken: string,
  onApproved: (session: AuthSession) => void,
  onExpired?: () => void,
): () => void {
  let isCancelled = false;
  let timerId: any = null;

  const poll = async () => {
    if (isCancelled) return;

    try {
      const url = `${endpoint}/rest/v1/qr_auth_sessions?qr_token=eq.${encodeURIComponent(qrToken)}&select=*`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          apikey: apikey,
          Authorization: `Bearer ${apikey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn("[Elio AI Auth] Poll returned status:", response.status);
      } else {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const sessionRow = rows[0];

          // Check if approved
          if (sessionRow.status === "approved") {
            const payload = sessionRow.auth_payload || {};
            const authSession: AuthSession = {
              user_id: payload.user_id || sessionRow.user_id || "",
              email: payload.email || "",
              access_token: payload.access_token || "",
              refresh_token: payload.refresh_token || "",
            };

            await chrome.storage.local.set({ authSession });
            stop();
            onApproved(authSession);
            return;
          }

          // Check if expired
          const expiredByTime =
            sessionRow.expires_at &&
            new Date(sessionRow.expires_at).getTime() < Date.now();
          if (sessionRow.status === "expired" || expiredByTime) {
            stop();
            onExpired?.();
            return;
          }
        }
      }
    } catch (err) {
      if (!isCancelled) {
        console.error("[Elio AI Auth] Error checking approval status:", err);
      }
    }

    if (!isCancelled) {
      timerId = setTimeout(poll, 2000);
    }
  };

  // Start polling immediately
  poll();

  const stop = () => {
    isCancelled = true;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return stop;
}

/**
 * Gets current authSession from chrome.storage.local
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const result = await chrome.storage.local.get("authSession");
    return (result.authSession as AuthSession) || null;
  } catch (err) {
    console.error("[Elio AI Auth] Failed to read auth session:", err);
    return null;
  }
}

/**
 * Clears authSession from chrome.storage.local
 */
export async function logout(): Promise<void> {
  await chrome.storage.local.remove("authSession");
}
