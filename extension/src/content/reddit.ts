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

    // Security: Clear existing nodes safely without innerHTML
    while (toast.firstChild) {
      toast.removeChild(toast.firstChild);
    }

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '12px';

    const iconBox = document.createElement('div');
    iconBox.style.width = '28px';
    iconBox.style.height = '28px';
    iconBox.style.borderRadius = '8px';
    iconBox.style.background = isSuccess ? 'rgba(255, 69, 0, 0.2)' : 'rgba(255, 159, 10, 0.2)';
    iconBox.style.display = 'flex';
    iconBox.style.alignItems = 'center';
    iconBox.style.justifyContent = 'center';
    iconBox.style.fontSize = '15px';
    iconBox.style.color = isSuccess ? '#ff4500' : '#ff9f0a';
    iconBox.textContent = '✦';

    const textBox = document.createElement('div');

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '600';
    titleEl.style.fontSize = '13px';
    titleEl.style.color = '#ffffff';
    titleEl.style.letterSpacing = '-0.2px';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.style.fontSize = '11px';
    msgEl.style.color = '#a1a1aa';
    msgEl.style.marginTop = '2px';
    msgEl.textContent = message;

    textBox.appendChild(titleEl);
    textBox.appendChild(msgEl);
    container.appendChild(iconBox);
    container.appendChild(textBox);
    toast.appendChild(container);

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
 * Verifies if a URL is a valid image (and NOT a video file like .mp4/.m3u8)
 */
function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  if (clean.length < 15) return false;
  if (clean.startsWith('blob:') || clean.startsWith('data:image/svg')) return false;

  // Crucial: Reject video streams and manifests!
  if (
    clean.includes('.mp4') ||
    clean.includes('.m3u8') ||
    clean.includes('.webm') ||
    clean.includes('/cmaf_') ||
    clean.includes('hlsplaylist')
  ) {
    return false;
  }

  // Reject tiny community icons/avatars
  if (clean.includes('communityicon') || clean.includes('avatar') || clean.includes('snoo') || clean.includes('width=48')) {
    return false;
  }

  return clean.startsWith('http://') || clean.startsWith('https://');
}

/**
 * Attempts to extract an image thumbnail directly from Reddit's DOM
 */
function extractDomThumbnail(post: HTMLElement): string {
  const shredditPlayer = post.querySelector('shreddit-player, shreddit-player-2, [data-testid="shreddit-player"]');
  const video = post.querySelector('video') as HTMLVideoElement | null;

  // 1. Check shreddit-player poster attribute directly
  if (shredditPlayer) {
    const playerPoster =
      shredditPlayer.getAttribute('poster') ||
      shredditPlayer.getAttribute('poster-url') ||
      shredditPlayer.getAttribute('preview');
    if (isValidImageUrl(playerPoster)) return playerPoster!;

    // Check shreddit-player shadow DOM
    try {
      if ((shredditPlayer as any).shadowRoot) {
        const shadowVideo = (shredditPlayer as any).shadowRoot.querySelector('video');
        const shadowPoster = shadowVideo?.getAttribute('poster');
        if (isValidImageUrl(shadowPoster)) return shadowPoster;

        const shadowImg = (shredditPlayer as any).shadowRoot.querySelector('img');
        const shadowImgSrc = shadowImg?.currentSrc || shadowImg?.src || shadowImg?.getAttribute('src');
        if (isValidImageUrl(shadowImgSrc)) return shadowImgSrc;
      }
    } catch {}
  }

  // 2. Check HTML5 video poster (only if valid image and NOT .mp4)
  if (video?.poster && isValidImageUrl(video.poster)) {
    return video.poster;
  }

  // 3. Check high-res Reddit image containers inside the post
  const imgSelectors = [
    'img[src*="preview.redd.it"]',
    'img[src*="i.redd.it"]',
    'img[src*="external-preview.redd.it"]',
    'shreddit-aspect-ratio img',
    'figure img',
    'img[alt="Post image"]',
    'img[data-testid="post-image"]',
  ];

  for (const sel of imgSelectors) {
    const found = post.querySelectorAll<HTMLImageElement>(sel);
    for (const img of Array.from(found)) {
      const src = img.currentSrc || img.src || img.getAttribute('src');
      if (isValidImageUrl(src)) return src;
    }
  }

  // 4. Any other non-icon image inside post
  const anyImgs = post.querySelectorAll<HTMLImageElement>('img');
  for (const img of Array.from(anyImgs)) {
    const src = img.currentSrc || img.src || img.getAttribute('src');
    if (isValidImageUrl(src)) return src;
  }

  // 5. OpenGraph image on single post view
  if (window.location.pathname.includes('/comments/')) {
    const ogImg =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    if (isValidImageUrl(ogImg)) return ogImg;
  }

  return '';
}

/**
 * Fetches the post JSON directly via same-origin session to retrieve the full-resolution preview image
 */
async function fetchRedditPostThumbnail(rawPostUrl: string): Promise<string> {
  try {
    const cleanBase = rawPostUrl.split('?')[0].replace(/\/+$/, '');
    if (!cleanBase.includes('/comments/')) return '';

    const jsonUrl = `${cleanBase}.json`;
    console.log('[Elio AI Reddit] Fetching high-res thumbnail from Reddit JSON:', jsonUrl);
    const res = await fetch(jsonUrl, { credentials: 'same-origin' });
    if (!res.ok) return '';

    const data = await res.json();
    const postData = data?.[0]?.data?.children?.[0]?.data;
    if (!postData) return '';

    // 1. Preview source image (unescape &amp;)
    const previewUrl = postData.preview?.images?.[0]?.source?.url;
    if (isValidImageUrl(previewUrl)) {
      return previewUrl.replace(/&amp;/g, '&');
    }

    // 2. Direct thumbnail if valid
    if (isValidImageUrl(postData.thumbnail)) {
      return postData.thumbnail;
    }

    // 3. Media oembed thumbnail
    const oembedThumb =
      postData.secure_media?.oembed?.thumbnail_url ||
      postData.media?.oembed?.thumbnail_url;
    if (isValidImageUrl(oembedThumb)) {
      return oembedThumb;
    }
  } catch (err) {
    console.warn('[Elio AI Reddit] JSON thumbnail fetch notice:', err);
  }
  return '';
}

/**
 * Scrapes metadata of a Reddit Post or Video
 */
async function scrapeRedditPost(post: HTMLElement): Promise<SavedVideoPayload | null> {
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

  const video = post.querySelector('video') as HTMLVideoElement | null;
  const shredditPlayer = post.querySelector('shreddit-player, shreddit-player-2, [data-testid="shreddit-player"]');
  const isVideo =
    Boolean(video) ||
    Boolean(shredditPlayer) ||
    post.hasAttribute('is-video') ||
    post.getAttribute('post-type') === 'video';

  // 1. Try instant DOM extraction
  let thumbnail = extractDomThumbnail(post);

  // 2. If DOM extraction did not yield a valid image, fetch via same-origin JSON
  if (!isValidImageUrl(thumbnail)) {
    thumbnail = await fetchRedditPostThumbnail(rawPostUrl);
  }

  // 3. Fallback to clean curated tech/social backdrop if post has no media
  if (!isValidImageUrl(thumbnail)) {
    thumbnail = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80';
  }

  // Extract post text / body from DOM if present
  const textEl = post.querySelector<HTMLElement>(
    '[slot="text-body"], div[data-click-id="text"], div[data-testid="post-container"] .RichTextJSON-root, div.md'
  );
  const postBody = textEl?.textContent?.trim() || '';

  return {
    platform: 'reddit',
    category: isVideo ? 'video' : 'post',
    original_url: rawPostUrl,
    clean_url: finalCleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    user_notes: postBody || undefined,
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
      handlePostSync(post);
    }, 250);
  },
  true
);

async function handlePostSync(post: HTMLElement) {
  try {
    const payload = await scrapeRedditPost(post);
    if (payload) {
      sendRedditSync(payload);
    }
  } catch (err) {
    console.error('[Elio AI Reddit] Sync error:', err);
  }
}

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
          handlePostSync(el);
        }
      }

      // Case 2: button aria-pressed="true"
      if (mutation.attributeName === 'aria-pressed' && el.getAttribute('aria-pressed') === 'true') {
        if (isRedditUpvoteElement(el)) {
          console.log('[Elio AI Reddit] Upvote button aria-pressed became true via DOM mutation.');
          const post = findRedditPostContainer(el);
          handlePostSync(post);
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
