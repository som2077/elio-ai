import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Instagram Content Script initialized.');

let lastSavedUrl: string | null = null;
let lastSavedTime: number = 0;

/**
 * Modern floating HUD toast on Instagram to visually confirm video/post saved
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
 * Universal container locator for modern Instagram Web (Reels, Posts, Carousels, Modals)
 */
function findPostOrReelContainer(actionElement: HTMLElement): HTMLElement {
  // 1. If in a modal dialog
  const dialog = actionElement.closest('div[role="dialog"]');
  if (dialog) return dialog as HTMLElement;

  // 2. If inside a traditional article or section
  const article = actionElement.closest('article, section');
  if (article) return article as HTMLElement;

  // 3. Walk up parents to find the nearest element holding this post's media and permalink
  let current: HTMLElement | null = actionElement;
  let candidateContainer: HTMLElement | null = null;

  while (current && current !== document.body && current !== document.documentElement) {
    const hasMedia = current.querySelector('video, img');
    const hasPostLink = current.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], time');

    if (hasMedia && hasPostLink) {
      candidateContainer = current;
      if (
        current.tagName === 'ARTICLE' ||
        current.tagName === 'SECTION' ||
        current.getAttribute('role') === 'presentation' ||
        (current.offsetHeight > 300 && current.offsetWidth > 300)
      ) {
        return current;
      }
    }
    current = current.parentElement;
  }

  if (candidateContainer) return candidateContainer;

  // 4. Fallback: find active video on screen if currently watching Reels
  const videos = Array.from(document.querySelectorAll('video'));
  const activeVideo = videos.find((v) => !v.paused && v.offsetHeight > 200);
  if (activeVideo) {
    const parent =
      activeVideo.closest('section') ||
      activeVideo.closest('article') ||
      activeVideo.parentElement?.parentElement;
    if (parent) return parent as HTMLElement;
  }

  return document.body;
}

/**
 * Exhaustive post URL finder: searches upward through parents for <time> anchor or permalinks
 */
function findInstagramPostUrl(actionElement: HTMLElement): string | null {
  const currentUrl = window.location.href;
  const urlMatch = currentUrl.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[2]) {
    if (!currentUrl.endsWith('/reels/') && !currentUrl.endsWith('/reels')) {
      const type = urlMatch[1] === 'reels' ? 'reel' : urlMatch[1];
      return `https://www.instagram.com/${type}/${urlMatch[2]}/`;
    }
  }

  let curr: HTMLElement | null = actionElement;
  for (let i = 0; i < 15 && curr && curr !== document.body; i++) {
    // Check for <time> tag
    const timeEl = curr.querySelector('time');
    if (timeEl) {
      const timeAnchor = (timeEl.closest('a') || timeEl.parentElement?.closest('a')) as HTMLAnchorElement | null;
      if (timeAnchor?.href) {
        const m = timeAnchor.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
        if (m && m[2]) {
          const type = m[1] === 'reels' ? 'reel' : m[1];
          return `https://www.instagram.com/${type}/${m[2]}/`;
        }
      }
    }

    // Check for any /p/, /reel/, /reels/ anchor
    const postAnchors = Array.from(
      curr.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]')
    );
    for (const a of postAnchors) {
      const href = a.href || a.getAttribute('href') || '';
      const m = href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
      if (m && m[2]) {
        const type = m[1] === 'reels' ? 'reel' : m[1];
        return `https://www.instagram.com/${type}/${m[2]}/`;
      }
    }

    curr = curr.parentElement;
  }

  if (urlMatch && urlMatch[2]) {
    const type = urlMatch[1] === 'reels' ? 'reel' : urlMatch[1];
    return `https://www.instagram.com/${type}/${urlMatch[2]}/`;
  }

  return null;
}

/**
 * Extracts the canonical URL of the Instagram Reel or Post
 */
function extractInstagramPermalink(actionElement: HTMLElement, container: HTMLElement): string {
  const currentUrl = window.location.href;

  const directMatch = currentUrl.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
  if (directMatch && directMatch[2]) {
    if (!currentUrl.endsWith('/reels/') && !currentUrl.endsWith('/reels')) {
      const type = directMatch[1] === 'reels' ? 'reel' : directMatch[1];
      return `https://www.instagram.com/${type}/${directMatch[2]}/`;
    }
  }

  const timeEl = container.querySelector('time');
  const timeAnchor = timeEl?.closest('a') as HTMLAnchorElement | null;
  if (timeAnchor && timeAnchor.href) {
    const match = timeAnchor.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (match && match[2]) {
      const type = match[1] === 'reels' ? 'reel' : match[1];
      return `https://www.instagram.com/${type}/${match[2]}/`;
    }
  }

  const permalinks = Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]'
    )
  );
  for (const a of permalinks) {
    const match = a.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (match && match[2]) {
      const type = match[1] === 'reels' ? 'reel' : match[1];
      return `https://www.instagram.com/${type}/${match[2]}/`;
    }
  }

  return currentUrl;
}

/**
 * Robust multilingual detection of Like and Save buttons on Instagram
 */
function getInstagramActionType(target: HTMLElement): 'like' | 'save' | null {
  let svg: SVGElement | null = null;
  if (target.tagName.toLowerCase() === 'svg') {
    svg = target as unknown as SVGElement;
  } else {
    svg =
      target.querySelector('svg') ||
      target.closest('svg') ||
      target.closest('button, div[role="button"], span')?.querySelector('svg') ||
      null;
  }

  const targetLabel = (target.getAttribute('aria-label') || target.getAttribute('title') || '').toLowerCase();
  if (targetLabel.includes('like') || targetLabel.includes('unlike') || targetLabel.includes('पसंद') || targetLabel.includes('लाइक')) {
    return 'like';
  }
  if (targetLabel.includes('save') || targetLabel.includes('bookmark') || targetLabel.includes('सहेजें')) {
    return 'save';
  }

  if (!svg) return null;

  const svgAria = (svg.getAttribute('aria-label') || '').toLowerCase();
  const svgTitle = (svg.querySelector('title')?.textContent || '').toLowerCase();
  const parentAria = (svg.parentElement?.getAttribute('aria-label') || '').toLowerCase();
  const combined = `${svgAria} ${svgTitle} ${parentAria}`;

  if (
    combined.includes('like') ||
    combined.includes('unlike') ||
    combined.includes('पसंद') ||
    combined.includes('लाइक') ||
    combined.includes('gefällt mir') ||
    combined.includes('me gusta') ||
    combined.includes('aimer')
  ) {
    return 'like';
  }

  if (
    combined.includes('save') ||
    combined.includes('bookmark') ||
    combined.includes('सहेजें') ||
    combined.includes('speichern') ||
    combined.includes('guardar') ||
    combined.includes('enregistrer')
  ) {
    return 'save';
  }

  const pathD = svg.querySelector('path')?.getAttribute('d') || '';
  if (
    pathD.includes('16.792') ||
    pathD.includes('34.6') ||
    pathD.includes('21.35') ||
    pathD.includes('M12 21') ||
    pathD.includes('3.904') ||
    pathD.includes('9.122') ||
    pathD.includes('7.222')
  ) {
    return 'like';
  }

  if (pathD.includes('20 22') || pathD.includes('14.815') || pathD.includes('6.912')) {
    return 'save';
  }

  const color = (svg.getAttribute('color') || svg.getAttribute('fill') || '').toLowerCase();
  if (color.includes('255, 48, 64') || color.includes('#ff3040') || color.includes('237, 73, 86')) {
    return 'like';
  }

  return null;
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
 * Captures live frame from HTML5 video element using canvas
 */
function captureVideoFrame(video: HTMLVideoElement): string {
  try {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas');
      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl && dataUrl.length > 800) {
          return dataUrl;
        }
      }
    }
  } catch {
    // Cross-origin tainted canvas fallback
  }
  return '';
}

/**
 * Searches for high-quality thumbnail image for the post or reel
 */
function findInstagramMediaThumbnail(container: HTMLElement): string {
  // 1. Try video frame snapshot for reels
  const video = container.querySelector('video') as HTMLVideoElement | null;
  if (video) {
    const frame = captureVideoFrame(video);
    if (frame) return frame;
    if (video.poster && !video.poster.startsWith('blob:')) {
      return video.poster;
    }
  }

  // 2. Search for media images (exclude small avatars / profile pictures)
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  for (const img of imgs) {
    const src = img.src || img.getAttribute('src') || '';
    const alt = (img.alt || '').toLowerCase();
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;

    if (alt.includes('profile') || alt.includes('avatar') || alt.includes('प्रोफ़ाइल')) continue;
    if (w > 0 && w < 120 && h > 0 && h < 120) continue;

    if (src.includes('cdninstagram') || src.includes('fbcdn.net') || w >= 150 || h >= 150) {
      if (!src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
        return src;
      }
    }
  }

  // 3. Check page meta tag (for direct reel or post view)
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImg && !ogImg.includes('static.cdninstagram.com/rsrc.php')) {
    return ogImg;
  }

  return '';
}

/**
 * Extracts rich, real post caption / title just like YouTube video titles
 */
function extractInstagramTitle(container: HTMLElement, creator: string, isReel: boolean): string {
  // 1. Check document.title quotes if on a direct post/reel page
  if (window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/')) {
    const titleMatch = document.title.match(/on Instagram:\s*["“](.*?)["”]/s);
    if (titleMatch && titleMatch[1]?.trim()) {
      return titleMatch[1].trim().slice(0, 150);
    }
  }

  // 2. Check meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle) {
    const m = ogTitle.match(/on Instagram:\s*["“](.*?)["”]/s);
    if (m && m[1]?.trim()) {
      return m[1].trim().slice(0, 150);
    }
  }

  // 3. Check dir="auto" elements (Instagram standard for user captions)
  const dirSpans = Array.from(container.querySelectorAll<HTMLElement>('span[dir="auto"], div[dir="auto"]'));
  for (const el of dirSpans) {
    const text = el.textContent?.trim() || '';
    if (
      text.length > 6 &&
      text !== creator &&
      !text.startsWith('@') &&
      !text.toLowerCase().includes('verified') &&
      !text.toLowerCase().includes('follow') &&
      !text.toLowerCase().includes('original audio')
    ) {
      return text.slice(0, 150);
    }
  }

  // 4. Check container h1 or caption classes
  const captionEl = container.querySelector('h1, div[class*="caption"] span, span._aacl._aaco._aacu._aacx');
  const captionText = captionEl?.textContent?.trim();
  if (captionText && captionText.length > 5 && captionText !== creator) {
    return captionText.slice(0, 150);
  }

  // 5. Check img[alt]
  const imgAlt = container.querySelector('img[alt]:not([alt=""]):not([alt*="profile picture"])')?.getAttribute('alt');
  if (imgAlt && imgAlt.length > 10) {
    const quoteMatch = imgAlt.match(/["“](.*?)["”]/);
    if (quoteMatch && quoteMatch[1]) {
      return quoteMatch[1].slice(0, 150);
    }
    return imgAlt.slice(0, 150);
  }

  return isReel ? `Instagram Reel by ${creator}` : `Instagram Post by ${creator}`;
}

/**
 * Scrapes metadata of an Instagram Reel or Post
 */
function scrapeInstagramPost(actionElement: HTMLElement): SavedVideoPayload | null {
  const container = findPostOrReelContainer(actionElement);
  const postUrl = findInstagramPostUrl(actionElement) || extractInstagramPermalink(actionElement, container);

  if (!postUrl) {
    console.warn('[Elio AI] Could not find Instagram post URL');
    return null;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'instagram');
  if (!cleanUrl) return null;

  const creator = extractCreator(container);
  const videoEl = container.querySelector('video') as HTMLVideoElement | null;
  const isReel = postUrl.includes('/reel') || Boolean(videoEl);

  // Extract rich real title & real thumbnail
  const title = extractInstagramTitle(container, creator, isReel);
  const thumbnail = findInstagramMediaThumbnail(container);

  return {
    platform: 'instagram',
    category: isReel ? 'reel' : 'post',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title,
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

    console.log('[Elio AI] 🚀 Sending Instagram item to Cloud:', payload);

    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, (response) => {
      if (chrome.runtime.lastError) {
        showElioToast('Saved to Elio AI', `"${(payload.title || 'Instagram post').slice(0, 32)}..."`, true);
        return;
      }

      if (response && response.synced) {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Instagram post').slice(0, 30)}..." synced to mobile`, true);
      } else if (response && response.reason === 'unauthenticated') {
        showElioToast('Saved Locally', 'Open extension to link with phone', false);
      } else {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Instagram post').slice(0, 30)}..."`, true);
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

    const action = getInstagramActionType(target);
    if (action) {
      console.log(`[Elio AI] Detected Instagram ${action} click!`);
      setTimeout(() => {
        const payload = scrapeInstagramPost(target);
        if (payload) {
          sendInstagramSync(payload);
        }
      }, 250);
    }
  },
  true
);

// 2. Double-click capture on video or photo (Double tap to like)
document.addEventListener(
  'dblclick',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const isMedia =
      target.tagName.toLowerCase() === 'video' ||
      target.tagName.toLowerCase() === 'img' ||
      Boolean(target.closest('video, img'));

    if (isMedia) {
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
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      console.log("[Elio AI] Detected Instagram 'L' key like shortcut!");
      setTimeout(() => {
        const activeMedia = (document.querySelector('video') || document.querySelector('article img')) as HTMLElement | null;
        if (activeMedia) {
          const payload = scrapeInstagramPost(activeMedia);
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
        const titleText = (svg.querySelector('title')?.textContent || '').toLowerCase();
        const color = (svg.getAttribute('color') || svg.getAttribute('fill') || '').toLowerCase();

        const isRedHeart =
          color.includes('255, 48, 64') ||
          color.includes('#ff3040') ||
          color.includes('237, 73, 86');

        const isUnlikeState =
          ariaLabel.includes('unlike') ||
          titleText.includes('unlike') ||
          ariaLabel.includes('पसंद हटाएं');

        if (isRedHeart || isUnlikeState) {
          const payload = scrapeInstagramPost(svg as HTMLElement);
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
