import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Switch,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../utils/haptics";

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
  pinnedPlatforms: string[];
  onTogglePlatform: (platformKey: string) => void;
  onClose: () => void;
}

export const PlatformFilterModal: React.FC<PlatformFilterModalProps> = ({
  visible,
  pinnedPlatforms,
  onTogglePlatform,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(500)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(500);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 500,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Full-screen Dark Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sliding Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Top Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Title Header */}
          <View style={styles.headerArea}>
            <Text style={styles.titleText}>Platforms</Text>
            <Text style={styles.subtitleText}>
              Choose platforms to pin on your top bar
            </Text>
          </View>

          {/* Platforms List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
            showsVerticalScrollIndicator={false}
          >
            {ALL_AVAILABLE_PLATFORMS.map((platform) => {
              const isPinned = pinnedPlatforms.includes(platform.key);
              return (
                <View key={platform.key} style={styles.platformRow}>
                  {/* Platform Icon & Label */}
                  <View style={styles.platformInfo}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: platform.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={platform.icon}
                        size={20}
                        color={platform.color}
                      />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.platformLabel}>{platform.label}</Text>
                      <Text style={styles.pinnedStatus}>
                        {isPinned ? "Pinned to top bar" : "Hidden from top bar"}
                      </Text>
                    </View>
                  </View>

                  {/* Right Switch (matching Twitter snooze/topics switches) */}
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
              handleClose();
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  sheetContainer: {
    backgroundColor: "#16181C",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "82%",
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3E4144",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 16,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitleText: {
    color: "#71767B",
    fontSize: 13,
    marginTop: 4,
  },
  scrollList: {
    maxHeight: 380,
  },
  scrollListContent: {
    paddingBottom: 8,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  platformInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  platformLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  doneButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
});
