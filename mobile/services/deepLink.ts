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
 * Intelligently opens official apps via deep-links with graceful fallback to system browser
 * Supports YouTube, Instagram, X/Twitter, TikTok, Reddit, Facebook, Threads, Snapchat, Pinterest.
 */
export async function openVideoDirectly(
  url: string,
  platform: string,
  videoId?: string,
  startSeconds?: number,
) {
  // Security guard: Reject non-http(s) URLs
  if (!isSafeUrl(url)) {
    logger.warn(
      "[Elio AI Security] Rejected unsafe URL scheme in openVideoDirectly",
    );
    return;
  }
  try {
    let targetUrl = url;
    if (startSeconds && startSeconds > 0) {
      const sep = targetUrl.includes("?") ? "&" : "?";
      targetUrl = `${targetUrl}${sep}t=${Math.floor(startSeconds)}s`;
    }

    const p = (platform || "").toLowerCase();

    // 1. YouTube Deep-link
    if (p === "youtube" && videoId) {
      const timeParam = startSeconds ? `&t=${Math.floor(startSeconds)}s` : "";
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

    // 2. Instagram Deep-link
    if (p === "instagram") {
      const appUrl = videoId ? `instagram://media?id=${videoId}` : "instagram://app";
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    // 3. Twitter / X Deep-link
    if (p === "twitter" || p === "x") {
      const appUrl = videoId ? `twitter://status?id=${videoId}` : "twitter://";
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    // 4. TikTok Deep-link
    if (p === "tiktok") {
      const appUrl = "snssdk1233://";
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(targetUrl);
      }
    }

    // 5. Facebook Deep-link
    if (p === "facebook") {
      const appUrl = `fb://facewebmodal/f?href=${encodeURIComponent(targetUrl)}`;
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    // 6. Threads Deep-link
    if (p === "threads") {
      const appUrl = "barcelona://";
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(targetUrl);
      }
    }

    // 7. Snapchat Deep-link
    if (p === "snapchat") {
      const appUrl = "snapchat://";
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(targetUrl);
      }
    }

    // 8. Pinterest Deep-link
    if (p === "pinterest" && videoId) {
      const appUrl = `pinterest://pin/${videoId}`;
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        return await Linking.openURL(appUrl);
      }
    }

    // Fallback: Open URL in default browser
    await Linking.openURL(targetUrl);
  } catch (error) {
    logger.error("Failed to open deep-link, opening standard URL");
    if (isSafeUrl(url)) {
      await Linking.openURL(url);
    }
  }
}
