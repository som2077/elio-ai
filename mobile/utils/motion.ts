import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Apple WWDC Designing Fluid Interfaces Spring Parameters
 * Damping 1.0 = critically damped (smooth settle, zero overshoot)
 * Damping 0.8 = momentum bounce (used for flick releases and physical pops)
 */
export const motionTokens = {
  spring: {
    // Non-distracting layout transition (critically damped)
    settle: {
      damping: 1.0,
      mass: 1,
      stiffness: 180,
    },
    // Tactile bouncy response (button pop, checkmark burst)
    bouncy: {
      damping: 0.78,
      mass: 0.8,
      stiffness: 220,
    },
  },
  scale: {
    pressed: 0.96,       // Apple touch-down physical depression
    buttonTap: 0.92,     // Compact control tap
    checkmarkBurst: 1.14,// Checkmark completion pop
  },
  duration: {
    fast: 140,
    normal: 240,
    sheet: 340,
  },
};

/**
 * Trigger smooth Apple-style native layout transition across React Native state updates
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
        type: LayoutAnimation.Types.spring,
        springDamping: 0.82,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // Graceful fallback
  }
};
