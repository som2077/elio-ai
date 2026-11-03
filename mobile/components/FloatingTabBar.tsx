import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
 * Essential Functional Bottom Navigation Dock
 * Features:
 * 1. Home (Watchlist & Saved Clips Feed)
 * 2. Compose / '+' (1-Tap Video URL Clipper)
 * 3. Insights (Activity & All Data Telemetry)
 * 4. Profile / Devices (Paired Desktop Extension Sync & Account)
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
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
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
          <View style={{ position: "relative" }}>
            <Ionicons
              name={activeTab === "feed" ? "home" : "home-outline"}
              size={24}
              color={activeTab === "feed" ? "#FFFFFF" : threadsTokens.colors.textSecondary}
            />
            {Boolean(unreadCount && unreadCount > 0) && (
              <View style={styles.redDot} />
            )}
          </View>
        </TouchableOpacity>

        {/* 2. Fast Clip (+) Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.composeItem}
          onPress={() => {
            haptics.selection();
            if (onComposePress) {
              onComposePress();
            }
          }}
        >
          <View style={styles.composeBox}>
            <Ionicons name="add" size={21} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* 4. Insights & All Data */}
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
          <Ionicons
            name={activeTab === "insights" ? "stats-chart" : "stats-chart-outline"}
            size={22}
            color={activeTab === "insights" ? "#FFFFFF" : threadsTokens.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* 5. Profile & Linked Devices */}
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
          <Ionicons
            name={activeTab === "devices" ? "person" : "person-outline"}
            size={24}
            color={activeTab === "devices" ? "#FFFFFF" : threadsTokens.colors.textSecondary}
          />
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
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    paddingTop: 10,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  composeItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  composeBox: {
    width: 36,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#282828",
    alignItems: "center",
    justifyContent: "center",
  },
  redDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: threadsTokens.colors.likeRed,
  },
});
