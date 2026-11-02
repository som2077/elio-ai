import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] YouTube Content Script initialized.');

let lastLikedUrl: string | null = null;
let lastLikedTime: number = 0;

/**
 * Modern floating HUD toast on YouTube to visually confirm video saved
 */
function showElioToast(title: string, message: string, isSuccess: boolean = true) {
  try {
    let toast = document.getElementById('elio-ai-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'elio-ai-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 28px; height: 28px; border-radius: 8px; background: ${
          isSuccess ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 159, 10, 0.2)'
        }; display: flex; align-items: center; justify-content: center; font-size: 15px; color: ${
          isSuccess ? '#30d158' : '#ff9f0a'
        };">✦</div>
        <div>
          <div style="font-weight: 600; font-size: 13px; color: #ffffff; letter-spacing: -0.2px;">${title}</div>
          <div style="font-size: 11px; color: #a1a1aa; margin-top: 2px;">${message}</div>
        </div>
      </div>
    `;

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '32px',
      right: '32px',
      zIndex: '2147483647',
      backgroundColor: '#121216',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
      borderRadius: '14px',
      padding: '12px 18px',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      opacity: '1',
      transform: 'translateY(0)',
      pointerEvents: 'none',
    });

    setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
      }
    }, 4000);
  } catch {
    // Suppress DOM exceptions
  }
}

/**
 * Checks if an element is part of a dislike button
 */
function isDislikeElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.closest('dislike-button-view-model')) return true;
  const label = (el.getAttribute('aria-label') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  return label.includes('dislike') || title.includes('dislike');
}

/**
 * Checks if an element is part of a like button
 */
function isLikeElement(el: HTMLElement | null): boolean {
  if (!el || isDislikeElement(el)) return false;

  if (el.closest('like-button-view-model')) return true;
  if (el.closest('#segmented-like-button')) return true;
  if (el.closest('ytd-like-button-renderer')) return true;
  if (el.closest('ytd-toggle-button-renderer:not([is-dislike])')) return true;

  const label = (el.getAttribute('aria-label') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  return (
    (label.includes('like') && !label.includes('dislike')) ||
    (title.includes('like') && !title.includes('dislike'))
  );
}

/**
 * Returns true if the YouTube like button currently appears in an active/liked state
 */
function isCurrentlyLiked(buttonEl?: HTMLElement | null): boolean {
  if (buttonEl) {
    if (buttonEl.getAttribute('aria-pressed') === 'true') return true;
    if (buttonEl.classList.contains('style-default-active')) return true;
    if (buttonEl.querySelector('[aria-pressed="true"]')) return true;
  }

  // Check global watch page like button
  const watchLikeBtn = document.querySelector(
    'like-button-view-model button, #segmented-like-button button, ytd-like-button-renderer button'
  );
  if (watchLikeBtn?.getAttribute('aria-pressed') === 'true') return true;

  // Check active Short like button
  const shortLikeBtn = document.querySelector(
    'ytd-reel-video-renderer[is-active] like-button-view-model button, ytd-reel-video-renderer[is-active] #like-button button'
  );
  if (shortLikeBtn?.getAttribute('aria-pressed') === 'true') return true;

  return false;
}

/**
 * Scrapes metadata of the video currently playing
 */
function scrapeYouTubeDetails(): SavedVideoPayload | null {
  const rawUrl = window.location.href;
  const isShort = rawUrl.includes('/shorts/');
  const { cleanUrl, videoId } = cleanVideoUrl(rawUrl, 'youtube');

  if (!cleanUrl) return null;

  let title = '';
  let creator = '';
  let thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

  if (isShort) {
    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (activeShort) {
      const titleEl = activeShort.querySelector(
        'h2.title yt-formatted-string, #overlay yt-formatted-string, h2.title'
      );
      title = titleEl?.textContent?.trim() || '';
      const creatorEl = activeShort.querySelector(
        '#channel-name a, yt-formatted-string.ytd-channel-name a, yt-formatted-string.ytd-channel-name'
      );
      creator = creatorEl?.textContent?.trim() || '';
    }
  } else {
    const titleEl = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string, yt-formatted-string.ytd-watch-metadata, h1.title'
    );
    title = titleEl?.textContent?.trim() || '';

    const creatorEl = document.querySelector(
      '#owner #channel-name a, #upload-info #channel-name a, ytd-video-owner-renderer #channel-name a, ytd-channel-name a, #channel-name yt-formatted-string'
    );
    creator = creatorEl?.textContent?.trim() || '';
  }

  if (!title) {
    const metaTitle = document.querySelector('meta[name="title"]')?.getAttribute('content');
    title = metaTitle || document.title.replace(' - YouTube', '').trim();
  }

  return {
    platform: 'youtube',
    category: isShort ? 'short' : 'video',
    original_url: rawUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title || 'Liked YouTube Video',
    creator_name: creator || 'YouTube Creator',
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

/**
 * Dispatches video to background service worker and triggers UI toast
 */
function sendSync(payload: SavedVideoPayload) {
  const now = Date.now();
  // Debounce duplicate calls on same video within 3 seconds
  if (payload.clean_url === lastLikedUrl && now - lastLikedTime < 3000) {
    return;
  }
  lastLikedUrl = payload.clean_url;
  lastLikedTime = now;

  try {
    if (!chrome?.runtime?.id) {
      console.warn('[Elio AI] Extension context invalidated.');
      return;
    }

    console.log('[Elio AI] 🚀 Sending liked video to background worker:', payload);

    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Elio AI] Background message warning:', chrome.runtime.lastError.message);
        showElioToast('Saved to Elio AI', payload.title ? `"${payload.title.slice(0, 35)}..."` : 'Video saved locally', true);
        return;
      }

      if (response && response.synced) {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Video').slice(0, 32)}..." synced to mobile`, true);
      } else if (response && response.reason === 'unauthenticated') {
        showElioToast('Saved Locally', 'Open extension to link with your phone', false);
      } else {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Video').slice(0, 32)}..."`, true);
      }
    });
  } catch (err) {
    console.error('[Elio AI] Error sending sync:', err);
  }
}

// 1. Direct click capture on like buttons
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Reject dislikes immediately
    if (isDislikeElement(target)) return;

    if (isLikeElement(target)) {
      console.log('[Elio AI] Like button interaction detected!');
      const wasAlreadyLiked = isCurrentlyLiked(target);

      // If user is clicking to like (not unliking)
      if (!wasAlreadyLiked) {
        // Optimistic / verified check
        setTimeout(() => {
          const payload = scrapeYouTubeDetails();
          if (payload) {
            sendSync(payload);
          }
        }, 300);
      }
    }
  },
  true
);

// 2. MutationObserver: Watches for aria-pressed="true" attribute transitions
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const el = mutation.target as HTMLElement;
      if (!el || isDislikeElement(el)) continue;

      if (
        (mutation.attributeName === 'aria-pressed' && el.getAttribute('aria-pressed') === 'true') ||
        (mutation.attributeName === 'class' && el.classList.contains('style-default-active'))
      ) {
        if (isLikeElement(el)) {
          console.log('[Elio AI] Like button state confirmed active via DOM mutation.');
          const payload = scrapeYouTubeDetails();
          if (payload) {
            sendSync(payload);
          }
        }
      }
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['aria-pressed', 'class'],
});
