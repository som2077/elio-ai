import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

export const HEADER_COLLAPSIBLE_HEIGHT = 122;

const PLATFORM_LABELS: Record<string, string> = {
  all: "All",
  youtube: "YouTube",
  instagram: "Instagram",
  twitter: "Twitter / 𝕏",
  reddit: "Reddit",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
};

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  onOpenScanner: () => void;
  onOpenSearch?: () => void;
  onOpenFeedsDrawer?: () => void;
  translateY?: Animated.Value;
  // Filter props
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
  selectedContentType: "all" | "video" | "liked";
  onSelectContentType: (type: "all" | "video" | "liked") => void;
  pinnedPlatforms: string[];
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
  selectedContentType,
  onSelectContentType,
  pinnedPlatforms,
  onOpenPlatformModal,
}) => {
  const insets = useSafeAreaInsets();
  const qrScale = useRef(new Animated.Value(1)).current;
  const searchScale = useRef(new Animated.Value(1)).current;

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
        inputRange: [-HEADER_COLLAPSIBLE_HEIGHT, -24, 0],
        outputRange: [0, 0.7, 1],
        extrapolate: "clamp",
      })
    : 1;

  // Subtle status bar blur fades in as the header bar collapses ("littel littel blur" like Twitter)
  const statusBarBlurOpacity = translateY
    ? translateY.interpolate({
        inputRange: [-HEADER_COLLAPSIBLE_HEIGHT, -24, 0],
        outputRange: [1, 0.3, 0],
        extrapolate: "clamp",
      })
    : 0;

  return (
    <>
      {/* 1. Subtle Linear Gradient Status Bar Blur (Twitter's exact linear blur on scroll) */}
      <Animated.View
        style={[
          styles.statusBarBlurContainer,
          {
            height: insets.top - 20,
            opacity: statusBarBlurOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <BlurView
          intensity={2}
          tint="systemUltraThinMaterialDark"
          blurReductionFactor={12}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.42)", "rgba(0, 0, 0, 0.20)", "transparent"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 2. Full Unified Header Container (Status bar + Top bar + Filter tabs + Sub-filters) */}
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
          intensity={50}
          tint="systemUltraThinMaterialDark"
          blurReductionFactor={2}
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

          {/* Right Actions: QR Scanner & Search Button */}
          <View style={styles.actionsRight}>
            <Animated.View style={{ transform: [{ scale: qrScale }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.iconBtn}
                onPressIn={() => animatePressIn(qrScale)}
                onPressOut={() => animatePressOut(qrScale)}
                onPress={() => {
                  haptics.selection();
                  onOpenScanner();
                }}
              >
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: searchScale }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.iconBtn}
                onPressIn={() => animatePressIn(searchScale)}
                onPressOut={() => animatePressOut(searchScale)}
                onPress={() => {
                  haptics.selection();
                  if (onOpenSearch) onOpenSearch();
                }}
              >
                <Ionicons name="search-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Row 2: Twitter-style Horizontal Tabs Bar */}
        <View style={styles.tabsRow}>
          {/* "Platforms" Trigger Button (Opens Bottom Sheet) */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.platformsTriggerBtn}
            onPress={() => {
              haptics.selection();
              onOpenPlatformModal();
            }}
          >
            <Ionicons
              name="options-outline"
              size={14}
              color="#1D9BF0"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.platformsTriggerText}>Platforms</Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color="#71767B"
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>

          <View style={styles.tabsDivider} />

          {/* Horizontally Scrollable Platform Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {/* "All" Platform Tab */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.tabItem}
              onPress={() => {
                haptics.selection();
                onSelectPlatform("all");
              }}
            >
              <Text
                style={[
                  styles.tabItemText,
                  selectedPlatform === "all" && styles.tabItemTextActive,
                ]}
              >
                All
              </Text>
              {selectedPlatform === "all" && (
                <View style={styles.activeUnderline} />
              )}
            </TouchableOpacity>

            {/* Pinned Platforms (3-4 by default, more added via bottom sheet) */}
            {pinnedPlatforms.map((platformKey) => {
              const isActive = selectedPlatform === platformKey;
              const label = PLATFORM_LABELS[platformKey] || platformKey;
              return (
                <TouchableOpacity
                  key={platformKey}
                  activeOpacity={0.7}
                  style={styles.tabItem}
                  onPress={() => {
                    haptics.selection();
                    onSelectPlatform(platformKey);
                  }}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      isActive && styles.tabItemTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {isActive && <View style={styles.activeUnderline} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Row 3: Sub-filter Micro-Pills (All | Videos | Likes) */}
        <View style={styles.subFilterRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.subFilterPill,
              selectedContentType === "all" && styles.subFilterPillActive,
            ]}
            onPress={() => {
              haptics.selection();
              onSelectContentType("all");
            }}
          >
            <Text
              style={[
                styles.subFilterText,
                selectedContentType === "all" && styles.subFilterTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.subFilterPill,
              selectedContentType === "video" && styles.subFilterPillActive,
            ]}
            onPress={() => {
              haptics.selection();
              onSelectContentType("video");
            }}
          >
            <Ionicons
              name="play-circle-outline"
              size={13}
              color={selectedContentType === "video" ? "#1D9BF0" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.subFilterText,
                selectedContentType === "video" && styles.subFilterTextActive,
              ]}
            >
              Videos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.subFilterPill,
              selectedContentType === "liked" && styles.subFilterPillActive,
            ]}
            onPress={() => {
              haptics.selection();
              onSelectContentType("liked");
            }}
          >
            <Ionicons
              name="heart"
              size={12}
              color={selectedContentType === "liked" ? "#F91880" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.subFilterText,
                selectedContentType === "liked" && styles.subFilterTextActive,
              ]}
            >
              Likes
            </Text>
          </TouchableOpacity>
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
    overflow: "hidden",
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "relative",
  },
  iconBtn: {
    width: 38,
    height: 38,
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
    width: 44,
    height: 44,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabsRow: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  platformsTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  platformsTriggerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  tabsDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 8,
  },
  tabsScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  tabItem: {
    paddingHorizontal: 12,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabItemText: {
    color: "#71767B",
    fontSize: 14,
    fontWeight: "600",
  },
  tabItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  activeUnderline: {
    position: "absolute",
    bottom: 2,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#1D9BF0",
  },
  subFilterRow: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  subFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  subFilterPillActive: {
    backgroundColor: "rgba(29, 155, 240, 0.18)",
    borderColor: "rgba(29, 155, 240, 0.45)",
  },
  subFilterText: {
    color: "#71767B",
    fontSize: 12,
    fontWeight: "600",
  },
  subFilterTextActive: {
    color: "#1D9BF0",
    fontWeight: "700",
  },
});
