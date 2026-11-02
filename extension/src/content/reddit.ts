import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI Reddit] Content script initialized on', window.location.href);

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
 * Checks if an element is part of a Reddit Downvote action
 */
function isRedditDownvoteElement(el: HTMLElement | null): boolean {
  if (!el || typeof el.getAttribute !== 'function') return false;
  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
  const name = (el.getAttribute('name') || el.getAttribute('noun') || el.getAttribute('icon-name') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-click-id') || '').toLowerCase();
  const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();

  return (
    aria.includes('downvote') ||
    aria.includes('down-vote') ||
    name === 'downvote' ||
    name.includes('downvote') ||
    testId.includes('downvote') ||
    cls.includes('downmod') ||
    cls.includes('arrow down')
  );
}

/**
 * Checks if an element represents a Reddit Upvote action
 */
function isRedditUpvoteElement(el: HTMLElement | null): boolean {
  if (!el || typeof el.getAttribute !== 'function') return false;
  if (isRedditDownvoteElement(el)) return false;

  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
  const name = (el.getAttribute('name') || el.getAttribute('noun') || el.getAttribute('icon-name') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-click-id') || '').toLowerCase();
  const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();

  if (
    aria.includes('upvote') ||
    aria.includes('up-vote') ||
    name === 'upvote' ||
    name.includes('upvote') ||
    testId.includes('upvote') ||
    cls.includes('icon-upvote') ||
    cls.includes('upvote-button') ||
    cls.includes('arrow up') ||
    el.hasAttribute('upvote') ||
    el.hasAttribute('data-upvote')
  ) {
    return true;
  }

  // Check child faceplate-icon or svg
  try {
    if (el.querySelector) {
      const child = el.querySelector(
        'faceplate-icon[name="upvote"], button[icon-name="upvote"], svg[aria-label*="upvote" i], .icon-upvote'
      );
      if (child) return true;
    }
  } catch {}

  return false;
}

/**
 * Checks if an element represents a Reddit Save/Bookmark action
 */
function isRedditSaveElement(el: HTMLElement | null): boolean {
  if (!el || typeof el.getAttribute !== 'function') return false;
  const tag = (el.tagName || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-click-id') || '').toLowerCase();
  const name = (el.getAttribute('name') || el.getAttribute('noun') || '').toLowerCase();

  return (
    tag === 'shreddit-post-save-button' ||
    aria.includes('save') ||
    aria.includes('bookmark') ||
    name === 'save' ||
    name === 'bookmark' ||
    testId.includes('save')
  );
}

/**
 * Finds the enclosing Reddit post container across Light and Shadow DOM
 */
function findRedditPostContainer(clickedEl?: HTMLElement | null, path?: HTMLElement[]): HTMLElement {
  // 1. Search up the composedPath
  if (path && Array.isArray(path)) {
    for (const node of path) {
      if (!node || node === (document as any) || node === (window as any) || typeof node.getAttribute !== 'function') continue;
      const tag = (node.tagName || '').toLowerCase();
      if (tag === 'shreddit-post') return node;
      if (node.getAttribute('data-testid') === 'post-container') return node;
      if (tag === 'article' && (node.getAttribute('aria-label') || node.classList.contains('Post'))) return node;
    }
  }

  // 2. Check closest in Light DOM
  if (clickedEl) {
    const closestPost =
      clickedEl.closest('shreddit-post') ||
      clickedEl.closest('div[data-testid="post-container"]') ||
      clickedEl.closest('article');
    if (closestPost) return closestPost as HTMLElement;
  }

  // 3. Fallback to main post on single post page
  const mainPost = document.querySelector('shreddit-post, div[data-testid="post-container"], article');
  if (mainPost) return mainPost as HTMLElement;

  return document.body;
}

/**
 * Checks if the post or button is currently in an active/upvoted state
 */
function isPostCurrentlyUpvoted(post: HTMLElement, buttonEl?: HTMLElement | null): boolean {
  // 1. Shreddit post attribute vote-type
  const voteType = (post.getAttribute('vote-type') || '').toLowerCase();
  if (voteType === 'upvote') return true;

  // 2. Button aria-pressed attribute
  if (buttonEl) {
    if (buttonEl.getAttribute('aria-pressed') === 'true') return true;
    if (buttonEl.getAttribute('vote-state') === 'upvoted') return true;
  }

  const btn = post.querySelector('button[aria-label*="upvote" i], button[icon-name="upvote"], faceplate-tracker[noun="upvote"] button');
  if (btn && btn.getAttribute('aria-pressed') === 'true') return true;

  // 3. Old reddit
  const oldArrow = post.querySelector('.arrow.up');
  if (oldArrow && oldArrow.classList.contains('upmod')) return true;

  return false;
}

/**
 * Extracts clean permalink URL for the post
 */
function findRedditPostUrl(post: HTMLElement): string {
  // 1. Shreddit attributes
  const permalink =
    post.getAttribute('permalink') ||
    post.getAttribute('content-href') ||
    post.getAttribute('post-url') ||
    post.getAttribute('data-permalink');

  if (permalink && (permalink.includes('/comments/') || permalink.includes('/r/') || permalink.includes('/s/'))) {
    return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
  }

  // 2. Search anchors inside the post
  const anchors = Array.from(
    post.querySelectorAll<HTMLAnchorElement>(
      'a[slot="full-post-link"], a[data-testid="post-title"], a[data-click-id="body"], a[data-click-id="comments"], a[href*="/comments/"], a[href*="/s/"]'
    )
  );
  for (const a of anchors) {
    const href = a.getAttribute('href') || a.href || '';
    if (href.includes('/comments/') || href.includes('/s/')) {
      return href.startsWith('http') ? href : `https://www.reddit.com${href}`;
    }
  }

  // 3. Current URL if on a post page
  if (window.location.pathname.includes('/comments/') || window.location.pathname.includes('/s/')) {
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
  const attrTitle = post.getAttribute('post-title') || post.getAttribute('title');
  if (attrTitle && attrTitle.trim()) {
    return attrTitle.trim();
  }

  const heading = post.querySelector<HTMLElement>(
    'h1[slot="title"], [slot="title"], a[slot="full-post-link"], h1, h2, h3, div[data-adclicklocation="title"]'
  );
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }

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

  // 4. Subreddit avatar/icon fallback
  if (!thumbnail) {
    const iconImg = post.querySelector<HTMLImageElement>(
      'faceplate-img, img[src*="communityIcon"], img[src*="styles.redditmedia.com"]'
    );
    if (iconImg?.src) {
      thumbnail = iconImg.src;
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
function scrapeRedditPost(post: HTMLElement): SavedVideoPayload | null {
  const rawPostUrl = findRedditPostUrl(post);

  if (!rawPostUrl) {
    console.warn('[Elio AI Reddit] Could not find Reddit post URL');
    return null;
  }

  // Guard against saving home feed as a post
  if (rawPostUrl === 'https://www.reddit.com/' || rawPostUrl === 'https://reddit.com/') {
    console.warn('[Elio AI Reddit] Post URL resolved to home feed root. Aborting.');
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
  if (payload.clean_url === lastSavedUrl && now - lastSavedTime < 4000) {
    console.log('[Elio AI Reddit] Duplicate sync throttled:', payload.clean_url);
    return;
  }
  lastSavedUrl = payload.clean_url;
  lastSavedTime = now;

  try {
    if (!chrome?.runtime?.id) {
      console.warn('[Elio AI Reddit] Extension context invalidated.');
      return;
    }

    console.log('[Elio AI Reddit] 🚀 Sending Reddit item to Cloud:', payload);

    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Elio AI Reddit] Runtime message error:', chrome.runtime.lastError.message);
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
    console.error('[Elio AI Reddit] Error sending Reddit sync:', err);
  }
}

// 1. Global click capture across Light DOM and Shadow DOM using composedPath
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const path =
      (typeof event.composedPath === 'function' ? (event.composedPath() as HTMLElement[]) : [target]) || [target];

    // Check if click was on downvote -> ignore immediately
    for (const node of path) {
      if (isRedditDownvoteElement(node)) {
        console.log('[Elio AI Reddit] Downvote clicked. Skipping.');
        return;
      }
    }

    let isUpvote = false;
    let isSave = false;
    let clickedEl: HTMLElement | null = null;

    // Search the full composedPath to find upvote or save button
    for (const node of path) {
      if (!node || node === (document as any) || node === (window as any) || typeof node.getAttribute !== 'function') {
        continue;
      }

      if (isRedditUpvoteElement(node)) {
        isUpvote = true;
        clickedEl = node;
        break;
      }

      if (isRedditSaveElement(node)) {
        isSave = true;
        clickedEl = node;
        break;
      }
    }

    if (!isUpvote && !isSave) return;

    const post = findRedditPostContainer(clickedEl, path);
    const wasAlreadyUpvoted = isPostCurrentlyUpvoted(post, clickedEl);

    // If user clicked an already active upvote/save, they are un-upvoting -> do not sync
    if (wasAlreadyUpvoted) {
      console.log('[Elio AI Reddit] Un-upvoting/unsaving post. Skipping sync.');
      return;
    }

    console.log('[Elio AI Reddit] Detected Upvote/Save click on post! Will scrape after DOM settles...');
    setTimeout(() => {
      const payload = scrapeRedditPost(post);
      if (payload) {
        sendRedditSync(payload);
      }
    }, 250);
  },
  true
);

// 2. MutationObserver: Watches for vote-type or aria-pressed attribute transitions
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const el = mutation.target as HTMLElement;
      if (!el || typeof el.getAttribute !== 'function') continue;

      // Case 1: <shreddit-post vote-type="upvote">
      if (mutation.attributeName === 'vote-type') {
        const voteType = (el.getAttribute('vote-type') || '').toLowerCase();
        if (voteType === 'upvote') {
          console.log('[Elio AI Reddit] Post vote-type changed to upvote via DOM mutation.');
          const payload = scrapeRedditPost(el);
          if (payload) {
            sendRedditSync(payload);
          }
        }
      }

      // Case 2: button aria-pressed="true"
      if (mutation.attributeName === 'aria-pressed' && el.getAttribute('aria-pressed') === 'true') {
        if (isRedditUpvoteElement(el)) {
          console.log('[Elio AI Reddit] Upvote button aria-pressed became true via DOM mutation.');
          const post = findRedditPostContainer(el);
          const payload = scrapeRedditPost(post);
          if (payload) {
            sendRedditSync(payload);
          }
        }
      }
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['vote-type', 'aria-pressed'],
});
