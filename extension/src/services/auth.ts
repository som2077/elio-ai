// Authentication service for Elio AI Browser Extension
// Handles dynamic QR code creation, cross-device Supabase linking, and session persistence

import * as QRCode from "qrcode";

export interface AuthSession {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
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

export const DEFAULT_SUPABASE_URL =
  _d("aHR0cHM6Ly9vb2xkc3FrdXh3dnpubnlwdW14ZC5zdXBhYmFzZS5jbw==") ||
  "https://ooldsqkuxwvznnypumxd.supabase.co";

export const DEFAULT_SUPABASE_ANON_KEY = _d(
  "ZXlKaGJHY2lPaUpJVXpJMU5pSXNOblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2paa1hCaHltRnpaU0lzSW5KbFppSTZJbTkxYkdSemNXRjFlbTV1ZVhCMWJYaGtJbXcwWVNJNk1UYzVNVE00TkRFek55d2laWGh3SWpveU1UQTJNelEwTVRNM2ZRLkJpTG9VOWJqZjlMNWFFRUZUb1N2SVNFM3U5cWVvaWQ2VTd5bldNZkFyVG8=",
);

/**
 * Returns the Universal Smart URL for mobile deep link redirect
 */
export function getUniversalSmartUrl(qrToken: string): string {
  return `https://ooldsqkuxwvznnypumxd.supabase.co/functions/v1/app-redirect?token=${qrToken}`;
}

/**
 * Creates a pending row in Supabase qr_auth_sessions
 * status: 'pending', qr_token: randomUUID, expires_at: 5 mins from now
 */
export async function createQRSession(
  endpoint: string = DEFAULT_SUPABASE_URL,
  apikey: string = DEFAULT_SUPABASE_ANON_KEY,
): Promise<QRSession> {
  const qr_token = crypto.randomUUID();
  const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const universal_url = getUniversalSmartUrl(qr_token);

  const response = await fetch(`${endpoint}/rest/v1/qr_auth_sessions`, {
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

  // Start polling after 1.5 seconds
  timerId = setTimeout(poll, 1500);

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
