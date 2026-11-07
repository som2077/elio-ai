import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] TikTok Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapeTikTokVideo(targetEl: HTMLElement): SavedVideoPayload | null {
  const container =
    targetEl.closest('div[data-e2e="feed-item"], div[class*="DivItemContainer"]') ||
    document.body;

  let postUrl = window.location.href;
  const link = container.querySelector('a[href*="/video/"]') as HTMLAnchorElement | null;
  if (link && link.href) {
    postUrl = link.href;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'tiktok');
  if (!cleanUrl) return null;

  // Author handle
  const authorEl = container.querySelector('h3[data-e2e="browse-username"], a[data-e2e="video-author-uniqueid"], span[data-e2e="search-card-user-unique-id"]');
  const creator = authorEl?.textContent?.trim() || '@tiktok_creator';

  // Description / Title
  const titleEl = container.querySelector('h1[data-e2e="browse-video-desc"], div[data-e2e="video-desc"], [data-e2e="search-card-video-caption"]');
  const fullDesc = titleEl?.textContent?.trim() || '';
  const title = fullDesc || `TikTok Video by ${creator}`;

  // Video or Thumbnail
  const video = container.querySelector('video') as HTMLVideoElement | null;
  const img = container.querySelector('img[class*="ImgPoster"]') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  return {
    platform: 'tiktok',
    category: 'short',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    user_notes: fullDesc || undefined,
    source_client: 'browser_extension',
  };
}

function sendTikTokSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured TikTok Video:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const likeOrBookmark = target.closest(
    'button[data-e2e="like-icon"], button[data-e2e="undefined-icon"], button[aria-label*="Like" i], button[aria-label*="Bookmark" i], span[data-e2e="like-icon"]'
  ) as HTMLElement | null;

  if (!likeOrBookmark) return;

  console.log('[Elio AI] Detected TikTok interaction!');
  setTimeout(() => {
    const payload = scrapeTikTokVideo(likeOrBookmark);
    if (payload) {
      sendTikTokSync(payload);
    }
  }, 400);
}, true);
