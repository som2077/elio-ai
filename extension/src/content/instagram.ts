import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Instagram Content Script initialized.');

let lastSavedUrl: string | null = null;
let lastSavedTime: number = 0;

/**
 * Modern floating HUD toast on Instagram to visually confirm video saved
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
    // Suppress DOM errors
  }
}

/**
 * Finds the nearest container for the Reel or Post
 */
function findInstagramContainer(actionElement: HTMLElement): HTMLElement {
  // 1. If in modal dialog
  const dialog = actionElement.closest('div[role="dialog"]');
  if (dialog) return dialog as HTMLElement;

  // 2. If inside an article (standard feed post)
  const article = actionElement.closest('article');
  if (article) return article as HTMLElement;

  // 3. If inside a section (Reels fullscreen / scroll snap container)
  const section = actionElement.closest('section');
  if (section) return section as HTMLElement;

  // 4. Walk up parent elements looking for the closest parent that contains a <video> element
  let parent = actionElement.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (parent.querySelector('video')) {
      return parent;
    }
    parent = parent.parentElement;
  }

  // 5. Fallback: find currently visible active video on screen
  const videos = Array.from(document.querySelectorAll('video'));
  const activeVideo = videos.find((v) => !v.paused && v.offsetHeight > 200);
  if (activeVideo) {
    const parentContainer =
      activeVideo.closest('section') ||
      activeVideo.closest('article') ||
      activeVideo.parentElement?.parentElement;
    if (parentContainer) return parentContainer as HTMLElement;
  }

  return document.body;
}

/**
 * Identifies the canonical URL of the Instagram Reel or Post
 */
function extractInstagramUrl(container: HTMLElement): string {
  const currentUrl = window.location.href;

  // 1. Check window.location.href first (often /reel/ID or /reels/ID on desktop)
  if (currentUrl.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/)) {
    return currentUrl;
  }

  // 2. Search inside the container for permalink anchor tags
  const permalinks = Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]'
    )
  );

  for (const a of permalinks) {
    const href = a.href;
    const match = href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (match && match[2]) {
      return href;
    }
  }

  // 3. Check for comments or timestamp links
  const commentLink = container.querySelector(
    'a[href*="/comments/"], a[href*="/audio/"]'
  ) as HTMLAnchorElement | null;
  if (commentLink && commentLink.href) {
    const match = commentLink.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (match && match[2]) {
      return `https://www.instagram.com/reel/${match[2]}/`;
    }
  }

  // 4. Check global document if there is any reel URL present in visible area
  const globalLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/reel/"], a[href*="/reels/"]')
  );
  for (const a of globalLinks) {
    const match = a.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (match && match[2]) {
      return a.href;
    }
  }

  return currentUrl;
}

/**
 * Extracts creator username
 */
function extractCreator(container: HTMLElement): string {
  const usernameSelectors = [
    'header a[role="link"]',
    'a.notranslate',
    'header a',
    'a[role="link"] span',
    'span._aacl._aaco._aacw',
  ];

  for (const sel of usernameSelectors) {
    const el = container.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && !text.includes(' ') && text.length > 1 && text.length < 35) {
      return text.startsWith('@') ? text : `@${text}`;
    }
  }

  // Scan anchors starting with /username/
  const anchors = Array.from(
    container.querySelectorAll<HTMLAnchorElement>('a[role="link"], a[href^="/"]')
  );
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const text = a.textContent?.trim() || '';
    if (
      href.startsWith('/') &&
      !href.includes('/reel') &&
      !href.includes('/reels') &&
      !href.includes('/p/') &&
      !href.includes('/explore') &&
      !href.includes('/direct') &&
      text &&
      !text.includes(' ') &&
      text.length > 1 &&
      text.length < 35
    ) {
      return text.startsWith('@') ? text : `@${text}`;
    }
  }

  return '@instagram_creator';
}

/**
 * Scrapes metadata of an Instagram Reel or Post
 */
function scrapeInstagramPost(actionElement: HTMLElement): SavedVideoPayload | null {
  const container = findInstagramContainer(actionElement);
  const postUrl = extractInstagramUrl(container);

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'instagram');
  if (!cleanUrl) return null;

  const creator = extractCreator(container);

  // Thumbnail extraction
  const videoEl = container.querySelector('video') as HTMLVideoElement | null;
  const imgEl = container.querySelector(
    'img[style*="object-fit"], img[crossorigin], div[role="button"] img'
  ) as HTMLImageElement | null;

  let thumbnail = videoEl?.poster || imgEl?.src || '';
  if (!thumbnail && videoEl && videoEl.src && !videoEl.src.startsWith('blob:')) {
    thumbnail = videoEl.src;
  }

  // Caption extraction
  const captionSelectors = [
    'h1',
    'span._aacl._aaco._aacu._aacx._aad7._aade',
    'div[class*="caption"]',
    'div[role="button"] + span',
    'ul li div span',
  ];

  let caption = '';
  for (const sel of captionSelectors) {
    const el = container.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 4 && text !== creator) {
      caption = text;
      break;
    }
  }

  const isReel = postUrl.includes('/reel') || Boolean(videoEl);

  if (!caption) {
    caption = isReel ? `Instagram Reel by ${creator}` : `Instagram Post by ${creator}`;
  }

  return {
    platform: 'instagram',
    category: isReel ? 'reel' : 'post',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: caption.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

/**
 * Dispatches video to background service worker and triggers UI toast
 */
function sendInstagramSync(payload: SavedVideoPayload) {
  const now = Date.now();
  if (payload.clean_url === lastSavedUrl && now - lastSavedTime < 3000) return;
  lastSavedUrl = payload.clean_url;
  lastSavedTime = now;

  try {
    if (!chrome?.runtime?.id) {
      console.warn('[Elio AI] Extension context invalidated.');
      return;
    }

    console.log('[Elio AI] 🚀 Sending Instagram Reel to Cloud:', payload);

    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, (response) => {
      if (chrome.runtime.lastError) {
        showElioToast('Saved to Elio AI', `"${(payload.title || 'Instagram Reel').slice(0, 32)}..."`, true);
        return;
      }

      if (response && response.synced) {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Instagram Reel').slice(0, 30)}..." synced to mobile`, true);
      } else if (response && response.reason === 'unauthenticated') {
        showElioToast('Saved Locally', 'Open extension to link with phone', false);
      } else {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Instagram Reel').slice(0, 30)}..."`, true);
      }
    });
  } catch (err) {
    console.error('[Elio AI] Error sending Instagram sync:', err);
  }
}

// 1. Direct click capture on Like and Bookmark buttons
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Check button or SVG matching like or bookmark
    const actionBtn = target.closest(
      'button, div[role="button"], span[role="link"], svg[aria-label]'
    ) as HTMLElement | null;
    if (!actionBtn) return;

    const svg = actionBtn.tagName.toLowerCase() === 'svg' ? actionBtn : actionBtn.querySelector('svg');
    const ariaLabel = (svg?.getAttribute('aria-label') || actionBtn.getAttribute('aria-label') || '').toLowerCase();

    // Check if it is a like or bookmark action
    const isLikeAction =
      ariaLabel === 'like' ||
      ariaLabel === 'gefällt mir' ||
      ariaLabel.includes('like') && !ariaLabel.includes('unlike');

    const isSaveAction =
      ariaLabel === 'save' ||
      ariaLabel === 'bookmark' ||
      (ariaLabel.includes('save') && !ariaLabel.includes('unsave')) ||
      (ariaLabel.includes('bookmark') && !ariaLabel.includes('remove'));

    if (isLikeAction || isSaveAction) {
      console.log(`[Elio AI] Detected Instagram like/save click: ${ariaLabel}`);
      setTimeout(() => {
        const payload = scrapeInstagramPost(actionBtn);
        if (payload) {
          sendInstagramSync(payload);
        }
      }, 300);
    }
  },
  true
);

// 2. Double click capture on video (Double tap to like)
document.addEventListener(
  'dblclick',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const isVideoOrReelArea =
      target.tagName.toLowerCase() === 'video' ||
      Boolean(target.closest('video')) ||
      Boolean(target.closest('section')) ||
      Boolean(target.closest('article'));

    if (isVideoOrReelArea) {
      console.log('[Elio AI] Detected Instagram double-click to like!');
      setTimeout(() => {
        const payload = scrapeInstagramPost(target);
        if (payload) {
          sendInstagramSync(payload);
        }
      }, 350);
    }
  },
  true
);

// 3. Keyboard shortcut 'L' listener (Instagram Web shortcut to like)
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'l' || event.key === 'L') {
      const activeEl = document.activeElement;
      // Ignore if user is typing in comment/search input
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      console.log("[Elio AI] Detected Instagram 'L' key like shortcut!");
      setTimeout(() => {
        const activeVideo = document.querySelector('video') as HTMLElement | null;
        if (activeVideo) {
          const payload = scrapeInstagramPost(activeVideo);
          if (payload) {
            sendInstagramSync(payload);
          }
        }
      }, 350);
    }
  },
  true
);

// 4. MutationObserver: Watches for red heart state changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const el = mutation.target as HTMLElement;
      if (!el) continue;

      const isSvg = el.tagName.toLowerCase() === 'svg';
      const svg = isSvg ? el : el.querySelector('svg');

      if (svg) {
        const ariaLabel = (svg.getAttribute('aria-label') || '').toLowerCase();
        const color = svg.getAttribute('color') || '';
        const fill = svg.getAttribute('fill') || '';

        // Instagram sets aria-label to 'Unlike' or changes color to Instagram red
        const isNowLiked =
          ariaLabel === 'unlike' ||
          color.includes('255, 48, 64') ||
          fill.includes('255, 48, 64') ||
          color.includes('#ff3040') ||
          fill.includes('#ff3040');

        if (isNowLiked) {
          const payload = scrapeInstagramPost(svg);
          if (payload) {
            sendInstagramSync(payload);
          }
        }
      }
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['aria-label', 'color', 'fill', 'class'],
});
