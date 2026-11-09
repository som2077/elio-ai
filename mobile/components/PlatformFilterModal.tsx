import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { PlatformIcon } from "./PlatformIcon";
import { AppleSwitch } from "./AppleSwitch";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { IndustryBottomSheet } from "./IndustryBottomSheet";

export interface PlatformConfig {
  key: string;
  label: string;
  icon: string;
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
      showHandle={true}
    >
      {/* Scrollable Platforms List */}
      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={styles.scrollListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Individual Platforms */}
        {ALL_AVAILABLE_PLATFORMS.map((platform) => {
          const isPinned = pinnedPlatforms.includes(platform.key);
          const count = platformCounts ? platformCounts[platform.key] || 0 : 0;

          return (
            <View key={platform.key} style={styles.platformRow}>
              {/* Tappable Left Area (Switches feed to this platform) */}
              <TouchableOpacity
                activeOpacity={0.7}
                delayPressIn={0}
                style={styles.platformInfo}
                onPress={() => handleSelect(platform.key)}
              >
                <View style={styles.iconBox}>
                  <PlatformIcon platform={platform.key} size={24} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.platformLabel}>{platform.label}</Text>
                  <Text style={styles.pinnedStatus}>
                    {count > 0
                      ? `${count} saved clip${count === 1 ? "" : "s"}`
                      : "No clips yet"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Right Apple Switch (Toggles pinned state on top bar) */}
              <AppleSwitch
                value={isPinned}
                activeColor="#FFFFFF"
                activeThumbColor="#000000"
                inactiveColor="rgba(255, 255, 255, 0.16)"
                inactiveThumbColor="#FFFFFF"
                onValueChange={() => {
                  onTogglePlatform(platform.key);
                }}
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom "Done" Action Button */}
      <View style={styles.bottomActionZone}>
        <TouchableOpacity
          activeOpacity={0.88}
          delayPressIn={0}
          style={styles.doneButton}
          onPress={() => {
            haptics.medium();
            onClose();
          }}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </IndustryBottomSheet>
  );
};

const styles = StyleSheet.create({
  scrollList: {
    maxHeight: Math.min(SCREEN_HEIGHT * 0.52, 450),
    marginTop: 6,
  },
  scrollListContent: {
    paddingBottom: 16,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    marginVertical: 1.5,
  },
  platformInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  platformLabel: {
    color: "#F3F5F7",
    fontSize: 15.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  pinnedStatus: {
    color: "#777777",
    fontSize: 12,
    marginTop: 2,
  },
  bottomActionZone: {
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  doneButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  doneButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
