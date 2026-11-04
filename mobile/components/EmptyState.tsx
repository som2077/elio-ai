import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface EmptyStateProps {
  onLinkPress: () => void;
  title?: string;
  subtitle?: string;
  platform?: string;
  onResetPlatform?: () => void;
}

const PLATFORM_META: Record<
  string,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
  }
> = {
  youtube: {
    label: "YouTube",
    icon: "logo-youtube",
    color: "#FF0033",
    bgColor: "rgba(255, 0, 51, 0.14)",
  },
  instagram: {
    label: "Instagram",
    icon: "logo-instagram",
    color: "#E1306C",
    bgColor: "rgba(225, 48, 108, 0.14)",
  },
  twitter: {
    label: "Twitter / 𝕏",
    icon: "logo-twitter",
    color: "#1D9BF0",
    bgColor: "rgba(29, 155, 240, 0.14)",
  },
  reddit: {
    label: "Reddit",
    icon: "logo-reddit",
    color: "#FF4500",
    bgColor: "rgba(255, 69, 0, 0.14)",
  },
  tiktok: {
    label: "TikTok",
    icon: "musical-notes",
    color: "#00F2FE",
    bgColor: "rgba(0, 242, 254, 0.14)",
  },
  facebook: {
    label: "Facebook",
    icon: "logo-facebook",
    color: "#1877F2",
    bgColor: "rgba(24, 119, 242, 0.14)",
  },
  linkedin: {
    label: "LinkedIn",
    icon: "logo-linkedin",
    color: "#0A66C2",
    bgColor: "rgba(10, 102, 194, 0.14)",
  },
  pinterest: {
    label: "Pinterest",
    icon: "logo-pinterest",
    color: "#E60023",
    bgColor: "rgba(230, 0, 35, 0.14)",
  },
};

/**
 * Authentic Threads / Twitter Empty State
 * Dynamically adapts with platform-specific branding and actions when filtering.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  onLinkPress,
  title,
  subtitle,
  platform,
  onResetPlatform,
}) => {
  const isPlatformFilter = platform && platform !== "all";
  const platformMeta = isPlatformFilter ? PLATFORM_META[platform] : null;

  return (
    <View style={styles.container}>
      {platformMeta && (
        <View
          style={[styles.platformIconCircle, { backgroundColor: platformMeta.bgColor }]}
        >
          <Ionicons
            name={platformMeta.icon}
            size={30}
            color={platformMeta.color}
          />
        </View>
      )}

      {platformMeta && (
        <Text style={styles.platformTitle}>
          {title || `No ${platformMeta.label} clips yet`}
        </Text>
      )}

      <Text style={styles.messageText}>
        {subtitle ||
          (platformMeta
            ? `Clips you save from ${platformMeta.label} will appear here.`
            : "Posts that you save will appear here.")}
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.linkBtn}
          onPress={() => {
            haptics.light();
            onLinkPress();
          }}
        >
          <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
          <Text style={styles.linkBtnText}>Link Desktop Extension</Text>
        </TouchableOpacity>

        {isPlatformFilter && onResetPlatform && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.resetBtn}
            onPress={() => {
              haptics.selection();
              onResetPlatform();
            }}
          >
            <Text style={styles.resetBtnText}>View Queue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 90,
    paddingHorizontal: 32,
  },
  platformIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  platformTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  messageText: {
    fontSize: 14.5,
    fontWeight: "400",
    color: threadsTokens.colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
    maxWidth: 290,
  },
  actionsRow: {
    alignItems: "center",
    gap: 12,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#282828",
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1D9BF0",
  },
});
