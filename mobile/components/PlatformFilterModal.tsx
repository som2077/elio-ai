import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlatformIcon } from "./PlatformIcon";
import { haptics } from "../utils/haptics";
import { IndustryBottomSheet } from "./IndustryBottomSheet";

export interface PlatformConfig {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

export const ALL_AVAILABLE_PLATFORMS: PlatformConfig[] = [
  {
    key: "youtube",
    label: "YouTube",
    icon: "logo-youtube",
    color: "#FF0033",
    bgColor: "rgba(255, 0, 51, 0.15)",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    color: "#E1306C",
    bgColor: "rgba(225, 48, 108, 0.15)",
  },
  {
    key: "twitter",
    label: "Twitter / 𝕏",
    icon: "logo-twitter",
    color: "#1D9BF0",
    bgColor: "rgba(29, 155, 240, 0.15)",
  },
  {
    key: "reddit",
    label: "Reddit",
    icon: "logo-reddit",
    color: "#FF4500",
    bgColor: "rgba(255, 69, 0, 0.15)",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: "musical-notes",
    color: "#00F2FE",
    bgColor: "rgba(0, 242, 254, 0.15)",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "logo-facebook",
    color: "#1877F2",
    bgColor: "rgba(24, 119, 242, 0.15)",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "logo-linkedin",
    color: "#0A66C2",
    bgColor: "rgba(10, 102, 194, 0.15)",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    icon: "logo-pinterest",
    color: "#E60023",
    bgColor: "rgba(230, 0, 35, 0.15)",
  },
];

interface PlatformFilterModalProps {
  visible: boolean;
  selectedPlatform?: string;
  pinnedPlatforms: string[];
  platformCounts?: Record<string, number>;
  onSelectPlatform?: (platformKey: string) => void;
  onTogglePlatform: (platformKey: string) => void;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const PlatformFilterModal: React.FC<PlatformFilterModalProps> = ({
  visible,
  selectedPlatform = "all",
  pinnedPlatforms,
  platformCounts,
  onSelectPlatform,
  onTogglePlatform,
  onClose,
}) => {
  const handleSelect = (key: string) => {
    haptics.medium();
    if (onSelectPlatform) {
      onSelectPlatform(key);
    }
    onClose();
  };

  return (
    <IndustryBottomSheet
      visible={visible}
      onClose={onClose}
      title="Platforms"
      subtitle="Tap platform to view clips, or toggle to pin to top bar"
      maxHeightRatio={0.88}
    >
      {/* Scrollable Platforms List */}
      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={styles.scrollListContent}
        showsVerticalScrollIndicator={false}
      >
        {/* "Queue (All)" Row */}
        <View
          style={[
            styles.platformRow,
            selectedPlatform === "all" && styles.platformRowActive,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.platformInfo}
            onPress={() => handleSelect("all")}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: "rgba(29, 155, 240, 0.15)" },
              ]}
            >
              <Ionicons name="layers-outline" size={20} color="#1D9BF0" />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.platformLabel}>Queue (All)</Text>
                {selectedPlatform === "all" && (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.pinnedStatus}>
                {platformCounts?.all ?? 0} saved clips
              </Text>
            </View>
          </TouchableOpacity>

          <Switch
            value={true}
            disabled={true}
            trackColor={{ false: "#2F3336", true: "rgba(29, 155, 240, 0.55)" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Individual Platforms */}
        {ALL_AVAILABLE_PLATFORMS.map((platform) => {
          const isPinned = pinnedPlatforms.includes(platform.key);
          const isSelected = selectedPlatform === platform.key;
          const count = platformCounts ? platformCounts[platform.key] || 0 : 0;

          return (
            <View
              key={platform.key}
              style={[
                styles.platformRow,
                isSelected && styles.platformRowActive,
              ]}
            >
              {/* Tappable Left Area (Switches feed to this platform) */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.platformInfo}
                onPress={() => handleSelect(platform.key)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: platform.bgColor },
                  ]}
                >
                  <PlatformIcon
                    platform={platform.key}
                    size={20}
                    color={platform.color}
                  />
                </View>
                <View style={styles.textContainer}>
                  <View style={styles.labelRow}>
                    <Text style={styles.platformLabel}>{platform.label}</Text>
                    {isSelected && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pinnedStatus}>
                    {count > 0
                      ? `${count} saved clip${count === 1 ? "" : "s"}`
                      : "No clips yet"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Right Switch (Toggles pinned state on top bar) */}
              <Switch
                value={isPinned}
                onValueChange={() => {
                  haptics.selection();
                  onTogglePlatform(platform.key);
                }}
                trackColor={{ false: "#2F3336", true: "#1D9BF0" }}
                thumbColor="#FFFFFF"
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom "Done" Action Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.doneButton}
        onPress={() => {
          haptics.medium();
          onClose();
        }}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </IndustryBottomSheet>
  );
};

const styles = StyleSheet.create({
  scrollList: {
    maxHeight: Math.min(SCREEN_HEIGHT * 0.54, 490),
    marginTop: 6,
  },
  scrollListContent: {
    paddingBottom: 10,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
  },
  platformRowActive: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  platformInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  platformLabel: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  activeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(29, 155, 240, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(29, 155, 240, 0.35)",
  },
  activeTagText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#1D9BF0",
  },
  pinnedStatus: {
    color: "#71767B",
    fontSize: 12,
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: "#FFFFFF",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  doneButtonText: {
    color: "#000000",
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
