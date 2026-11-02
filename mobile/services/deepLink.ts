import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Intelligently opens YouTube or Instagram apps via deep-links with fallback to browser
 */
export async function openVideoDirectly(url: string, platform: 'youtube' | 'instagram', videoId?: string) {
  try {
    if (platform === 'youtube' && videoId) {
      const appUrl = Platform.select({
        ios: `youtube://watch?v=${videoId}`,
        android: `vnd.youtube:${videoId}`,
        default: url,
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
    await Linking.openURL(url);
  } catch (error) {
    console.error('Failed to open deep-link, opening standard URL:', error);
    await Linking.openURL(url);
  }
}
