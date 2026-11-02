import React, { useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { appleColors, appleRadii } from "../theme/appleTokens";
import { motionTokens } from "../utils/motion";
import { haptics } from "../utils/haptics";

interface HeroSpotlightCardProps {
  video: SavedVideo | null;
  onPress: () => void;
  onDismiss?: () => void;
}

export const HeroSpotlightCard: React.FC<HeroSpotlightCardProps> = ({
  video,
  onPress,
  onDismiss,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  if (!video) return null;

  const animatePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      damping: motionTokens.spring.settle.damping,
      stiffness: motionTokens.spring.settle.stiffness,
    }).start();
  };

  const animatePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: motionTokens.spring.bouncy.damping,
      stiffness: motionTokens.spring.bouncy.stiffness,
    }).start();
  };

  const getPlatformIcon = (platform: string) => {
    switch ((platform || "").toLowerCase()) {
      case "youtube":
        return { icon: "logo-youtube" as const, color: "#FF0033" };
      case "instagram":
        return { icon: "logo-instagram" as const, color: "#E1306C" };
      case "twitter":
        return { icon: "logo-twitter" as const, color: "#1DA1F2" };
      case "tiktok":
        return { icon: "videocam-outline" as const, color: "#00F2FE" };
      case "reddit":
        return { icon: "logo-reddit" as const, color: "#FF4500" };
      default:
        return { icon: "play-circle" as const, color: appleColors.accentLight };
    }
  };

  const platform = getPlatformIcon(video.platform);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.card}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        onPress={() => {
          haptics.light();
          onPress();
        }}
      >
        {/* Spotlight Media Header */}
        <View style={styles.mediaContainer}>
          {video.thumbnail_url ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.fallbackMedia}>
              <Ionicons name={platform.icon} size={44} color={appleColors.textTertiary} />
            </View>
          )}

          {/* Dark Scrim */}
          <View style={styles.scrim} />

          {/* Eyebrow Label */}
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBadge}>
              <Text style={styles.sparkleIcon}>✦</Text>
              <Text style={styles.eyebrowText}>UP NEXT IN WATCHLIST</Text>
            </View>

            {onDismiss && (
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  onDismiss();
                }}
                style={styles.dismissBtn}
              >
                <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Center Play Button Floating Ring */}
          <View style={styles.playCenterRing}>
            <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>

        {/* Content Footer */}
        <View style={styles.contentFooter}>
          <View style={styles.metaRow}>
            <View style={styles.platformCapsule}>
              <Ionicons name={platform.icon} size={12} color={platform.color} />
              <Text style={styles.platformName}>
                {video.platform ? video.platform.toUpperCase() : "VIDEO"}
              </Text>
            </View>

            {Boolean(video.creator_name) && (
              <Text style={styles.creatorName} numberOfLines={1}>
                by {video.creator_name}
              </Text>
            )}
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {video.title || "Liked Video Clip"}
          </Text>

          {/* 1-Tap Watch Action Bar */}
          <View style={styles.actionRow}>
            <View style={styles.watchNowBtn}>
              <Ionicons name="play-circle" size={15} color="#070A11" />
              <Text style={styles.watchNowText}>Watch Now</Text>
            </View>
            <Text style={styles.tapPrompt}>Opens native app</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#0F1424",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#00E5FF",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  mediaContainer: {
    height: 160,
    width: "100%",
    position: "relative",
    justifyContent: "space-between",
  },
  mediaImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  fallbackMedia: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161E33",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7, 10, 19, 0.45)",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    zIndex: 2,
  },
  eyebrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(7, 10, 19, 0.85)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: "rgba(0, 229, 255, 0.4)",
    gap: 5,
  },
  sparkleIcon: {
    color: appleColors.accentLight,
    fontSize: 10,
    fontWeight: "900",
  },
  eyebrowText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  playCenterRing: {
    position: "absolute",
    alignSelf: "center",
    top: "35%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  contentFooter: {
    padding: 14,
    backgroundColor: "#0F1424",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  platformCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  platformName: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  creatorName: {
    color: appleColors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  watchNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appleColors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  watchNowText: {
    color: "#070A11",
    fontSize: 11,
    fontWeight: "800",
  },
  tapPrompt: {
    color: appleColors.textTertiary,
    fontSize: 10,
    fontWeight: "500",
  },
});
