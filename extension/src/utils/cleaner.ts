export type SocialPlatform =
  | 'youtube'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'linkedin'
  | 'pinterest'
  | 'tiktok'
  | 'other';

export interface SavedVideoPayload {
  platform: SocialPlatform;
  category: 'video' | 'short' | 'reel' | 'post';
  original_url: string;
  clean_url: string;
  platform_video_id?: string;
  title?: string;
  creator_name?: string;
  thumbnail_url?: string;
  source_client: 'browser_extension' | 'mobile_share';
  device_id?: string;
  source_device_name?: string;
}

/**
 * Strips tracking query parameters across all platforms
 */
export function cleanVideoUrl(rawUrl: string, platform: SocialPlatform): { cleanUrl: string; videoId?: string } {
  try {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://www.instagram.com';
    const url = new URL(rawUrl, base);

    if (platform === 'youtube') {
      if (url.pathname.includes('/watch')) {
        const videoId = url.searchParams.get('v') || undefined;
        return {
          cleanUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : rawUrl,
          videoId,
        };
      }
      if (url.pathname.includes('/shorts/')) {
        const parts = url.pathname.split('/shorts/');
        const videoId = parts[1]?.split('/')[0]?.split('?')[0];
        return {
          cleanUrl: videoId ? `https://www.youtube.com/shorts/${videoId}` : rawUrl,
          videoId,
        };
      }
    }

    if (platform === 'instagram') {
      const match = url.pathname.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
      const invalidShortcodes = new Set([
        'audio',
        'videos',
        'tagged',
        'saved',
        'explore',
        'feed',
        'stories',
        'channel',
        'direct',
      ]);
      if (match && match[2] && !invalidShortcodes.has(match[2].toLowerCase()) && match[2].length >= 5) {
        const type = match[1] === 'p' ? 'p' : 'reel';
        return {
          cleanUrl: `https://www.instagram.com/${type}/${match[2]}/`,
          videoId: match[2],
        };
      }
    }

    if (platform === 'twitter') {
      const match = url.pathname.match(/\/status\/([0-9]+)/);
      if (match && match[1]) {
        return {
          cleanUrl: `https://x.com${url.pathname.split('?')[0]}`,
          videoId: match[1],
        };
      }
    }

    if (platform === 'facebook') {
      const match = url.pathname.match(/\/(videos|reel|watch)\/([0-9a-zA-Z_-]+)/);
      if (match && match[2]) {
        return {
          cleanUrl: `https://www.facebook.com${url.pathname.split('?')[0]}`,
          videoId: match[2],
        };
      }
    }

    if (platform === 'reddit') {
      // reddit.com/r/sub/comments/id/slug/ or reddit.com/r/sub/s/shareId/
      const match = url.pathname.match(/\/(comments|s)\/([a-zA-Z0-9]+)/);
      if (match && match[2]) {
        return {
          cleanUrl: `https://www.reddit.com${url.pathname.split('?')[0]}`,
          videoId: match[2],
        };
      }
      return {
        cleanUrl: `https://www.reddit.com${url.pathname.split('?')[0]}`,
      };
    }

    if (platform === 'linkedin') {
      return {
        cleanUrl: `https://www.linkedin.com${url.pathname.split('?')[0]}`,
      };
    }

    if (platform === 'pinterest') {
      const match = url.pathname.match(/\/pin\/([0-9]+)/);
      if (match && match[1]) {
        return {
          cleanUrl: `https://www.pinterest.com/pin/${match[1]}/`,
          videoId: match[1],
        };
      }
    }

    if (platform === 'tiktok') {
      const match = url.pathname.match(/\/video\/([0-9]+)/);
      if (match && match[1]) {
        return {
          cleanUrl: `https://www.tiktok.com${url.pathname.split('?')[0]}`,
          videoId: match[1],
        };
      }
    }

    // Default cleanup: strip all tracking query params
    ['igsh', 'si', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 's', 't', 'share_id'].forEach((p) => {
      url.searchParams.delete(p);
    });

    return { cleanUrl: url.toString() };
  } catch {
    return { cleanUrl: rawUrl };
  }
}
