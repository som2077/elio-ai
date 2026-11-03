import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

export type TabKey = "feed" | "search" | "insights" | "devices";

interface FloatingTabBarProps {
  activeTab: TabKey;
  unreadCount?: number;
  onTabSelect: (tab: TabKey) => void;
  onComposePress?: () => void;
}

/**
 * Twitter / X Inspired Frosted Glass Translucent Navigation Bar
 * Features:
 * - Native BlurView backdrop with 85 intensity
 * - Translucent obsidian glass tint (rgba(0, 0, 0, 0.75))
 * - Hairline top divider (rgba(255, 255, 255, 0.12))
 * - Pure flat glyphs with active white & inactive muted state
 * - Twitter blue notification badge dot
 */
export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  unreadCount = 0,
  onTabSelect,
  onComposePress,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.barContainer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {/* Twitter Frosted Glass Backdrop Blur */}
      <BlurView
        intensity={70}
        tint="systemUltraThinMaterialDark"
        blurReductionFactor={2}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.tabRow}>
        {/* 1. Home / Watchlist Feed */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => {
            if (activeTab !== "feed") {
              haptics.selection();
              onTabSelect("feed");
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name={activeTab === "feed" ? "home" : "home-outline"}
              size={23}
              color={activeTab === "feed" ? "#FFFFFF" : "#71767B"}
            />
          </View>
        </TouchableOpacity>

        {/* 2. Search / Explore */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => {
            if (activeTab !== "search") {
              haptics.selection();
              onTabSelect("search");
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name={activeTab === "search" ? "search" : "search-outline"}
              size={23}
              color={activeTab === "search" ? "#FFFFFF" : "#71767B"}
            />
          </View>
        </TouchableOpacity>

        {/* 3. Fast Clip (+) Button */}
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.tabItem}
          onPress={() => {
            haptics.selection();
            if (onComposePress) {
              onComposePress();
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name="add-outline"
              size={26}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>

        {/* 4. Insights & Analytics */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => {
            if (activeTab !== "insights") {
              haptics.selection();
              onTabSelect("insights");
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name={activeTab === "insights" ? "stats-chart" : "stats-chart-outline"}
              size={22}
              color={activeTab === "insights" ? "#FFFFFF" : "#71767B"}
            />
            {Boolean(unreadCount && unreadCount > 0) && (
              <View style={styles.blueBadgeDot} />
            )}
          </View>
        </TouchableOpacity>

        {/* 5. Profile / Linked Devices */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => {
            if (activeTab !== "devices") {
              haptics.selection();
              onTabSelect("devices");
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name={activeTab === "devices" ? "person" : "person-outline"}
              size={22}
              color={activeTab === "devices" ? "#FFFFFF" : "#71767B"}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    paddingTop: 8,
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
    width: 32,
    height: 32,
  },
  blueBadgeDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#1D9BF0",
    borderWidth: 1.5,
    borderColor: "#000000",
  },
});
