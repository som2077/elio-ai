import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { appleColors, appleRadii, appleTypography } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { SavedVideo } from "../types/video";

export type FilterCategory =
  | "all"
  | "unread"
  | "youtube"
  | "instagram"
  | "twitter"
  | "facebook"
  | "reddit"
  | "linkedin"
  | "pinterest"
  | "tiktok";

interface FilterTab {
  key: FilterCategory;
  label: string;
  icon?: string;
}

const TABS: FilterTab[] = [
  { key: "all", label: "All", icon: "layers-outline" },
  { key: "unread", label: "In Queue", icon: "time-outline" },
  { key: "youtube", label: "YouTube", icon: "logo-youtube" },
  { key: "instagram", label: "Instagram", icon: "logo-instagram" },
  { key: "twitter", label: "X", icon: "logo-twitter" },
  { key: "reddit", label: "Reddit", icon: "logo-reddit" },
  { key: "tiktok", label: "TikTok", icon: "musical-notes-outline" },
  { key: "facebook", label: "Facebook", icon: "logo-facebook" },
  { key: "linkedin", label: "LinkedIn", icon: "logo-linkedin" },
  { key: "pinterest", label: "Pinterest", icon: "logo-pinterest" },
];

interface AppleFilterPillsProps {
  filter: FilterCategory;
  videos: SavedVideo[];
  onSelectFilter: (filter: FilterCategory) => void;
}

/**
 * Telegram iOS Inspired Chat Folder Filter Tabs
 * Features sleek capsule tabs, numeric unread count badges, and Telegram Cyan active states.
 */
export const AppleFilterPills: React.FC<AppleFilterPillsProps> = ({
  filter,
  videos,
  onSelectFilter,
}) => {
  const getCount = (key: FilterCategory): number => {
    if (key === "all") return videos.length;
    if (key === "unread")
      return videos.filter((v) => v.status === "unread").length;
    return videos.filter((v) => v.platform === key).length;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((tab) => {
          const count = getCount(tab.key);
          const isActive = filter === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              style={[
                styles.folderTab,
                isActive ? styles.folderTabActive : styles.folderTabInactive,
              ]}
              onPress={() => {
                haptics.selection();
                onSelectFilter(tab.key);
              }}
            >
              {tab.icon && (
                <PikaIcon
                  name={tab.icon}
                  size={13}
                  color={
                    isActive
                      ? appleColors.telegramCyan
                      : appleColors.twitterMuted
                  }
                  style={styles.tabIcon}
                />
              )}
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBubble,
                    isActive
                      ? styles.countBubbleActive
                      : styles.countBubbleInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isActive
                        ? styles.countTextActive
                        : styles.countTextInactive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: appleColors.twitterBorder,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: 14,
    gap: 7,
  },
  folderTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  folderTabInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  folderTabActive: {
    backgroundColor: "rgba(42, 171, 238, 0.12)",
    borderWidth: 1,
    borderColor: appleColors.telegramCyan,
  },
  tabIcon: {
    marginRight: 5,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  tabLabelInactive: {
    color: appleColors.twitterMuted,
  },
  tabLabelActive: {
    color: appleColors.telegramCyan,
    fontWeight: "700",
  },
  countBubble: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 9,
  },
  countBubbleInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  countBubbleActive: {
    backgroundColor: appleColors.telegramCyan,
  },
  countText: {
    ...appleTypography.tabularNums,
    fontSize: 10,
    fontWeight: "700",
  },
  countTextInactive: {
    color: appleColors.textSecondary,
  },
  countTextActive: {
    color: "#000000",
  },
});
