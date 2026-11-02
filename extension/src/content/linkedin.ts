import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] LinkedIn Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapeLinkedInPost(targetEl: HTMLElement): SavedVideoPayload | null {
  const urnContainer =
    targetEl.closest('div[data-urn], div.feed-shared-update-v2') ||
    document.body;

  let postUrl = window.location.href;
  const link = urnContainer.querySelector('a[href*="/feed/update/urn:li:activity:"]') as HTMLAnchorElement | null;
  if (link && link.href) {
    postUrl = link.href;
  }

  const { cleanUrl } = cleanVideoUrl(postUrl, 'linkedin');
  if (!cleanUrl) return null;

  // Author Name
  const authorEl = urnContainer.querySelector('.update-components-actor__name, .feed-shared-actor__name, span[dir="ltr"]');
  const creator = authorEl?.textContent?.replace(/\s+/g, ' ').trim() || 'LinkedIn Professional';

  // Post Text / Title
  const textEl = urnContainer.querySelector('.feed-shared-update-v2__description, .update-components-text');
  const title = textEl?.textContent?.trim() || `Post by ${creator}`;

  // Video or Thumbnail
  const video = urnContainer.querySelector('video') as HTMLVideoElement | null;
  const img = urnContainer.querySelector('img.feed-shared-image__image, img[alt*="Preview"]') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  const hasVideo = Boolean(video);

  return {
    platform: 'linkedin',
    category: hasVideo ? 'video' : 'post',
    original_url: postUrl,
    clean_url: cleanUrl,
    title: title.slice(0, 150),
    creator_name: creator.slice(0, 50),
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

function sendLinkedInSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured LinkedIn Post:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const reactionBtn = target.closest(
    'button.reactions-react-button, button[aria-label*="React" i], button[aria-label*="Like" i], button.feed-shared-control-menu__trigger'
  ) as HTMLElement | null;

  if (!reactionBtn) return;

  console.log('[Elio AI] Detected LinkedIn interaction!');
  setTimeout(() => {
    const payload = scrapeLinkedInPost(reactionBtn);
    if (payload) {
      sendLinkedInSync(payload);
    }
  }, 400);
}, true);
