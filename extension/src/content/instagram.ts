import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Instagram Content Script initialized.');

let lastSavedUrl: string | null = null;
let lastSavedTime: number = 0;

const INVALID_SHORTCODES = new Set([
  'audio',
  'videos',
  'tagged',
  'saved',
  'explore',
  'feed',
  'stories',
  'channel',
  'direct',
  'reels',
  'reel',
  'p',
]);

const SYSTEM_ROUTES = new Set([
  'explore',
  'reels',
  'reel',
  'p',
  'direct',
  'stories',
  'audio',
  'accounts',
  'emails',
  'developer',
  'about',
  'legal',
  'privacy',
  'terms',
  'directory',
  'settings',
  'your_activity',
  'saved',
  'home',
  'notifications',
  'create',
]);

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
 * Universal container locator strictly scoped to a single Instagram Reel or Post
 * Guarantees that the container does NOT bleed into the global feed or other reels.
 */
function findPostOrReelContainer(actionElement: HTMLElement): HTMLElement {
  // 1. If in a modal dialog (desktop pop-up view)
  const dialog = actionElement.closest('div[role="dialog"]');
  if (dialog) return dialog as HTMLElement;

  // 2. If inside a traditional article (standard feed post)
  const article = actionElement.closest('article');
  if (article) return article as HTMLElement;

  // 3. Reels container locator:
  // Walk up from actionElement until we find the enclosing container holding THIS reel.
  // In Instagram Reels, each reel card contains exactly 1 <video> element.
  // The parent scrolling feed contains 2 or more videos.
  let current: HTMLElement | null = actionElement;
  let singleVideoContainer: HTMLElement | null = null;

  while (current && current !== document.body && current !== document.documentElement) {
    const videos = current.querySelectorAll('video');
    if (videos.length === 1 && current.offsetHeight > 300) {
      singleVideoContainer = current;
    } else if (videos.length > 1) {
      // Reached multi-reel feed container; stop immediately!
      break;
    }
    current = current.parentElement;
  }

  if (singleVideoContainer) return singleVideoContainer;

  // 4. Fallback: Find the currently active or playing video on screen
  const allVideos = Array.from(document.querySelectorAll('video'));
  const activeVideo =
    allVideos.find((v) => {
      const rect = v.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      return midY >= 0 && midY <= window.innerHeight && !v.paused;
    }) ||
    allVideos.find((v) => !v.paused && v.offsetHeight > 250) ||
    allVideos[0];

  if (activeVideo) {
    let curr: HTMLElement | null = activeVideo;
    let card: HTMLElement | null = null;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const vids = curr.querySelectorAll('video');
      if (vids.length === 1 && curr.offsetHeight > 300) {
        card = curr;
      } else if (vids.length > 1) {
        break;
      }
      curr = curr.parentElement;
    }
    if (card) return card;
    return activeVideo.parentElement || actionElement;
  }

  return actionElement.parentElement || actionElement;
}

/**
 * Validates Instagram username
 */
function isValidUsername(str: string): boolean {
  if (!str) return false;
  const clean = str.replace(/^@/, '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 32) return false;
  if (SYSTEM_ROUTES.has(clean)) return false;
  if (INVALID_SHORTCODES.has(clean)) return false;
  if (clean.includes('/') || clean.includes('?') || clean.includes('&') || clean.includes(' ')) return false;
  return /^[a-zA-Z0-9._]+$/.test(clean);
}

/**
 * Normalizes username string
 */
function normalizeUsername(raw: string): string {
  const clean = raw.replace(/^@/, '').trim();
  return `@${clean}`;
}

/**
 * Extracts creator username strictly from the current reel container
 */
function extractCreator(container: HTMLElement): string {
  // 1. High-accuracy check: Creator's profile picture alt attribute
  // Instagram renders profile picture alt as:
  // "yournishaant's profile picture" / "yournishaant’s photo" / "yournishaant की प्रोफ़ाइल फ़ोटो"
  const profileImgs = Array.from(container.querySelectorAll<HTMLImageElement>('img[alt]'));
  for (const img of profileImgs) {
    const alt = (img.getAttribute('alt') || '').trim();
    if (!alt) continue;

    const mEn = alt.match(/^([a-zA-Z0-9._]+)(?:'s|’s)\s+(?:profile picture|photo)/i);
    if (mEn && mEn[1] && isValidUsername(mEn[1])) {
      return normalizeUsername(mEn[1]);
    }

    const mHi = alt.match(/^([a-zA-Z0-9._]+)\s+की\s+प्रोफ़ाइल/i);
    if (mHi && mHi[1] && isValidUsername(mHi[1])) {
      return normalizeUsername(mHi[1]);
    }

    const mGen = alt.match(/(?:profile picture of|foto del perfil de|profilbild von)\s+([a-zA-Z0-9._]+)/i);
    if (mGen && mGen[1] && isValidUsername(mGen[1])) {
      return normalizeUsername(mGen[1]);
    }
  }

  // 2. High-accuracy check: Anchor adjacent to the "Follow" / "Following" button
  // Instagram reels always place the author's username link right next to the Follow button
  const buttons = Array.from(container.querySelectorAll('button, div[role="button"]'));
  const followBtn = buttons.find((b) => {
    const txt = (b.textContent || '').trim().toLowerCase();
    return (
      txt === 'follow' ||
      txt === 'following' ||
      txt === 'फॉलो करें' ||
      txt === 'फॉलो कर रहे हैं'
    );
  });

  if (followBtn) {
    const row = followBtn.closest('div, header') || followBtn.parentElement;
    if (row) {
      const rowAnchors = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'));
      for (const a of rowAnchors) {
        const href = a.getAttribute('href') || '';
        const m = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
        if (m && m[1] && isValidUsername(m[1])) {
          return normalizeUsername(m[1]);
        }
      }
    }
  }

  // 3. Search for header or author anchors inside container
  const authorSelectors = [
    'header a[role="link"]',
    'header a[href^="/"]',
    'div[class*="author"] a[href^="/"]',
    'a.notranslate[href^="/"]',
    'a[role="link"][href^="/"]',
    'a[href^="/"]',
  ];

  for (const sel of authorSelectors) {
    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>(sel));
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
      if (m && m[1] && isValidUsername(m[1])) {
        // Exclude audio link or button text
        const text = (a.textContent || '').trim().toLowerCase();
        if (
          !text.includes('audio') &&
          !text.includes('sound') &&
          !text.includes('संगीत') &&
          !text.includes('follow') &&
          !text.includes('explore')
        ) {
          return normalizeUsername(m[1]);
        }
      }
    }
  }

  return '@instagram_creator';
}

/**
 * Searches for high-quality thumbnail image for the post or reel
 * Ensures small avatars and audio cover art are never chosen.
 */
function findInstagramMediaThumbnail(container: HTMLElement): string {
  // 1. Try video element poster attribute (high-res official Instagram CDN cover)
  const video = container.querySelector('video') as HTMLVideoElement | null;
  if (video?.poster && !video.poster.startsWith('blob:') && video.poster.length > 20) {
    return video.poster;
  }

  // 2. High-res reel cover image in the container
  // A reel cover image is displayed large (> 120px wide and > 140px tall).
  // Audio icons and avatars have small rendered dimensions (< 60px) and will be skipped.
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  for (const img of imgs) {
    const rect = img.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 140) continue;

    const alt = (img.alt || '').toLowerCase();
    if (alt.includes('profile') || alt.includes('avatar') || alt.includes('audio')) continue;

    const src = img.src || img.getAttribute('src') || '';
    if (src && !src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
      if (src.includes('cdninstagram') || src.includes('fbcdn.net') || rect.width > 200) {
        return src;
      }
    }
  }

  // 3. Canvas snapshot fallback from HTML5 video element
  if (video) {
    const frame = captureVideoFrame(video);
    if (frame) return frame;
  }

  // 4. Meta tag fallback (when viewing a direct single post or reel page)
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImg && !ogImg.includes('static.cdninstagram.com/rsrc.php')) {
    return ogImg;
  }

  // 5. Creator avatar fallback so the card always has a clean visual image
  for (const img of imgs) {
    const alt = (img.alt || '').toLowerCase();
    if (alt.includes('profile') || alt.includes('photo')) {
      const src = img.src || img.getAttribute('src');
      if (src && !src.startsWith('blob:') && !src.startsWith('data:image/svg')) {
        return src;
      }
    }
  }

  return '';
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
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
 * Filters out UI junk words from Instagram titles/captions
 */
function isGarbageTitle(str: string): boolean {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  if (s.length < 3) return true;

  const garbageList = [
    'messages',
    'explore',
    'reels',
    'reel',
    'post',
    'audio',
    'original audio',
    'home',
    'search',
    'notifications',
    'create',
    'profile',
    'more',
    'follow',
    'following',
    'verified',
    'audio image',
    'profile picture',
    'profile photo',
    'profile icon',
    'avatar',
    'view more on instagram',
    'log in to instagram',
  ];

  if (garbageList.includes(s)) return true;
  if (s.includes('photo by') && (s.includes('on') || s.includes('in'))) return true;
  if (s.includes('may be an image of') || s.includes('image may contain')) return true;
  if (/^\d+(\.\d+)?[kmb]?\s*(likes?|comments?|shares?)?$/i.test(s)) return true;

  return false;
}

/**
 * Strips trailing "... more" or button clutter from captions
 */
function cleanCaption(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*(?:\.\.\.|…)?\s*(?:more|less|अधिक|और देखें)$/i, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
}

/**
 * Extracts clean video title / caption similar to YouTube video titles
 */
function extractInstagramTitle(container: HTMLElement, creator: string, isReel: boolean): string {
  // 1. Direct page title if on direct reel/post page
  if (window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/')) {
    const titleMatch = document.title.match(/on Instagram:\s*["“](.*?)["”]/s);
    if (titleMatch && titleMatch[1]?.trim() && !isGarbageTitle(titleMatch[1])) {
      const cleaned = cleanCaption(titleMatch[1]);
      if (cleaned.length > 2) return cleaned.slice(0, 150);
    }
  }

  // 2. Meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle) {
    const m = ogTitle.match(/on Instagram:\s*["“](.*?)["”]/s);
    if (m && m[1]?.trim() && !isGarbageTitle(m[1])) {
      const cleaned = cleanCaption(m[1]);
      if (cleaned.length > 2) return cleaned.slice(0, 150);
    }
  }

  // 3. Primary caption inside container (h1 or caption classes)
  const captionEl = container.querySelector(
    'h1, div[class*="caption"] span, span._aacl._aaco._aacu._aacx'
  );
  const captionText = captionEl?.textContent?.trim();
  if (captionText && captionText.length > 3 && captionText !== creator && !isGarbageTitle(captionText)) {
    const cleaned = cleanCaption(captionText);
    if (cleaned.length > 2) return cleaned.slice(0, 150);
  }

  // 4. dir="auto" elements inside container (user captions on Instagram)
  const dirSpans = Array.from(container.querySelectorAll<HTMLElement>('span[dir="auto"], div[dir="auto"]'));
  for (const el of dirSpans) {
    const text = el.textContent?.trim() || '';
    if (
      text.length > 3 &&
      text !== creator &&
      !text.startsWith('@') &&
      !text.toLowerCase().includes('verified') &&
      !text.toLowerCase().includes('follow') &&
      !text.toLowerCase().includes('original audio') &&
      !isGarbageTitle(text)
    ) {
      const cleaned = cleanCaption(text);
      if (cleaned.length > 2) return cleaned.slice(0, 150);
    }
  }

  return isReel ? `Instagram Reel by ${creator}` : `Instagram Post by ${creator}`;
}

/**
 * Builds normalized Instagram post or reel URL
 */
function buildInstagramUrl(type: string, code: string): string {
  const normalizedType = type === 'p' ? 'p' : 'reel';
  return `https://www.instagram.com/${normalizedType}/${code}/`;
}

/**
 * Finds the exact Reel or Post URL
 * Rejects reserved paths like /reels/audio/ and searches script tags when needed
 */
function findInstagramPostUrl(
  actionElement: HTMLElement,
  container: HTMLElement,
  creator: string
): string | null {
  // 1. Direct shortcode in window.location.pathname
  const locMatch = window.location.pathname.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
  if (locMatch && locMatch[2]) {
    const type = locMatch[1];
    const code = locMatch[2];
    if (code.length >= 7 && !INVALID_SHORTCODES.has(code.toLowerCase())) {
      return buildInstagramUrl(type, code);
    }
  }

  // 2. Check for <time> anchor inside the scoped container
  const timeEl = container.querySelector('time');
  const timeAnchor = timeEl?.closest('a') as HTMLAnchorElement | null;
  if (timeAnchor?.href) {
    const m = timeAnchor.href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (m && m[2] && m[2].length >= 7 && !INVALID_SHORTCODES.has(m[2].toLowerCase())) {
      return buildInstagramUrl(m[1], m[2]);
    }
  }

  // 3. Search inside the scoped container for valid post/reel anchors
  const containerAnchors = Array.from(
    container.querySelectorAll<HTMLAnchorElement>('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]')
  );
  for (const a of containerAnchors) {
    const href = a.href || a.getAttribute('href') || '';
    const m = href.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (m && m[2] && m[2].length >= 7 && !INVALID_SHORTCODES.has(m[2].toLowerCase())) {
      return buildInstagramUrl(m[1], m[2]);
    }
  }

  // 4. Search inline JSON script tags for the creator's reel shortcode
  if (creator && creator !== '@instagram_creator') {
    const rawUsername = creator.replace(/^@/, '');
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/json"], script:not([src])')
    );
    for (const s of scripts) {
      const text = s.textContent || '';
      if (text.includes(rawUsername)) {
        const matchNear =
          text.match(
            new RegExp(
              `"(?:shortcode|code)":"([a-zA-Z0-9_-]{8,})"[^}]{0,300}?"username":"${rawUsername}"`,
              'i'
            )
          ) ||
          text.match(
            new RegExp(
              `"username":"${rawUsername}"[^}]{0,300}?"(?:shortcode|code)":"([a-zA-Z0-9_-]{8,})"`,
              'i'
            )
          );
        if (matchNear && matchNear[1] && !INVALID_SHORTCODES.has(matchNear[1].toLowerCase())) {
          return `https://www.instagram.com/reel/${matchNear[1]}/`;
        }
      }
    }
  }

  // 5. Fallback if on /reels/ and creator is known
  if (window.location.href.includes('/reels') && creator && creator !== '@instagram_creator') {
    return `https://www.instagram.com/${creator.replace('@', '')}/reels/`;
  }

  return window.location.href;
}

/**
 * Robust multilingual detection of Like and Save buttons on Instagram
 * Accurately determines if the user is liking vs unliking
 */
function getInstagramAction(target: HTMLElement): { type: 'like' | 'save'; isUnlike: boolean } | null {
  const btn =
    target.closest('button, div[role="button"], a[role="button"], span[role="button"]') ||
    target.closest('span') ||
    target;

  const svg =
    (target.tagName.toLowerCase() === 'svg' ? (target as unknown as SVGElement) : null) ||
    target.querySelector('svg') ||
    target.closest('svg') ||
    btn.querySelector('svg');

  const btnAria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
  const svgAria = (svg?.getAttribute('aria-label') || svg?.querySelector('title')?.textContent || '').toLowerCase();
  const combinedAria = `${btnAria} ${svgAria}`.toLowerCase();

  const fill = (svg?.getAttribute('fill') || svg?.getAttribute('color') || '').toLowerCase();
  let isRed =
    fill.includes('255, 48, 64') ||
    fill.includes('#ff3040') ||
    fill.includes('237, 73, 86');

  if (!isRed && svg) {
    try {
      const computed = window.getComputedStyle(svg);
      const col = (computed.color || computed.fill || '').toLowerCase();
      if (col.includes('255, 48, 64') || col.includes('237, 73, 86')) {
        isRed = true;
      }
    } catch {}
  }

  // Check if it's an UNLIKE action (user clicked an already red heart)
  const isUnlike =
    combinedAria.includes('unlike') ||
    combinedAria.includes('पसंद हटाएं') ||
    combinedAria.includes('gefällt mir nicht') ||
    combinedAria.includes('ya no me gusta') ||
    combinedAria.includes('ne plus aimer') ||
    isRed;

  // Check if it's a LIKE button
  const isLike =
    combinedAria.includes('like') ||
    combinedAria.includes('पसंद') ||
    combinedAria.includes('लाइक') ||
    combinedAria.includes('gefällt mir') ||
    combinedAria.includes('me gusta') ||
    combinedAria.includes('aimer');

  // Check SVG path for Instagram's heart icon
  const pathD = svg?.querySelector('path')?.getAttribute('d') || '';
  const isHeartPath =
    pathD.includes('16.792') ||
    pathD.includes('34.6') ||
    pathD.includes('21.35') ||
    pathD.includes('M12 21') ||
    pathD.includes('3.904') ||
    pathD.includes('9.122') ||
    pathD.includes('7.222') ||
    pathD.includes('M34.6 3.1c-4.5');

  if (isLike || isHeartPath) {
    return { type: 'like', isUnlike };
  }

  // Check if it's a SAVE / Bookmark button
  const isSave =
    combinedAria.includes('save') ||
    combinedAria.includes('bookmark') ||
    combinedAria.includes('सहेजें') ||
    combinedAria.includes('speichern') ||
    combinedAria.includes('guardar');

  const isBookmarkPath = pathD.includes('20 22') || pathD.includes('14.815') || pathD.includes('6.912');

  if (isSave || isBookmarkPath) {
    const isUnsave =
      combinedAria.includes('unsave') || combinedAria.includes('remove') || combinedAria.includes('हटाएं');
    return { type: 'save', isUnlike: isUnsave };
  }

  return null;
}

/**
 * Scrapes metadata of an Instagram Reel or Post
 */
function scrapeInstagramPost(actionElement: HTMLElement): SavedVideoPayload | null {
  const container = findPostOrReelContainer(actionElement);
  const creator = extractCreator(container);
  const rawPostUrl = findInstagramPostUrl(actionElement, container, creator);

  if (!rawPostUrl) {
    console.warn('[Elio AI] Could not find Instagram post URL');
    return null;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(rawPostUrl, 'instagram');
  const finalCleanUrl = cleanUrl || rawPostUrl;

  const videoEl = container.querySelector('video') as HTMLVideoElement | null;
  const isReel = finalCleanUrl.includes('/reel') || Boolean(videoEl);

  // Extract rich real title & real thumbnail
  const title = extractInstagramTitle(container, creator, isReel);
  const thumbnail = findInstagramMediaThumbnail(container);

  return {
    platform: 'instagram',
    category: isReel ? 'reel' : 'post',
    original_url: rawPostUrl,
    clean_url: finalCleanUrl,
    platform_video_id: videoId || undefined,
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
  if (payload.clean_url === lastSavedUrl && now - lastSavedTime < 4000) return;
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
        showElioToast(
          'Synced to Elio AI',
          `"${(payload.title || 'Instagram post').slice(0, 30)}..." synced to mobile`,
          true
        );
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

    const action = getInstagramAction(target);
    if (!action) return;

    // If target was already 'Unlike', user is unliking -> do not sync
    if (action.isUnlike) {
      console.log(`[Elio AI] Ignored Instagram un-${action.type} click.`);
      return;
    }

    console.log(`[Elio AI] Detected Instagram ${action.type} click! Syncing...`);
    setTimeout(() => {
      const payload = scrapeInstagramPost(target);
      if (payload) {
        sendInstagramSync(payload);
      }
    }, 150);
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
      }, 200);
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
        const allVideos = Array.from(document.querySelectorAll('video'));
        const activeVideo = allVideos.find((v) => !v.paused && v.offsetHeight > 250) || allVideos[0];
        if (activeVideo) {
          const payload = scrapeInstagramPost(activeVideo);
          if (payload) {
            sendInstagramSync(payload);
          }
        }
      }, 200);
    }
  },
  true
);
