import React, { useRef, useState } from "react";
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

interface VideoGridCardProps {
  video: SavedVideo;
  onPress: () => void;
  onToggleStatus: () => void;
  onLongPress?: () => void;
}

export const VideoGridCard: React.FC<VideoGridCardProps> = ({
  video,
  onPress,
  onToggleStatus,
  onLongPress,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animatePressIn = () => {
    Animated.spring(scale, {
      toValue: motionTokens.scale.pressed,
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

  const getPlatformDetails = (platformName: string) => {
    const p = (platformName || "").toLowerCase();
    switch (p) {
      case "youtube":
        return {
          icon: "logo-youtube" as const,
          color: "#FF0033",
          name: "YouTube",
        };
      case "instagram":
        return {
          icon: "logo-instagram" as const,
          color: "#E1306C",
          name: "Instagram",
        };
      case "twitter":
        return {
          icon: "logo-twitter" as const,
          color: "#1DA1F2",
          name: "𝕏",
        };
      case "tiktok":
        return {
          icon: "videocam-outline" as const,
          color: "#00F2FE",
          name: "TikTok",
        };
      case "reddit":
        return {
          icon: "logo-reddit" as const,
          color: "#FF4500",
          name: "Reddit",
        };
      default:
        return {
          icon: "play-circle-outline" as const,
          color: appleColors.accentLight,
          name: "Video",
        };
    }
  };

  const platformInfo = getPlatformDetails(video.platform);
  const isUnread = video.status === "unread";
  const [imageError, setImageError] = useState(false);
  const hasValidThumbnail =
    Boolean(video.thumbnail_url) &&
    !imageError &&
    !video.thumbnail_url?.includes(".mp4") &&
    !video.thumbnail_url?.includes(".m3u8");

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.cardContainer}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        onPress={() => {
          haptics.light();
          onPress();
        }}
        onLongPress={() => {
          if (onLongPress) {
            haptics.selection();
            onLongPress();
          }
        }}
        delayLongPress={260}
      >
        {/* Poster Media Image */}
        <View style={styles.imageBox}>
          {hasValidThumbnail ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={styles.posterImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons
                name={platformInfo.icon}
                size={36}
                color={platformInfo.color || appleColors.textTertiary}
              />
            </View>
          )}

          {/* Scrim Gradient Backdrop for Text Readability */}
          <View style={styles.scrimOverlay} />

          {/* Top Row: Platform Badge + Status Indicator */}
          <View style={styles.topRow}>
            <View style={styles.platformBadge}>
              <Ionicons
                name={platformInfo.icon}
                size={11}
                color={platformInfo.color}
              />
              <Text style={styles.platformText}>{platformInfo.name}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.statusPill,
                isUnread ? styles.statusPillUnread : styles.statusPillWatched,
              ]}
              onPress={() => {
                haptics.selection();
                onToggleStatus();
              }}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isUnread ? appleColors.accentLight : "#8E8E93" },
                ]}
              />
              <Text style={styles.statusPillText}>
                {isUnread ? "NEW" : "DONE"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Center Play Icon Overlay */}
          <View style={styles.playFab}>
            <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>

          {/* Bottom Content Scrim */}
          <View style={styles.bottomInfo}>
            <Text style={styles.title} numberOfLines={2}>
              {video.title || "Untitled Video Clip"}
            </Text>

            {Boolean(video.creator_name) && (
              <View style={styles.creatorRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={12}
                  color={appleColors.textSecondary}
                />
                <Text style={styles.creatorText} numberOfLines={1}>
                  {video.creator_name}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    margin: 6,
  },
  cardContainer: {
    backgroundColor: "#0D111D",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  imageBox: {
    width: "100%",
    height: 220,
    position: "relative",
    justifyContent: "space-between",
  },
  posterImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  placeholderBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121828",
  },
  scrimOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7, 10, 19, 0.35)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    zIndex: 2,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 13, 22, 0.88)",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 4,
  },
  platformText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 4,
  },
  statusPillUnread: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    borderColor: "rgba(0, 229, 255, 0.35)",
  },
  statusPillWatched: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  statusDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  playFab: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  bottomInfo: {
    padding: 10,
    paddingTop: 16,
    backgroundColor: "rgba(7, 10, 19, 0.88)",
    borderTopWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.05)",
    zIndex: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 4,
  },
  creatorText: {
    color: appleColors.textSecondary,
    fontSize: 10,
    fontWeight: "500",
    flex: 1,
  },
});
