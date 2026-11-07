import React, { useRef, useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PikaIcon } from "./PikaIcon";
import { BlurView } from "expo-blur";
import { haptics } from "../utils/haptics";

export type TabKey = "feed" | "ai" | "search" | "insights" | "devices";

interface FloatingTabBarProps {
  activeTab: TabKey;
  isAIActive?: boolean;
  unreadCount?: number;
  onTabSelect: (tab: TabKey) => void;
  onComposePress?: () => void;
  onOpenAskElio?: () => void;
  translateY?: Animated.Value | Animated.AnimatedInterpolation<number>;
}

interface AnimatedTabItemProps {
  isActive: boolean;
  activeIcon?: string;
  inactiveIcon?: string;
  customIconSource?: any;
  iconSize: number;
  onPress: () => void;
  showBadge?: boolean;
  isCompose?: boolean;
  iconColor?: string;
}

/**
 * Twitter (X) & Meta Threads Inspired Animated Tab Button
 * Micro-interactions:
 * - Fluid tactile press depression on touch-down
 * - Physical spring overshoot pop on selection / release
 * - 45° rotation spin pop for the compose (+) button
 * - Animated spring entry for the notification badge dot
 */
const AnimatedTabItem: React.FC<AnimatedTabItemProps> = ({
  isActive,
  activeIcon,
  inactiveIcon,
  customIconSource,
  iconSize,
  onPress,
  showBadge = false,
  iconColor,
}) => {
  const badgeScale = useRef(new Animated.Value(showBadge ? 1 : 0)).current;

  // Spring animation for notification badge
  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: showBadge ? 1 : 0,
      damping: 16,
      stiffness: 280,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [showBadge]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.tabItem}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      <View style={styles.iconWrapper}>
        {customIconSource ? (
          <Image
            source={customIconSource}
            style={{
              width: iconSize,
              height: iconSize,
              tintColor: isActive ? "#FFFFFF" : "#71767B",
              opacity: isActive ? 1 : 0.65,
            }}
            resizeMode="contain"
          />
        ) : (
          <PikaIcon
            name={isActive ? activeIcon! : inactiveIcon!}
            size={iconSize}
            color={iconColor ? iconColor : isActive ? "#FFFFFF" : "#71767B"}
          />
        )}

        <Animated.View
          style={[
            styles.blueBadgeDot,
            {
              transform: [{ scale: badgeScale }],
              opacity: badgeScale,
            },
          ]}
          pointerEvents="none"
        />
      </View>
    </TouchableOpacity>
  );
};

/**
 * Twitter / X & Meta Threads Frosted Glass Navigation Bar
 * Features:
 * - Ultra-responsive animated icons with Apple/Twitter spring physics
 * - Translucent obsidian glass blur backdrop
 * - Hairline top divider (rgba(255, 255, 255, 0.12))
 * - Twitter blue notification badge dot
 */
export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  isAIActive = false,
  unreadCount = 0,
  onTabSelect,
  onComposePress,
  onOpenAskElio,
  translateY,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[
        styles.barContainer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          transform: [{ translateY: translateY || 0 }],
        },
      ]}
    >
      {/* Authentic Frosted Glass Blur Backdrop */}
      <BlurView
        intensity={Platform.OS === "ios" ? 75 : 40}
        tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
        blurReductionFactor={Platform.OS === "android" ? 3 : 1}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle translucent obsidian glass tint for icon contrast */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(16, 16, 16, 0.50)" },
        ]}
        pointerEvents="none"
      />

      <View style={styles.tabRow}>
        {/* 1. Home / Watchlist Feed */}
        <AnimatedTabItem
          isActive={activeTab === "feed"}
          activeIcon="HomeSimpleSolidIcon"
          inactiveIcon="HomeSimpleContrastIcon"
          iconSize={26}
          onPress={() => {
            if (activeTab !== "feed") {
              onTabSelect("feed");
            }
          }}
        />

        {/* 2. Ask Elio (AI) Tab */}
        <AnimatedTabItem
          isActive={activeTab === "ai" || isAIActive}
          activeIcon="LightningThunderElectricOnSolidIcon"
          inactiveIcon="LightningThunderElectricOnIcon"
          iconSize={26}
          onPress={() => {
            if (activeTab !== "ai") {
              onTabSelect("ai");
            }
          }}
        />

        {/* 3. Insights & Analytics */}
        <AnimatedTabItem
          isActive={activeTab === "insights"}
          activeIcon="bar-chart-solid"
          inactiveIcon="bar-chart-outline"
          iconSize={26}
          showBadge={Boolean(unreadCount && unreadCount > 0)}
          onPress={() => {
            if (activeTab !== "insights") {
              onTabSelect("insights");
            }
          }}
        />

        {/* 4. Profile / Linked Devices */}
        <AnimatedTabItem
          isActive={activeTab === "devices"}
          activeIcon="UserSolidIcon"
          inactiveIcon="UserContrastIcon"
          iconSize={26}
          onPress={() => {
            if (activeTab !== "devices") {
              onTabSelect("devices");
            }
          }}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    paddingTop: 8,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    height: 44,
  },
  tabItem: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  blueBadgeDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#1D9BF0",
    borderWidth: 1.5,
    borderColor: "#101010",
  },
});
