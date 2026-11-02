import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Apple-grade Multimodal Haptic Engine
 * Provides instant physical touch feedback across interactions.
 * Safe fallback for Web and environments without native haptics.
 */
export const haptics = {
  /**
   * Subtle selection click (filter pill tab change, date tap, segment switch)
   */
  selection: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Ignored safely
    }
  },

  /**
   * Light impact (button press-in, card tap, expand drawer)
   */
  light: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignored safely
    }
  },

  /**
   * Medium impact (open sheet, trigger action)
   */
  medium: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Ignored safely
    }
  },

  /**
   * Success notification pulse (mark video watched, link extension successful)
   */
  success: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignored safely
    }
  },

  /**
   * Warning / Destructive pulse (logout confirmation, unlinking device)
   */
  warning: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Ignored safely
    }
  },
};
