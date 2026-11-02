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
import { appleColors, appleRadii } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

export type TabKey = "feed" | "search" | "insights" | "devices";

interface FloatingTabBarProps {
  activeTab: TabKey;
  unreadCount?: number;
  onTabSelect: (tab: TabKey) => void;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  unreadCount = 0,
  onTabSelect,
}) => {
  const insets = useSafeAreaInsets();

  const tabs: {
    key: TabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    badge?: number;
  }[] = [
    {
      key: "feed",
      label: "Watchlist",
      icon: "film-outline",
      activeIcon: "film",
      badge: unreadCount,
    },
    {
      key: "search",
      label: "Search",
      icon: "search-outline",
      activeIcon: "search",
    },
    {
      key: "insights",
      label: "Insights",
      icon: "stats-chart-outline",
      activeIcon: "stats-chart",
    },
    {
      key: "devices",
      label: "Devices",
      icon: "hardware-chip-outline",
      activeIcon: "hardware-chip",
    },
  ];

  return (
    <View
      style={[
        styles.dockContainer,
        {
          bottom: Math.max(insets.bottom + 8, 20),
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.glassDock}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => {
                if (!isActive) {
                  haptics.selection();
                  onTabSelect(tab.key);
                }
              }}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={20}
                  color={isActive ? "#FFFFFF" : appleColors.textTertiary}
                />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                      {tab.badge! > 99 ? "99+" : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeGlowDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  glassDock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(14, 18, 30, 0.94)",
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 24,
    minWidth: 70,
  },
  activeTabButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  activeTabLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  inactiveTabLabel: {
    color: appleColors.textTertiary,
  },
  activeGlowDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: appleColors.accentLight,
    marginTop: 2,
  },
  badgePill: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: appleColors.accent,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#0E121E",
  },
  badgeText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
  },
});
