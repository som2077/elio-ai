import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Reddit Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapeRedditPost(targetEl: HTMLElement): SavedVideoPayload | null {
  const post =
    targetEl.closest('shreddit-post') ||
    targetEl.closest('div[data-testid="post-container"]') ||
    document.body;

  let postUrl = window.location.href;
  const permalink = post.getAttribute('permalink') || (post.querySelector('a[data-click-id="body"], a[slot="full-post-link"]') as HTMLAnchorElement | null)?.href;
  if (permalink) {
    postUrl = permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'reddit');
  if (!cleanUrl) return null;

  // Title
  const title =
    post.getAttribute('post-title') ||
    post.querySelector('h1, [slot="title"]')?.textContent?.trim() ||
    'Reddit Post';

  // Subreddit / Creator
  const subreddit = post.getAttribute('subreddit-prefixed-name') || post.querySelector('a[href*="/r/"]')?.textContent?.trim() || 'r/reddit';

  // Video or Thumbnail
  const video = post.querySelector('video') as HTMLVideoElement | null;
  const img = post.querySelector('img[alt="Post image"], img[src*="preview.redd.it"], img[src*="external-preview"]') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  const hasVideo = Boolean(video);

  return {
    platform: 'reddit',
    category: hasVideo ? 'video' : 'post',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: subreddit,
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

function sendRedditSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured Reddit Post:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const upvoteOrSave = target.closest(
    'button[aria-label*="upvote" i], button[upvote], shreddit-post-save-button, button[aria-label*="save" i]'
  ) as HTMLElement | null;

  if (!upvoteOrSave) return;

  console.log('[Elio AI] Detected Reddit Upvote/Save interaction!');
  setTimeout(() => {
    const payload = scrapeRedditPost(upvoteOrSave);
    if (payload) {
      sendRedditSync(payload);
    }
  }, 350);
}, true);
