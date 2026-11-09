import React, { useEffect, useRef } from "react";
import {
  TouchableOpacity,
  View,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { haptics } from "../utils/haptics";

export interface AppleSwitchProps {
  value: boolean;
  onValueChange?: (val: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  activeThumbColor?: string;
  inactiveThumbColor?: string;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md";
}

/**
 * AppleSwitch — Authentic Apple HIG / Threads Monochrome Toggle Switch
 * - High-Contrast Black & White aesthetic
 *   - OFF: Translucent glass track + Crisp pure White thumb
 *   - ON: Crisp pure White track + Pitch Black thumb
 * - Fluid 60fps native spring-driven travel & opacity crossfade
 * - Realistic iOS specular depth shadow
 * - Tactile haptic feedback on toggle
 */
export const AppleSwitch: React.FC<AppleSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  activeColor = "#FFFFFF",
  inactiveColor = "rgba(255, 255, 255, 0.16)",
  thumbColor,
  activeThumbColor = "#000000",
  inactiveThumbColor = "#FFFFFF",
  style,
  size = "md",
}) => {
  // Dimensions
  const isSm = size === "sm";
  const trackWidth = isSm ? 40 : 46;
  const trackHeight = isSm ? 24 : 27;
  const trackRadius = trackHeight / 2;
  const thumbSize = isSm ? 20 : 23;
  const thumbRadius = thumbSize / 2;
  const inset = 2;
  const maxTravel = trackWidth - thumbSize - inset; // e.g. 46 - 23 - 2 = 21

  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  // Resolved thumb colors
  const finalActiveThumb = thumbColor || activeThumbColor;
  const finalInactiveThumb = thumbColor || inactiveThumbColor;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      damping: 20,
      stiffness: 320,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const handlePress = () => {
    if (disabled || !onValueChange) return;
    haptics.selection();
    onValueChange(!value);
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inset, maxTravel],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={disabled}
      delayPressIn={0}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.container,
        {
          width: trackWidth,
          height: trackHeight,
          borderRadius: trackRadius,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {/* 1. Base Inactive Track (Dark frosted glass) */}
      <View
        style={[
          styles.trackBase,
          {
            borderRadius: trackRadius,
            backgroundColor: inactiveColor,
          },
        ]}
      />

      {/* 2. Active Track Crossfade Overlay (Pure White) */}
      <Animated.View
        style={[
          styles.trackActive,
          {
            borderRadius: trackRadius,
            backgroundColor: activeColor,
            opacity: anim,
          },
        ]}
      />

      {/* 3. Concentric Floating Thumb Container */}
      <Animated.View
        style={[
          styles.thumbContainer,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbRadius,
            top: inset,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Base Inactive Thumb (Crisp White) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: thumbRadius,
              backgroundColor: finalInactiveThumb,
            },
          ]}
        />

        {/* Active Thumb Crossfade Overlay (Solid Black) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: thumbRadius,
              backgroundColor: finalActiveThumb,
              opacity: anim,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    overflow: "visible",
  },
  trackBase: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  trackActive: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbContainer: {
    position: "absolute",
    left: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    overflow: "hidden",
  },
});
