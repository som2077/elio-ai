import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PikaIcon } from "./PikaIcon";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PlatformIcon } from "./PlatformIcon";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

export const HEADER_COLLAPSIBLE_HEIGHT = 104;

const PLATFORM_LABELS: Record<string, string> = {
  all: "Queue",
  youtube: "YouTube",
  instagram: "Instagram",
  twitter: "Twitter / 𝕏",
  reddit: "Reddit",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
};

const PLATFORM_COLORS: Record<string, string> = {
  all: "#FFFFFF",
  youtube: "#FF0033",
  instagram: "#E1306C",
  twitter: "#1D9BF0",
  reddit: "#FF4500",
  tiktok: "#00F2FE",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
};

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  onOpenScanner?: () => void;
  onOpenSearch?: () => void;
  onOpenFeedsDrawer?: () => void;
  translateY?: Animated.Value;
  // Filter props
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
  onPressActiveTab?: () => void;
  pinnedPlatforms: string[];
  platformCounts?: Record<string, number>;
  onOpenPlatformModal: () => void;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  userEmail: _userEmail,
  totalCount: _totalCount,
  unreadCount: _unreadCount,
  onOpenScanner,
  onOpenSearch,
  onOpenFeedsDrawer,
  translateY,
  selectedPlatform,
  onSelectPlatform,
  onPressActiveTab,
  pinnedPlatforms,
  platformCounts,
  onOpenPlatformModal,
}) => {
  const insets = useSafeAreaInsets();
  const [isSearchPressed, setIsSearchPressed] = useState(false);
  const searchScale = useRef(new Animated.Value(1)).current;

  // Sliding indicator refs
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const tabsScrollViewRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const indicatorWidthAnim = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const hasInitializedIndicator = useRef(false);

  const updateIndicator = (
    targetX: number,
    targetWidth: number,
    immediate: boolean,
  ) => {
    if (immediate) {
      indicatorAnim.setValue(targetX);
      indicatorWidthAnim.setValue(targetWidth);
      indicatorOpacity.setValue(1);
      hasInitializedIndicator.current = true;
    } else {
      Animated.parallel([
        Animated.spring(indicatorAnim, {
          toValue: targetX,
          damping: 24,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: false,
        }),
        Animated.spring(indicatorWidthAnim, {
          toValue: targetWidth,
          damping: 24,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  const handleTabLayout = (key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabLayouts.current[key] = { x, width };

    if (key === selectedPlatform) {
      const targetWidth = Math.max(26, width - 20);
      const targetX = x + (width - targetWidth) / 2;
      updateIndicator(targetX, targetWidth, !hasInitializedIndicator.current);
    }
  };

  // When selected platform changes, animate indicator and auto-center tab
  useEffect(() => {
    const layout = tabLayouts.current[selectedPlatform];
    if (layout) {
      const targetWidth = Math.max(26, layout.width - 20);
      const targetX = layout.x + (layout.width - targetWidth) / 2;
      updateIndicator(targetX, targetWidth, false);

      // Auto-center in horizontal ScrollView
      const screenWidth = Dimensions.get("window").width;
      const scrollTargetX = Math.max(
        0,
        layout.x - (screenWidth / 2 - layout.width / 2),
      );
      tabsScrollViewRef.current?.scrollTo({
        x: scrollTargetX,
        animated: true,
      });
    }
  }, [selectedPlatform]);

  const animatePressIn = (val: Animated.Value) => {
    Animated.spring(val, {
      toValue: motionTokens.scale.pressed,
      useNativeDriver: true,
      damping: motionTokens.spring.settle.damping,
      stiffness: motionTokens.spring.settle.stiffness,
    }).start();
  };

  const animatePressOut = (val: Animated.Value) => {
    Animated.spring(val, {
      toValue: 1,
      useNativeDriver: true,
      damping: motionTokens.spring.bouncy.damping,
      stiffness: motionTokens.spring.bouncy.stiffness,
    }).start();
  };

  // Header container slides up and smoothly fades out on scroll
  const barOpacity = translateY
    ? translateY.interpolate({
        inputRange: [-HEADER_COLLAPSIBLE_HEIGHT, -20, 0],
        outputRange: [0, 0.7, 1],
        extrapolate: "clamp",
      })
    : 1;

  // Subtle status bar blur fades in as the header bar collapses
  const statusBarBlurOpacity = translateY
    ? translateY.interpolate({
        inputRange: [-HEADER_COLLAPSIBLE_HEIGHT, -20, 0],
        outputRange: [1, 0.3, 0],
        extrapolate: "clamp",
      })
    : 0;

  const allCount = platformCounts?.all ?? 0;

  return (
    <>
      {/* 1. Subtle Linear Gradient Status Bar Blur (Twitter's exact linear blur on scroll) */}
      <Animated.View
        style={[
          styles.statusBarBlurContainer,
          {
            height: insets.top + 32,
            opacity: statusBarBlurOpacity,
          },
        ]}
        pointerEvents="none"
      >
        {Platform.OS === "ios" && (
          <BlurView
            intensity={25}
            tint="systemUltraThinMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={[
            "rgba(16, 16, 16, 0.88)",
            "rgba(16, 16, 16, 0.68)",
            "rgba(16, 16, 16, 0.40)",
            "rgba(16, 16, 16, 0.18)",
            "rgba(16, 16, 16, 0.04)",
            "rgba(16, 16, 16, 0)",
          ]}
          locations={[0, 0.35, 0.58, 0.78, 0.92, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 2. Full Unified Header Container (Status bar + Top bar + Platform tabs) */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            height: insets.top + HEADER_COLLAPSIBLE_HEIGHT,
            paddingTop: insets.top,
            transform: [{ translateY: translateY || 0 }],
            opacity: barOpacity,
          },
        ]}
      >
        {/* Seamless full-height BlurView across entire header pane */}
        <BlurView
          intensity={Platform.OS === "ios" ? 50 : 25}
          tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
          blurReductionFactor={Platform.OS === "android" ? 2 : 1}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />

        {/* Row 1: Hamburger, Center Logo, QR, Search */}
        <View style={styles.topBar}>
          {/* Left Hamburger Drawer Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            onPress={() => {
              haptics.selection();
              if (onOpenFeedsDrawer) onOpenFeedsDrawer();
            }}
          >
            <Ionicons name="reorder-two-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Center Logo */}
          <View style={styles.logoCenter} pointerEvents="none">
            <Image
              source={require("../assets/centerImage.png")}
              style={styles.elioLogo}
              resizeMode="contain"
            />
          </View>

          {/* Right Action: Search Button */}
          <View style={styles.actionsRight}>
            <Animated.View style={{ transform: [{ scale: searchScale }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.iconBtn}
                onPressIn={() => {
                  setIsSearchPressed(true);
                  animatePressIn(searchScale);
                }}
                onPressOut={() => {
                  setIsSearchPressed(false);
                  animatePressOut(searchScale);
                }}
                onPress={() => {
                  haptics.selection();
                  if (onOpenSearch) onOpenSearch();
                }}
              >
                <PikaIcon
                  name={isSearchPressed ? "SearchSolidIcon" : "SearchIcon"}
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Row 2: Twitter-style Clean Horizontal Tabs Bar with Smooth Sliding Indicator */}
        <View style={styles.tabsRow}>
          <ScrollView
            ref={tabsScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {/* "Platforms" Trigger Tab (Opens Bottom Sheet Modal) */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.tabItem}
              onPress={() => {
                haptics.selection();
                onOpenPlatformModal();
              }}
            >
              <View style={styles.tabItemInner}>
                <Text style={styles.platformsTabText}>Platforms</Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color="#71767B"
                  style={{ marginLeft: 3 }}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.tabsDivider} />

            {/* "Queue" Platform Tab */}
            <TouchableOpacity
              key="all"
              activeOpacity={0.7}
              style={styles.tabItem}
              onLayout={(e) => handleTabLayout("all", e)}
              onPress={() => {
                if (selectedPlatform === "all") {
                  onPressActiveTab?.();
                } else {
                  haptics.selection();
                  onSelectPlatform("all");
                }
              }}
            >
              <View style={styles.tabItemInner}>
                <Text
                  style={[
                    styles.tabItemText,
                    selectedPlatform === "all" && styles.tabItemTextActive,
                  ]}
                >
                  Queue
                </Text>
                {allCount > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      selectedPlatform === "all" && styles.tabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        selectedPlatform === "all" && styles.tabBadgeTextActive,
                      ]}
                    >
                      {allCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Pinned Platforms (YouTube, Instagram, Twitter, Reddit, etc.) */}
            {pinnedPlatforms.map((platformKey) => {
              const isActive = selectedPlatform === platformKey;
              const label = PLATFORM_LABELS[platformKey] || platformKey;
              const count = platformCounts
                ? platformCounts[platformKey] || 0
                : 0;
              return (
                <TouchableOpacity
                  key={platformKey}
                  activeOpacity={0.7}
                  style={styles.tabItem}
                  onLayout={(e) => handleTabLayout(platformKey, e)}
                  onPress={() => {
                    if (isActive) {
                      onPressActiveTab?.();
                    } else {
                      haptics.selection();
                      onSelectPlatform(platformKey);
                    }
                  }}
                >
                  <View style={styles.tabItemInner}>
                    <PlatformIcon
                      platform={platformKey}
                      size={13}
                      color={
                        isActive
                          ? PLATFORM_COLORS[platformKey] || "#FFFFFF"
                          : "#71767B"
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabItemText,
                        isActive && styles.tabItemTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.tabBadge,
                          isActive && styles.tabBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabBadgeText,
                            isActive && styles.tabBadgeTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Single Industry Grade Fluid Sliding Indicator Underline */}
            <Animated.View
              style={[
                styles.slidingIndicator,
                {
                  backgroundColor:
                    PLATFORM_COLORS[selectedPlatform] || "#1D9BF0",
                  width: indicatorWidthAnim,
                  transform: [{ translateX: indicatorAnim }],
                  opacity: indicatorOpacity,
                },
              ]}
              pointerEvents="none"
            />
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  statusBarBlurContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    overflow: "hidden",
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
    backgroundColor: "rgba(16, 16, 16, 0.85)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "relative",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  elioLogo: {
    width: 52,
    height: 52,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabsRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  tabsScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    position: "relative",
  },
  tabItem: {
    paddingHorizontal: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformsTabText: {
    color: "#E7E9EA",
    fontSize: 15,
    fontWeight: "700",
  },
  tabsDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#2F3336",
    marginHorizontal: 4,
  },
  tabItemText: {
    color: "#71767B",
    fontSize: 15,
    fontWeight: "600",
  },
  tabItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  tabBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#71767B",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  slidingIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3.5,
    borderRadius: 2,
    zIndex: 10,
  },
});
