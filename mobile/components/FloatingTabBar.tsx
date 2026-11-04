import React, { useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { haptics } from "../utils/haptics";

export type TabKey = "feed" | "search" | "insights" | "devices";

interface FloatingTabBarProps {
  activeTab: TabKey;
  unreadCount?: number;
  onTabSelect: (tab: TabKey) => void;
  onComposePress?: () => void;
  translateY?: Animated.Value | Animated.AnimatedInterpolation<number>;
}

interface AnimatedTabItemProps {
  isActive: boolean;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  inactiveIcon?: keyof typeof Ionicons.glyphMap;
  customIconSource?: any;
  iconSize: number;
  onPress: () => void;
  showBadge?: boolean;
  isCompose?: boolean;
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
  isCompose = false,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(showBadge ? 1 : 0)).current;

  // Twitter / Threads signature spring pop when tab becomes active
  useEffect(() => {
    if (isActive) {
      scale.setValue(0.8);
      Animated.spring(scale, {
        toValue: 1,
        damping: 10,
        stiffness: 280,
        mass: 0.6,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  // Spring animation for notification badge
  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: showBadge ? 1 : 0,
      damping: 12,
      stiffness: 280,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [showBadge]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.82,
      damping: 18,
      stiffness: 320,
      useNativeDriver: true,
    }).start();

    if (isCompose) {
      Animated.spring(rotate, {
        toValue: 1,
        damping: 12,
        stiffness: 240,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 10,
      stiffness: 280,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

    if (isCompose) {
      Animated.spring(rotate, {
        toValue: 0,
        damping: 12,
        stiffness: 220,
        useNativeDriver: true,
      }).start();
    }
  };

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.tabItem}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [{ scale }, ...(isCompose ? [{ rotate: spin }] : [])],
          },
        ]}
      >
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
          <Ionicons
            name={isActive || isCompose ? activeIcon! : inactiveIcon!}
            size={iconSize}
            color={isActive || isCompose ? "#FFFFFF" : "#71767B"}
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
      </Animated.View>
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
  unreadCount = 0,
  onTabSelect,
  onComposePress,
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
          customIconSource={require("../assets/home.png")}
          iconSize={28}
          onPress={() => {
            if (activeTab !== "feed") {
              onTabSelect("feed");
            }
          }}
        />

        {/* 2. Fast Clip (+) Button */}
        <AnimatedTabItem
          isActive={false}
          activeIcon="add-outline"
          inactiveIcon="add-outline"
          iconSize={28}
          isCompose={true}
          onPress={() => {
            if (onComposePress) {
              onComposePress();
            }
          }}
        />

        {/* 3. Insights & Analytics */}
        <AnimatedTabItem
          isActive={activeTab === "insights"}
          customIconSource={require("../assets/insight.png")}
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
          customIconSource={require("../assets/profile.png")}
          iconSize={27}
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
