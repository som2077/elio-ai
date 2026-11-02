import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Standard Motion Tokens adhering to Motion System v4.2
 * Focused on responsiveness, usability, and spatial continuity.
 */
export const motionTokens = {
  duration: {
    fast: 160,    // ms (micro-interactions, button taps)
    normal: 260,  // ms (card transitions, layout flow)
    slow: 400,    // ms (calendar drawer, modal reveals)
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as const,
    sharp: [0.4, 0, 0.2, 1] as const,
  },
  scale: {
    pressed: 0.98,
    buttonTap: 0.94,
    bounce: 1.08,
  },
};

/**
 * Trigger smooth native layout transition across React Native state updates
 */
export const triggerLayoutMotion = (duration = motionTokens.duration.normal) => {
  try {
    LayoutAnimation.configureNext({
      duration,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        springDamping: 0.8,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch (err) {
    // Graceful fallback for environments where layout animation is restricted
  }
};
