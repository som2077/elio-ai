import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] YouTube Content Script initialized.');

let lastLikedUrl: string | null = null;

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
      const titleEl = activeShort.querySelector('h2.title yt-formatted-string, #overlay yt-formatted-string');
      title = titleEl?.textContent?.trim() || '';
      const creatorEl = activeShort.querySelector('#channel-name a, yt-formatted-string.ytd-channel-name');
      creator = creatorEl?.textContent?.trim() || '';
    }
  } else {
    const titleEl = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string, yt-formatted-string.ytd-watch-metadata'
    );
    title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();
    const creatorEl = document.querySelector(
      '#owner #channel-name a, #upload-info #channel-name a, ytd-channel-name a'
    );
    creator = creatorEl?.textContent?.trim() || '';
  }

  return {
    platform: 'youtube',
    category: isShort ? 'short' : 'video',
    original_url: rawUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title || document.title.replace(' - YouTube', '').trim(),
    creator_name: creator,
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

function sendSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastLikedUrl) return;
  lastLikedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) {
      // Extension context was invalidated (reloaded in background)
      return;
    }
    console.log('[Elio AI] 🚀 Sending video to Cloud & Mobile:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      // Suppress any unchecked runtime.lastError
      if (chrome.runtime.lastError) {
        // Ignored safely
      }
    });
  } catch {
    // Suppress context invalidated error cleanly
  }
}

// 1. Direct click capture on any like-related element
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const likeTarget = target.closest(
      'ytd-toggle-button-renderer, like-button-view-model, ytd-like-button-renderer, [aria-label*="like" i], [title*="like" i]'
    );

    if (likeTarget) {
      console.log('[Elio AI] Like button clicked directly!');
      setTimeout(() => {
        const payload = scrapeYouTubeDetails();
        if (payload) {
          sendSync(payload);
        }
      }, 300);
    }
  },
  true
);

// 2. MutationObserver fallback: Watches YouTube buttons for state changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const el = mutation.target as HTMLElement;
      if (
        (mutation.attributeName === 'aria-pressed' && el.getAttribute('aria-pressed') === 'true') ||
        (mutation.attributeName === 'class' && el.classList.contains('style-default-active'))
      ) {
        const isDislike = (el.getAttribute('aria-label') || '').toLowerCase().includes('dislike');
        if (!isDislike) {
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
