import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] TikTok Content Script initialized.');

let lastSavedUrl: string | null = null;

async function scrapeTikTokVideo(targetEl: HTMLElement): Promise<SavedVideoPayload | null> {
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

  // 1. Author Handle: URL first, then DOM
  const urlHandleMatch = (postUrl || window.location.href).match(/@([a-zA-Z0-9_.-]+)/);
  const handleFromUrl = urlHandleMatch ? `@${urlHandleMatch[1]}` : null;

  const authorEl = container.querySelector(
    'h3[data-e2e="browse-username"], a[data-e2e="video-author-uniqueid"], span[data-e2e="search-card-user-unique-id"], [data-e2e="user-title"], a[href*="/@"]'
  );
  const domCreator = authorEl?.textContent?.trim();
  const creator = handleFromUrl || (domCreator ? (domCreator.startsWith('@') ? domCreator : `@${domCreator}`) : '@tiktok_creator');

  // 2. Title & Description
  const titleEl = container.querySelector(
    'h1[data-e2e="browse-video-desc"], div[data-e2e="video-desc"], [data-e2e="search-card-video-caption"], [data-e2e="video-caption"], [class*="DivTextWrapper"]'
  );
  let fullDesc = titleEl?.textContent?.trim() || '';

  if (!fullDesc) {
    const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]')?.getAttribute('content');
    if (metaDesc) fullDesc = metaDesc.trim();
  }
  if (!fullDesc) {
    const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (metaTitle) fullDesc = metaTitle.replace(/\s*\|\s*TikTok$/i, '').trim();
  }
  if (!fullDesc && document.title && !document.title.includes('TikTok - Make Your Day')) {
    fullDesc = document.title.replace(/\s*\|\s*TikTok$/i, '').trim();
  }

  const title = fullDesc || `TikTok Clip by ${creator}`;

  // 3. Multi-layer Thumbnail Extraction
  let thumbnail = '';

  // 3a. Video poster attribute
  const video = container.querySelector('video') as HTMLVideoElement | null;
  if (video?.poster && video.poster.startsWith('http')) {
    thumbnail = video.poster;
  }

  // 3b. OpenGraph / Twitter meta tags
  if (!thumbnail) {
    const ogImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]')?.getAttribute('content');
    if (ogImg && ogImg.startsWith('http')) {
      thumbnail = ogImg;
    }
  }

  // 3c. Images inside feed container (filtering out tiny user avatars)
  if (!thumbnail) {
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const posterImg = imgs.find((i) =>
      i.src &&
      (i.src.includes('tiktokcdn') || i.src.includes('byteoversea') || i.src.includes('tos-')) &&
      !i.src.includes('avatar') &&
      !i.className.includes('Avatar') &&
      (i.width > 120 || i.naturalWidth > 120 || !i.width)
    ) || imgs.find((i) => i.src && i.src.startsWith('http') && !i.src.includes('avatar') && !i.className.includes('Avatar'));

    if (posterImg?.src) {
      thumbnail = posterImg.src;
    }
  }

  // 3d. Background images on container children
  if (!thumbnail) {
    const bgEls = Array.from(container.querySelectorAll('[style*="background-image"]')) as HTMLElement[];
    for (const el of bgEls) {
      const m = el.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/);
      if (m && m[1] && m[1].startsWith('http') && !m[1].includes('avatar')) {
        thumbnail = m[1];
        break;
      }
    }
  }

  // 3e. TikTok's __UNIVERSAL_DATA_FOR_REHYDRATION__ script
  if (!thumbnail) {
    try {
      const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (script?.textContent) {
        const data = JSON.parse(script.textContent);
        const itemStruct = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
        if (itemStruct?.video?.cover) {
          thumbnail = itemStruct.video.cover;
        } else if (itemStruct?.video?.dynamicCover) {
          thumbnail = itemStruct.video.dynamicCover;
        }
      }
    } catch {}
  }

  const payload: SavedVideoPayload = {
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

  // 4. Same-origin in-browser oEmbed enrichment (resolves exact high-res CDN thumbnail)
  if (!payload.thumbnail_url || payload.creator_name === '@tiktok_creator') {
    try {
      const oembedRes = await fetch(`/oembed?url=${encodeURIComponent(cleanUrl)}`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.thumbnail_url) payload.thumbnail_url = oembed.thumbnail_url;
        if (oembed.title && payload.title.includes('@tiktok_creator')) payload.title = oembed.title.slice(0, 150);
        if (oembed.author_name) payload.creator_name = `${oembed.author_name} (@${oembed.author_unique_id || ''})`.trim();
      }
    } catch {}
  }

  return payload;
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
  setTimeout(async () => {
    const payload = await scrapeTikTokVideo(likeOrBookmark);
    if (payload) {
      sendTikTokSync(payload);
    }
  }, 400);
}, true);
