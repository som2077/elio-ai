import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Twitter/X Content Script initialized.');

let lastSavedUrl: string | null = null;
let lastSavedTime: number = 0;

function scrapeTweet(targetEl: HTMLElement): SavedVideoPayload | null {
  const article =
    targetEl.closest('article[data-testid="tweet"]') ||
    targetEl.closest('article') ||
    document.querySelector('article[data-testid="tweet"]') ||
    document.body;

  // Find exact Tweet Link
  let tweetUrl = window.location.href;
  const timeLink = article.querySelector('time')?.closest('a') as HTMLAnchorElement | null;
  if (timeLink && timeLink.href) {
    tweetUrl = timeLink.href;
  } else {
    // Look for status link
    const statusLink = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
    if (statusLink && statusLink.href) {
      tweetUrl = statusLink.href;
    }
  }

  const { cleanUrl, videoId } = cleanVideoUrl(tweetUrl, 'twitter');
  if (!cleanUrl) return null;

  // Author username & handle
  const userEl = article.querySelector('div[data-testid="User-Name"]');
  const creator = userEl?.textContent?.replace(/\s+/g, ' ').trim() || '@twitter_user';

  // Tweet text
  const textEl = article.querySelector('div[data-testid="tweetText"]');
  const tweetText = textEl?.textContent?.trim() || 'Post on X';

  // Video / Photo preview
  const video = article.querySelector('video') as HTMLVideoElement | null;
  const img = article.querySelector('div[data-testid="tweetPhoto"] img, img[alt="Image"]') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  const hasVideo = Boolean(video);

  return {
    platform: 'twitter',
    category: hasVideo ? 'video' : 'post',
    original_url: tweetUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: tweetText.slice(0, 150),
    creator_name: creator.slice(0, 50),
    thumbnail_url: thumbnail,
    user_notes: tweetText,
    source_client: 'browser_extension',
  };
}

function sendTwitterSync(payload: SavedVideoPayload) {
  const now = Date.now();
  if (payload.clean_url === lastSavedUrl && now - lastSavedTime < 3000) return;
  lastSavedUrl = payload.clean_url;
  lastSavedTime = now;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured Twitter/X post:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {
        // Suppress safely
      }
    });
  } catch {}
}

// Click listener with broader selectors (Twitter/X SVG icons and nested testids)
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const btn = target.closest(
    'button[data-testid="like"], button[data-testid="unlike"], button[data-testid="bookmark"], div[data-testid="like"], div[data-testid="bookmark"], [aria-label*="Like" i], [aria-label*="Bookmark" i]'
  ) as HTMLElement | null;

  if (!btn) return;

  console.log('[Elio AI] Twitter/X interaction captured!');
  setTimeout(() => {
    const payload = scrapeTweet(btn);
    if (payload) {
      sendTwitterSync(payload);
    }
  }, 350);
}, true);
