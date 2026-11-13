import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Validates that the URL uses an allowed HTTP/HTTPS scheme to prevent intent hijacking or XSS
 */
function isSafeUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim().toLowerCase();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

/**
 * Intelligently opens YouTube or Instagram apps via deep-links with fallback to browser
 */
export async function openVideoDirectly(
  url: string,
  platform: 'youtube' | 'instagram' | string,
  videoId?: string,
  startSeconds?: number
) {
  // Security guard: Reject non-http(s) URLs
  if (!isSafeUrl(url)) {
    logger.warn('[Elio AI Security] Rejected unsafe URL scheme in openVideoDirectly');
    return;
  }
  try {
    let targetUrl = url;
    if (startSeconds && startSeconds > 0) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${sep}t=${Math.floor(startSeconds)}s`;
    }

    if (platform === 'youtube' && videoId) {
      const timeParam = startSeconds ? `&t=${Math.floor(startSeconds)}s` : '';
      const appUrl = Platform.select({
        ios: `youtube://watch?v=${videoId}${timeParam}`,
        android: `vnd.youtube:${videoId}${timeParam}`,
        default: targetUrl,
      });

      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    if (platform === 'instagram' && videoId) {
      const appUrl = `instagram://media?id=${videoId}`;
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    // Fallback: Open URL in default browser
    await Linking.openURL(targetUrl);
  } catch (error) {
    logger.error('Failed to open deep-link, opening standard URL');
    if (isSafeUrl(url)) {
      await Linking.openURL(url);
    }
  }
}
