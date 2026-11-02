import { SavedVideoPayload, cleanVideoUrl } from '../utils/cleaner';

console.log('[Elio AI] Instagram Content Script initialized.');

let lastSavedUrl: string | null = null;

function scrapeInstagramPost(actionElement: HTMLElement): SavedVideoPayload | null {
  // 1. Identify post container (Reel, feed item, or modal)
  const container =
    actionElement.closest('article') ||
    actionElement.closest('div[role="dialog"]') ||
    document.querySelector('article') ||
    document.body;

  // 2. Identify canonical post URL
  let postUrl = window.location.href;

  // If in main feed, find permalink anchor tag inside the post container
  if (!postUrl.includes('/reel/') && !postUrl.includes('/p/')) {
    const linkEl = container.querySelector('a[href*="/p/"], a[href*="/reel/"]') as HTMLAnchorElement | null;
    if (linkEl && linkEl.href) {
      postUrl = linkEl.href;
    }
  }

  const { cleanUrl, videoId } = cleanVideoUrl(postUrl, 'instagram');
  if (!cleanUrl) return null;

  // 3. Creator handle
  const creatorEl = container.querySelector(
    'header a span, a[role="link"] span, header a, a.notranslate, span._aacl._aaco._aacw'
  );
  let creator = creatorEl?.textContent?.trim() || '';
  if (creator && !creator.startsWith('@')) {
    creator = `@${creator}`;
  }

  // 4. Video / Image Thumbnail
  const videoEl = container.querySelector('video') as HTMLVideoElement | null;
  const imgEl = container.querySelector(
    'img[style*="object-fit"], img[crossorigin], div[role="button"] img'
  ) as HTMLImageElement | null;

  let thumbnail = videoEl?.poster || imgEl?.src || '';
  if (!thumbnail && videoEl && videoEl.src) {
    thumbnail = videoEl.src;
  }

  // 5. Title / Caption text
  const captionEl = container.querySelector(
    'h1, span._aacl._aaco._aacu._aacx._aad7._aade, div[role="button"] + span, div[class*="caption"]'
  );
  let caption = captionEl?.textContent?.trim() || '';
  if (!caption) {
    caption = `Instagram Reel by ${creator || 'Creator'}`;
  }

  const isReel = postUrl.includes('/reel/');

  return {
    platform: 'instagram',
    category: isReel ? 'reel' : 'post',
    original_url: postUrl,
    clean_url: cleanUrl,
    platform_video_id: videoId,
    title: caption.slice(0, 150),
    creator_name: creator || '@instagram_creator',
    thumbnail_url: thumbnail,
    source_client: 'browser_extension',
  };
}

function sendInstagramSync(payload: SavedVideoPayload) {
  if (payload.clean_url === lastSavedUrl) return;
  lastSavedUrl = payload.clean_url;

  try {
    if (!chrome?.runtime?.id) return;
    console.log('[Elio AI] 🚀 Captured Instagram post:', payload);
    chrome.runtime.sendMessage({ type: 'VIDEO_LIKED', payload }, () => {
      if (chrome.runtime.lastError) {
        // Suppress safely
      }
    });
  } catch {}
}

// Global click event listener for Instagram Likes and Bookmarks
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  // Catch any button or SVG matching like, unlike, save, or bookmark
  const actionBtn = target.closest('button, div[role="button"], span[role="link"]') as HTMLElement | null;
  if (!actionBtn) return;

  const svg = actionBtn.querySelector('svg');
  const ariaLabel = (svg?.getAttribute('aria-label') || actionBtn.getAttribute('aria-label') || '').toLowerCase();

  const isLikeAction = ariaLabel.includes('like') || ariaLabel.includes('unlike');
  const isSaveAction = ariaLabel.includes('save') || ariaLabel.includes('bookmark') || ariaLabel.includes('remove');

  if (isLikeAction || isSaveAction) {
    console.log(`[Elio AI] Detected Instagram interaction: ${ariaLabel}`);
    // Slight timeout to let Instagram toggle and URL update
    setTimeout(() => {
      const payload = scrapeInstagramPost(actionBtn);
      if (payload) {
        sendInstagramSync(payload);
      }
    }, 350);
  }
}, true);
