// Popup Controller for Elio AI Extension
// Manages dual view: Dynamic QR Code Linking & Authenticated Sync Dashboard

import {
  getAuthSession,
  createQRSession,
  renderQRCodeToCanvas,
  listenForApproval,
  logout,
  AuthSession,
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

  // Auth view elements
  const userEmail = document.getElementById("userEmail") as HTMLElement;
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
  const syncToggle = document.getElementById("syncToggle") as HTMLInputElement;
  const recentList = document.getElementById("recentList") as HTMLElement;

  /**
   * Initializes or updates popup based on current authentication state
   */
  async function init() {
    cleanupListeners();

    const session = await getAuthSession();

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

    // Load storage settings & recent clips
    const data: PopupStorageData = await chrome.storage.local.get([
      "syncEnabled",
      "recentSaves",
    ]);

    if (data.syncEnabled !== undefined) {
      syncToggle.checked = Boolean(data.syncEnabled);
    }

    renderRecentSaves(data.recentSaves || []);
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
      empty.innerHTML =
        "No clips captured yet.<br />Like any video on YouTube, X, Instagram, TikTok, FB, or Reddit.";
      recentList.appendChild(empty);
      return;
    }

    recentSaves.forEach((item: any) => {
      const a = document.createElement("a");
      a.className = "video-item";
      a.href = item.clean_url || "#";
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
        item.thumbnail_url || "https://via.placeholder.com/50x36?text=Clip";
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

    // Show loading overlay
    qrLoading.classList.remove("hidden");
    qrLoadingText.textContent = "Generating QR Code...";
    refreshQrBtn.classList.add("hidden");
    qrTimer.className = "qr-timer-pill";
    qrTimerText.textContent = "Expires in 05:00";

    try {
      // 1. Create session in Supabase qr_auth_sessions
      const session = await createQRSession();

      // 2. Render dynamic QR Code on canvas
      await renderQRCodeToCanvas(qrCanvas, session.qr_token);
      qrLoading.classList.add("hidden");

      // 3. Start 5-minute (300s) countdown timer
      startCountdown(new Date(session.expires_at).getTime());

      // 4. Listen for real-time mobile approval
      activeApprovalStop = listenForApproval(
        undefined,
        undefined,
        session.qr_token,
        async (approvedSession) => {
          cleanupListeners();
          showAuthenticatedView(approvedSession);
        },
        () => {
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
  function handleSessionExpired() {
    cleanupListeners();
    qrTimerText.textContent = "Session Expired";
    qrTimer.className = "qr-timer-pill expired";
    refreshQrBtn.classList.remove("hidden");
  }

  // Handle Refresh QR button click
  refreshQrBtn.addEventListener("click", () => {
    showUnauthenticatedView();
  });

  // Handle Logout button click
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.textContent = "Logging out...";
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
