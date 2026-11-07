// Popup Controller for Elio AI Extension
// Manages dual view: Dynamic QR Code Linking & Authenticated Sync Dashboard

import {
  getAuthSession,
  createQRSession,
  renderQRCodeToCanvas,
  listenForApproval,
  logout,
  AuthSession,
  getDeviceMetadata,
  updateDeviceNickname,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from "../services/auth";

interface PopupStorageData {
  syncEnabled?: boolean;
  recentSaves?: any[];
}

let activeApprovalStop: (() => void) | null = null;
let activeCountdownInterval: any = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Common header elements
  const liveDot = document.getElementById("liveDot") as HTMLElement;
  const liveStatusText = document.getElementById(
    "liveStatusText",
  ) as HTMLElement;

  // View containers
  const unauthView = document.getElementById("unauthView") as HTMLElement;
  const authView = document.getElementById("authView") as HTMLElement;

  // Unauth view elements
  const qrCanvas = document.getElementById("qrCanvas") as HTMLCanvasElement;
  const qrLoading = document.getElementById("qrLoading") as HTMLElement;
  const qrLoadingText = document.getElementById("qrLoadingText") as HTMLElement;
  const qrTimer = document.getElementById("qrTimer") as HTMLElement;
  const qrTimerText = document.getElementById("qrTimerText") as HTMLElement;
  const refreshQrBtn = document.getElementById(
    "refreshQrBtn",
  ) as HTMLButtonElement;
  const unauthDeviceName = document.getElementById("unauthDeviceName") as HTMLElement;

  // Auth view elements
  const userEmail = document.getElementById("userEmail") as HTMLElement;
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
  const syncToggle = document.getElementById("syncToggle") as HTMLInputElement;
  const recentList = document.getElementById("recentList") as HTMLElement;
  const deviceNameLabel = document.getElementById("deviceNameLabel") as HTMLElement;
  const renameDeviceBtn = document.getElementById("renameDeviceBtn") as HTMLButtonElement;

  // Setup device nickname rename handler
  renameDeviceBtn?.addEventListener("click", async () => {
    const meta = await getDeviceMetadata();
    const newName = prompt("Enter a nickname for this browser extension:", meta.device_name);
    if (newName && newName.trim() && newName.trim() !== meta.device_name) {
      await updateDeviceNickname(newName.trim());
      if (deviceNameLabel) deviceNameLabel.textContent = newName.trim();
      if (unauthDeviceName) unauthDeviceName.textContent = newName.trim();
    }
  });

  /**
   * Initializes or updates popup based on current authentication state
   */
  async function init() {
    cleanupListeners();

    let session = await getAuthSession();

    // If not in local storage yet, check if pending activeQRSession was approved on Supabase
    if (!session || !session.user_id) {
      try {
        const stored = await chrome.storage.local.get("activeQRSession");
        if (stored.activeQRSession?.qr_token) {
          const res = await fetch(
            `${DEFAULT_SUPABASE_URL}/rest/v1/qr_auth_sessions?qr_token=eq.${encodeURIComponent(
              stored.activeQRSession.qr_token
            )}&select=*`,
            {
              headers: {
                apikey: DEFAULT_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
                Accept: "application/json",
              },
            }
          );
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0 && rows[0].status === "approved") {
              const row = rows[0];
              const payload = row.auth_payload || {};
              session = {
                user_id: payload.user_id || row.user_id || "",
                email: payload.email || "",
                access_token: payload.access_token || "",
                refresh_token: payload.refresh_token || "",
              };
              if (session.user_id && session.access_token) {
                await chrome.storage.local.set({ authSession: session });
                await chrome.storage.local.remove("activeQRSession");
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Elio AI] Direct session check notice:", err);
      }
    }

    if (session && session.user_id) {
      showAuthenticatedView(session);
    } else {
      showUnauthenticatedView();
    }
  }

  /**
   * Cleans up active polling and countdown intervals
   */
  function cleanupListeners() {
    if (activeApprovalStop) {
      activeApprovalStop();
      activeApprovalStop = null;
    }
    if (activeCountdownInterval) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
    }
  }

  /**
   * Renders the Authenticated View
   */
  async function showAuthenticatedView(session: AuthSession) {
    unauthView.classList.add("hidden");
    authView.classList.remove("hidden");

    liveDot.classList.remove("dot-pending");
    liveStatusText.textContent = "SYNC ACTIVE";

    userEmail.textContent = session.email || "Linked Mobile Device";

    const meta = await getDeviceMetadata();
    if (deviceNameLabel) deviceNameLabel.textContent = meta.device_name;

    // Load storage settings & recent clips
    const data: PopupStorageData = await chrome.storage.local.get([
      "syncEnabled",
      "recentSaves",
    ]);

    if (data.syncEnabled !== undefined) {
      syncToggle.checked = Boolean(data.syncEnabled);
    }

    renderRecentSaves(data.recentSaves || []);

    // Proactively sync and display the latest videos from Supabase
    if (session.access_token && session.user_id) {
      try {
        const resp = await fetch(
          `${DEFAULT_SUPABASE_URL}/rest/v1/saved_videos?user_id=eq.${session.user_id}&order=created_at.desc&limit=15`,
          {
            headers: {
              apikey: DEFAULT_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
              Accept: "application/json",
            },
          }
        );
        if (resp.ok) {
          const cloudVideos = await resp.json();
          if (Array.isArray(cloudVideos) && cloudVideos.length > 0) {
            renderRecentSaves(cloudVideos);
            await chrome.storage.local.set({ recentSaves: cloudVideos });
          }
        }
      } catch (err) {
        // Suppress network notice; local recentSaves already visible
      }
    }
  }

  function isSafeHttpUrl(url: string | undefined): boolean {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim().toLowerCase();
    return trimmed.startsWith("https://") || trimmed.startsWith("http://");
  }

  /**
   * Renders recent saves list with platform badges
   */
  function renderRecentSaves(recentSaves: any[]) {
    while (recentList.firstChild) {
      recentList.removeChild(recentList.firstChild);
    }

    if (!Array.isArray(recentSaves) || recentSaves.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent =
        "No clips captured yet. Like any video on YouTube, X, Instagram, TikTok, FB, or Reddit.";
      recentList.appendChild(empty);
      return;
    }

    recentSaves.forEach((item: any) => {
      const a = document.createElement("a");
      a.className = "video-item";
      // Security: Only allow safe http(s) links to prevent extension privilege escalation
      a.href = isSafeHttpUrl(item.clean_url) ? item.clean_url : "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      let badgeText = "VIDEO";
      const p = (item.platform || "").toLowerCase();
      if (p === "youtube") badgeText = "YT";
      else if (p === "instagram") badgeText = "IG";
      else if (p === "twitter") badgeText = "𝕏";
      else if (p === "facebook") badgeText = "FB";
      else if (p === "tiktok") badgeText = "TT";
      else if (p === "reddit") badgeText = "RD";
      else if (p === "linkedin") badgeText = "IN";
      else if (p === "pinterest") badgeText = "PIN";

      const img = document.createElement("img");
      img.className = "thumbnail";
      img.src =
        isSafeHttpUrl(item.thumbnail_url)
          ? item.thumbnail_url
          : "https://via.placeholder.com/50x36?text=Clip";
      img.alt = "";
      img.onerror = () => {
        img.src = "https://via.placeholder.com/50x36?text=Clip";
      };

      const infoDiv = document.createElement("div");
      infoDiv.className = "video-info";

      const titleDiv = document.createElement("div");
      titleDiv.className = "video-title";
      titleDiv.textContent = item.title || "Liked Social Video";

      const metaDiv = document.createElement("div");
      metaDiv.className = "video-meta";

      const badgeSpan = document.createElement("span");
      badgeSpan.className = "badge";
      badgeSpan.textContent = badgeText;

      metaDiv.appendChild(badgeSpan);
      if (item.creator_name) {
        metaDiv.appendChild(document.createTextNode(` ${item.creator_name}`));
      }

      infoDiv.appendChild(titleDiv);
      infoDiv.appendChild(metaDiv);

      a.appendChild(img);
      a.appendChild(infoDiv);

      recentList.appendChild(a);
    });
  }

  /**
   * Renders the Unauthenticated Dynamic QR Code View
   */
  async function showUnauthenticatedView() {
    authView.classList.add("hidden");
    unauthView.classList.remove("hidden");

    liveDot.classList.add("dot-pending");
    liveStatusText.textContent = "SCAN QR";

    const meta = await getDeviceMetadata();
    if (unauthDeviceName) unauthDeviceName.textContent = meta.device_name;

    // Show loading overlay
    qrLoading.classList.remove("hidden");
    qrLoadingText.textContent = "Generating QR Code...";
    refreshQrBtn.classList.add("hidden");
    qrTimer.className = "qr-timer-pill";
    qrTimerText.textContent = "Expires in 05:00";

    try {
      // 1. Check if we already have an active pending QR session in storage
      const stored = await chrome.storage.local.get("activeQRSession");
      let session = stored.activeQRSession;
      const now = Date.now();
      const isExpired =
        !session ||
        !session.expires_at ||
        new Date(session.expires_at).getTime() <= now + 15000;

      if (isExpired) {
        session = await createQRSession();
        await chrome.storage.local.set({ activeQRSession: session });
      }

      // 2. Render dynamic QR Code on canvas
      await renderQRCodeToCanvas(qrCanvas, session.qr_token);
      qrLoading.classList.add("hidden");

      // 3. Start 5-minute countdown timer
      startCountdown(new Date(session.expires_at).getTime());

      // 4. Listen for real-time mobile approval
      activeApprovalStop = listenForApproval(
        undefined,
        undefined,
        session.qr_token,
        async (approvedSession) => {
          await chrome.storage.local.remove("activeQRSession");
          cleanupListeners();
          showAuthenticatedView(approvedSession);
        },
        async () => {
          await chrome.storage.local.remove("activeQRSession");
          handleSessionExpired();
        },
      );
    } catch (err: any) {
      console.error("[Elio AI] Failed to generate QR session:", err);
      qrLoadingText.textContent = "Connection Error";
      refreshQrBtn.classList.remove("hidden");
    }
  }

  /**
   * Countdown timer for QR code session expiration
   */
  function startCountdown(expiresAtTimestamp: number) {
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);

    const updateTimer = () => {
      const remainingMs = expiresAtTimestamp - Date.now();
      if (remainingMs <= 0) {
        handleSessionExpired();
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      qrTimerText.textContent = `Expires in ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

      if (totalSeconds < 60) {
        qrTimer.className = "qr-timer-pill expiring-soon";
      } else {
        qrTimer.className = "qr-timer-pill";
      }
    };

    updateTimer();
    activeCountdownInterval = setInterval(updateTimer, 1000);
  }

  /**
   * Handles session expiration UI
   */
  async function handleSessionExpired() {
    cleanupListeners();
    await chrome.storage.local.remove("activeQRSession");
    qrTimerText.textContent = "Session Expired";
    qrTimer.className = "qr-timer-pill expired";
    refreshQrBtn.classList.remove("hidden");
  }

  // Handle Refresh QR button click
  refreshQrBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove("activeQRSession");
    showUnauthenticatedView();
  });

  // Handle Logout button click
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.textContent = "Logging out...";
    await chrome.storage.local.remove(["authSession", "activeQRSession"]);
    await logout();
    logoutBtn.textContent = "Logout";
    showUnauthenticatedView();
  });

  // Handle Auto-Sync toggle
  syncToggle.addEventListener("change", () => {
    chrome.storage.local.set({ syncEnabled: syncToggle.checked });
  });

  // Listen for storage changes in background (e.g. recent saves or auth updates)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.recentSaves && !authView.classList.contains("hidden")) {
        renderRecentSaves((changes.recentSaves.newValue as any[]) || []);
      }
      if (changes.authSession) {
        if (!changes.authSession.newValue) {
          showUnauthenticatedView();
        } else if (unauthView.classList.contains("hidden") === false) {
          showAuthenticatedView(changes.authSession.newValue as AuthSession);
        }
      }
    }
  });

  // Initial load
  await init();
});
