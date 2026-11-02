import { Platform } from "react-native";

let ExpoHaptics: any = null;
try {
  ExpoHaptics = require("expo-haptics");
} catch {
  // Native module not linked in current binary, fallback safely
}

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
    if (Platform.OS === "web") return;
    try {
      if (ExpoHaptics?.selectionAsync) {
        await ExpoHaptics.selectionAsync();
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Light impact (button press-in, card tap, expand drawer)
   */
  light: async () => {
    if (Platform.OS === "web") return;
    try {
      if (ExpoHaptics?.impactAsync && ExpoHaptics?.ImpactFeedbackStyle?.Light) {
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Medium impact (open sheet, trigger action)
   */
  medium: async () => {
    if (Platform.OS === "web") return;
    try {
      if (
        ExpoHaptics?.impactAsync &&
        ExpoHaptics?.ImpactFeedbackStyle?.Medium
      ) {
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Heavy impact (delete item, critical toggle)
   */
  heavy: async () => {
    if (Platform.OS === "web") return;
    try {
      if (ExpoHaptics?.impactAsync && ExpoHaptics?.ImpactFeedbackStyle?.Heavy) {
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Success notification pulse (mark video watched, link extension successful)
   */
  success: async () => {
    if (Platform.OS === "web") return;
    try {
      if (
        ExpoHaptics?.notificationAsync &&
        ExpoHaptics?.NotificationFeedbackType?.Success
      ) {
        await ExpoHaptics.notificationAsync(
          ExpoHaptics.NotificationFeedbackType.Success,
        );
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Warning pulse (unsaved changes, confirmation trigger)
   */
  warning: async () => {
    if (Platform.OS === "web") return;
    try {
      if (
        ExpoHaptics?.notificationAsync &&
        ExpoHaptics?.NotificationFeedbackType?.Warning
      ) {
        await ExpoHaptics.notificationAsync(
          ExpoHaptics.NotificationFeedbackType.Warning,
        );
      }
    } catch {
      // Ignored safely
    }
  },

  /**
   * Error warning pulse (network failure, revoke error)
   */
  error: async () => {
    if (Platform.OS === "web") return;
    try {
      if (
        ExpoHaptics?.notificationAsync &&
        ExpoHaptics?.NotificationFeedbackType?.Error
      ) {
        await ExpoHaptics.notificationAsync(
          ExpoHaptics.NotificationFeedbackType.Error,
        );
      }
    } catch {
      // Ignored safely
    }
  },
};
