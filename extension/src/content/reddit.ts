import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Reddit Content Script initialized.');

let lastSavedUrl: string | null = null;
let lastSavedTime: number = 0;

/**
 * Modern floating HUD toast on Reddit to visually confirm sync
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
          isSuccess ? 'rgba(255, 69, 0, 0.2)' : 'rgba(255, 159, 10, 0.2)'
        }; display: flex; align-items: center; justify-content: center; font-size: 15px; color: ${
          isSuccess ? '#ff4500' : '#ff9f0a'
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
 * Checks if an element or its ancestor represents a Reddit Upvote action
 */
function isRedditUpvoteButton(el: HTMLElement): { isUpvote: boolean; isUnlike: boolean } | null {
  if (!el || typeof el.getAttribute !== 'function') return null;

  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-click-id') || '').toLowerCase();
  const name = (el.getAttribute('name') || el.getAttribute('noun') || '').toLowerCase();
  const cls = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const hasUpvoteAttr = el.hasAttribute('upvote') || el.hasAttribute('data-upvote');

  const matchesUpvote =
    aria.includes('upvote') ||
    aria.includes('up-vote') ||
    testId.includes('upvote') ||
    name === 'upvote' ||
    id.includes('upvote') ||
    hasUpvoteAttr ||
    cls.includes('arrow up') ||
    cls.includes('icon-upvote') ||
    cls.includes('upvote-button');

  // Also check if child faceplate-icon or svg has upvote
  let hasChildUpvoteIcon = false;
  try {
    if (!matchesUpvote && el.querySelector) {
      const childIcon = el.querySelector('faceplate-icon[name="upvote"], svg[aria-label*="upvote" i], .icon-upvote');
      if (childIcon) hasChildUpvoteIcon = true;
    }
  } catch {}

  if (!matchesUpvote && !hasChildUpvoteIcon) {
    return null;
  }

  // Check if it is an UN-UPVOTE (the button is currently pressed/active/orange)
  const ariaPressed = el.getAttribute('aria-pressed');
  const isUnlike =
    aria.includes('undo') ||
    aria.includes('remove') ||
    ariaPressed === 'true' ||
    cls.includes('upmod') ||
    cls.includes('text-orangered') ||
    cls.includes('is-upvoted') ||
    el.getAttribute('vote-state') === 'upvoted';

  return { isUpvote: true, isUnlike };
}

/**
 * Checks if an element represents a Reddit Save/Bookmark action
 */
function isRedditSaveButton(el: HTMLElement): { isSave: boolean; isUnlike: boolean } | null {
  if (!el || typeof el.getAttribute !== 'function') return null;

  const tag = (el.tagName || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-click-id') || '').toLowerCase();

  const isSave =
    tag === 'shreddit-post-save-button' ||
    aria.includes('save') ||
    aria.includes('bookmark') ||
    testId.includes('save');

  if (!isSave) return null;

  const isUnlike = aria.includes('unsave') || aria.includes('remove') || el.getAttribute('aria-pressed') === 'true';
  return { isSave: true, isUnlike };
}

/**
 * Finds the enclosing Reddit post container across Light and Shadow DOM
 */
function findRedditPostContainer(clickedEl: HTMLElement, path: HTMLElement[]): HTMLElement {
  // 1. Search up the composedPath
  for (const node of path) {
    if (!node || node === document || node === window || typeof node.getAttribute !== 'function') continue;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'shreddit-post') return node;
    if (node.getAttribute('data-testid') === 'post-container') return node;
    if (tag === 'article' && (node.getAttribute('aria-label') || node.classList.contains('Post'))) return node;
  }

  // 2. Check closest in Light DOM
  const closestPost =
    clickedEl.closest('shreddit-post') ||
    clickedEl.closest('div[data-testid="post-container"]') ||
    clickedEl.closest('article');
  if (closestPost) return closestPost as HTMLElement;

  // 3. Main post on single post page
  const mainPost = document.querySelector('shreddit-post, div[data-testid="post-container"], article');
  if (mainPost) return mainPost as HTMLElement;

  return document.body;
}

/**
 * Extracts clean permalink URL for the post
 */
function findRedditPostUrl(post: HTMLElement): string {
  // 1. Shreddit attributes
  const permalink =
    post.getAttribute('permalink') ||
    post.getAttribute('content-href') ||
    post.getAttribute('post-url');
  if (permalink && (permalink.includes('/comments/') || permalink.includes('/r/'))) {
    return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
  }

  // 2. Search anchors inside the post
  const anchors = Array.from(
    post.querySelectorAll<HTMLAnchorElement>(
      'a[slot="full-post-link"], a[data-click-id="body"], a[data-click-id="comments"], a[data-testid="post-title"], a[href*="/comments/"]'
    )
  );
  for (const a of anchors) {
    const href = a.getAttribute('href') || a.href || '';
    if (href.includes('/comments/')) {
      return href.startsWith('http') ? href : `https://www.reddit.com${href}`;
    }
  }

  // 3. Current URL if on a post page
  if (window.location.pathname.includes('/comments/')) {
    return window.location.href;
  }

  if (permalink) {
    return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
  }

  return window.location.href;
}

/**
 * Extracts clean post title
 */
function findRedditPostTitle(post: HTMLElement): string {
  // 1. Shreddit post-title attribute
  const attrTitle = post.getAttribute('post-title') || post.getAttribute('title');
  if (attrTitle && attrTitle.trim()) {
    return attrTitle.trim();
  }

  // 2. Heading element inside post
  const heading = post.querySelector<HTMLElement>(
    'h1[slot="title"], [slot="title"], a[slot="full-post-link"], h1, h2, h3, div[data-adclicklocation="title"]'
  );
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }

  // 3. Fallback to document title
  const docTitle = document.title.replace(/\s*:\s*r\/[a-zA-Z0-9_]+.*$/i, '').trim();
  if (docTitle && !docTitle.toLowerCase().includes('reddit')) {
    return docTitle;
  }

  return 'Reddit Post';
}

/**
 * Extracts subreddit and author name
 */
function findRedditCreator(post: HTMLElement): string {
  const sub = post.getAttribute('subreddit-prefixed-name') || '';
  const author = post.getAttribute('author') || '';

  if (sub && author) {
    return `${sub} • u/${author}`;
  }
  if (sub) return sub;
  if (author) return `u/${author}`;

  const subLink = post.querySelector<HTMLAnchorElement>('a[href^="/r/"]');
  if (subLink?.textContent?.trim()) {
    return subLink.textContent.trim();
  }

  const m = window.location.pathname.match(/\/r\/([a-zA-Z0-9_]+)/);
  if (m && m[1]) return `r/${m[1]}`;

  return 'r/reddit';
}

/**
 * Extracts thumbnail and media type
 */
function findRedditMedia(post: HTMLElement): { thumbnail: string; category: 'video' | 'post' } {
  const video = post.querySelector('video') as HTMLVideoElement | null;
  const shredditPlayer = post.querySelector('shreddit-player, shreddit-player-2, [data-testid="shreddit-player"]');

  const isVideo =
    Boolean(video) ||
    Boolean(shredditPlayer) ||
    post.hasAttribute('is-video') ||
    post.getAttribute('post-type') === 'video';

  let thumbnail = '';

  // 1. Video poster attribute
  if (video?.poster && !video.poster.startsWith('blob:') && video.poster.length > 20) {
    thumbnail = video.poster;
  } else if (shredditPlayer) {
    thumbnail =
      shredditPlayer.getAttribute('poster-url') ||
      shredditPlayer.getAttribute('preview') ||
      '';
  }

  // 2. Image inside post
  if (!thumbnail) {
    const img = post.querySelector<HTMLImageElement>(
      'img[alt="Post image"], img[src*="preview.redd.it"], img[src*="i.redd.it"], img[src*="external-preview"], shreddit-aspect-ratio img, img'
    );
    if (
      img?.src &&
      !img.src.startsWith('data:image/svg') &&
      !img.src.includes('avatar') &&
      !img.src.includes('communityIcon') &&
      !img.src.includes('snoo')
    ) {
      thumbnail = img.src;
    }
  }

  // 3. Fallback to OpenGraph image on single post view
  if (!thumbnail && window.location.pathname.includes('/comments/')) {
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !ogImg.includes('redditstatic.com')) {
      thumbnail = ogImg;
    }
  }

  return {
    thumbnail,
    category: isVideo ? 'video' : 'post',
  };
}

/**
 * Scrapes metadata of a Reddit Post or Video
 */
function scrapeRedditPost(clickedEl: HTMLElement, path: HTMLElement[]): SavedVideoPayload | null {
  const post = findRedditPostContainer(clickedEl, path);
  const rawPostUrl = findRedditPostUrl(post);

  if (!rawPostUrl) {
    console.warn('[Elio AI] Could not find Reddit post URL');
    return null;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(rawPostUrl, 'reddit');
  const finalCleanUrl = cleanUrl || rawPostUrl;

  const title = findRedditPostTitle(post);
  const creator = findRedditCreator(post);
  const { thumbnail, category } = findRedditMedia(post);

  return {
    platform: 'reddit',
    category: category,
    original_url: rawPostUrl,
    clean_url: finalCleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

/**
 * Dispatches saved Reddit post to service worker with toast confirmation
 */
function sendRedditSync(payload: SavedVideoPayload) {
  const now = Date.now();
  if (payload.clean_url === lastSavedUrl && now - lastSavedTime < 4000) return;
  lastSavedUrl = payload.clean_url;
  lastSavedTime = now;

  try {
    if (!chrome?.runtime?.id) {
      console.warn('[Elio AI] Extension context invalidated.');
      return;
    }

    console.log('[Elio AI] 🚀 Sending Reddit item to Cloud:', payload);

    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, (response) => {
      if (chrome.runtime.lastError) {
        showElioToast('Saved to Elio AI', `"${(payload.title || 'Reddit post').slice(0, 32)}..."`, true);
        return;
      }

      if (response && response.synced) {
        showElioToast(
          'Synced to Elio AI',
          `"${(payload.title || 'Reddit post').slice(0, 30)}..." synced to mobile`,
          true
        );
      } else if (response && response.reason === 'unauthenticated') {
        showElioToast('Saved Locally', 'Open extension to link with phone', false);
      } else {
        showElioToast('Synced to Elio AI', `"${(payload.title || 'Reddit post').slice(0, 30)}..."`, true);
      }
    });
  } catch (err) {
    console.error('[Elio AI] Error sending Reddit sync:', err);
  }
}

// Global click capture across Light DOM and Shadow DOM using composedPath
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const path = (typeof event.composedPath === 'function' ? (event.composedPath() as HTMLElement[]) : [target]) || [target];

    let action: { isUnlike: boolean } | null = null;
    let clickedEl: HTMLElement | null = null;

    // Search the full composedPath to find upvote or save button
    for (const node of path) {
      if (!node || node === (document as any) || node === (window as any) || typeof node.getAttribute !== 'function') {
        continue;
      }

      const upvote = isRedditUpvoteButton(node);
      if (upvote) {
        action = upvote;
        clickedEl = node;
        break;
      }

      const save = isRedditSaveButton(node);
      if (save) {
        action = save;
        clickedEl = node;
        break;
      }
    }

    if (!action || !clickedEl) return;

    // If user clicked an already active upvote/save, they are un-upvoting -> do not sync
    if (action.isUnlike) {
      console.log('[Elio AI] Ignored Reddit un-upvote/unsave click.');
      return;
    }

    console.log('[Elio AI] Detected Reddit Upvote/Save click! Syncing...');
    setTimeout(() => {
      const payload = scrapeRedditPost(clickedEl!, path);
      if (payload) {
        sendRedditSync(payload);
      }
    }, 200);
  },
  true
);
