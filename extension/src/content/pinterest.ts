import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Pinterest Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapePinterestPin(targetEl: HTMLElement): SavedVideoPayload | null {
  const pin = targetEl.closest('div[data-test-id="pin"], div[data-grid-item="true"]') || document.body;

  let pinUrl = window.location.href;
  const link = pin.querySelector('a[href*="/pin/"]') as HTMLAnchorElement | null;
  if (link && link.href) {
    pinUrl = link.href;
  }

  const { cleanUrl, videoId } = cleanVideoUrl(pinUrl, 'pinterest');
  if (!cleanUrl) return null;

  // Title / Description
  const titleEl = pin.querySelector('h1, h2, [data-test-id="pin-title"], img[alt]');
  const title = titleEl?.getAttribute('alt') || titleEl?.textContent?.trim() || 'Pinterest Pin';

  // Creator
  const creatorEl = pin.querySelector('div[data-test-id="creator-profile-name"], a[href*="/"] span');
  const creator = creatorEl?.textContent?.trim() || 'Pinterest Creator';

  // Image / Video
  const video = pin.querySelector('video') as HTMLVideoElement | null;
  const img = pin.querySelector('img') as HTMLImageElement | null;
  const thumbnail = video?.poster || img?.src || '';

  const hasVideo = Boolean(video);

  return {
    platform: 'pinterest',
    category: hasVideo ? 'video' : 'post',
    original_url: pinUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: title.slice(0, 150),
    creator_name: creator,
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

function sendPinterestSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured Pinterest Pin:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const saveBtn = target.closest(
    'button[data-test-id="PinBetterSaveButton"], button[aria-label*="Save" i], button[data-test-id*="save" i]'
  ) as HTMLElement | null;

  if (!saveBtn) return;

  console.log('[Elio AI] Detected Pinterest Save action!');
  setTimeout(() => {
    const payload = scrapePinterestPin(saveBtn);
    if (payload) {
      sendPinterestSync(payload);
    }
  }, 350);
}, true);
