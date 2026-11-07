import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Facebook Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapeFacebookPost(targetEl: HTMLElement): SavedVideoPayload | null {
  const container = targetEl.closest('div[role="article"], div[data-pagelet*="FeedUnit"]') || document.body;
  
  let postUrl = window.location.href;
  const link = container.querySelector('a[href*="/watch/"], a[href*="/reel/"], a[href*="/videos/"]') as HTMLAnchorElement | null;
  if (link && link.href) {
    postUrl = link.href;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'facebook');

  // Creator / Page name
  const authorEl = container.querySelector('h3, h4, h2, strong span');
  const creator = authorEl?.textContent?.trim() || 'Facebook Creator';

  // Video or Thumbnail
  const video = container.querySelector('video') as HTMLVideoElement | null;
  const img = container.querySelector('img[referrerpolicy]') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  // Post description / Text
  const messageEl = container.querySelector('div[data-ad-preview="message"], div[dir="auto"]');
  const postText = messageEl?.textContent?.trim() || '';
  const title = postText || `Facebook Reel by ${creator}`;

  const isReel = postUrl.includes('/reel/');

  return {
    platform: 'facebook',
    category: isReel ? 'reel' : 'video',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    user_notes: postText || undefined,
    source_client: 'browser_extension',
  };
}

function sendFacebookSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured Facebook post:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {
        // Suppress safely
      }
    });
  } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const likeBtn = target.closest('div[aria-label*="Like" i], div[aria-label*="Reaction" i], div[aria-label*="Save" i], div[role="button"][aria-label*="like" i]') as HTMLElement | null;
  if (!likeBtn) return;

  console.log('[Elio AI] Detected Facebook Like/Save action!');
  setTimeout(() => {
    const payload = scrapeFacebookPost(likeBtn);
    if (payload) {
      sendFacebookSync(payload);
    }
  }, 400);
}, true);
