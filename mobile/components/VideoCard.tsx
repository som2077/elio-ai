import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

interface VideoCardProps {
  video: SavedVideo;
  onPress: () => void;
  onToggleStatus: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
}

/**
 * Clean Visual Video Card (Wide Pinterest Brick)
 * Focused on content, thumbnail, and quick video playback.
 * Completely free of fake tweet/social post clutter.
 */
export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onToggleStatus,
  onLongPress,
}) => {
  const isWatched = video.status === "watched";
  const [imageError, setImageError] = useState(false);
  const cardScale = useRef(new Animated.Value(1)).current;

  const animatePressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.985,
      useNativeDriver: true,
      damping: motionTokens.spring.settle.damping,
      stiffness: motionTokens.spring.settle.stiffness,
    }).start();
  };

  const animatePressOut = () => {
    Animated.spring(cardScale, {
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

  const handleShare = async () => {
    try {
      haptics.light();
      await Share.share({
        message: `${video.title || "Check this video"}: ${video.clean_url}`,
        url: video.clean_url,
      });
    } catch {}
  };

  const platformInfo = getPlatformDetails(video.platform);
  const hasValidThumbnail =
    Boolean(video.thumbnail_url) &&
    !imageError &&
    !video.thumbnail_url?.includes(".mp4") &&
    !video.thumbnail_url?.includes(".m3u8");

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const durationText = formatDuration(video.duration_seconds);

  const creatorInitial = (
    video.creator_name?.trim()?.charAt(0) ||
    platformInfo.name.charAt(0)
  ).toUpperCase();

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cardScale }] }]}>
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
        {/* Full-width Media Thumbnail */}
        <View style={styles.thumbnailBox}>
          {hasValidThumbnail ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={styles.thumbnailImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.placeholderBox}>
              <View
                style={[
                  styles.placeholderIconRing,
                  { borderColor: `${platformInfo.color}40` },
                ]}
              >
                <Ionicons
                  name={platformInfo.icon}
                  size={36}
                  color={platformInfo.color}
                />
              </View>
              <Text style={styles.placeholderText}>Video Clip</Text>
            </View>
          )}

          {/* Top Overlays */}
          <View style={styles.thumbnailTopRow}>
            {/* Platform Badge */}
            <View style={styles.platformBadge}>
              <Ionicons
                name={platformInfo.icon}
                size={12}
                color={platformInfo.color}
              />
              <Text style={styles.platformText}>{platformInfo.name}</Text>
            </View>

            {/* Status Indicator */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.statusBadge,
                isWatched ? styles.statusWatched : styles.statusUnread,
              ]}
              onPress={() => {
                haptics.selection();
                onToggleStatus();
              }}
            >
              <Ionicons
                name={isWatched ? "checkmark-done" : "bookmark"}
                size={12}
                color={isWatched ? "#070A11" : "#FFFFFF"}
              />
              <Text
                style={[
                  styles.statusText,
                  isWatched && styles.statusTextWatched,
                ]}
              >
                {isWatched ? "WATCHED" : "IN QUEUE"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Center Play Button Overlay */}
          <View style={styles.centerPlayFab}>
            <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>

          {/* Bottom Overlay: Duration */}
          {Boolean(durationText) && (
            <View style={styles.durationOverlay}>
              <Text style={styles.durationText}>{durationText}</Text>
            </View>
          )}
        </View>

        {/* Pin Details Below Thumbnail */}
        <View style={styles.contentSection}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {video.title || "Untitled Video Clip"}
          </Text>

          {/* Creator & Actions Row */}
          <View style={styles.creatorActionRow}>
            <View style={styles.creatorLeft}>
              {video.creator_avatar_url ? (
                <Image
                  source={{ uri: video.creator_avatar_url }}
                  style={styles.creatorAvatarImg}
                />
              ) : (
                <View style={styles.creatorAvatarCircle}>
                  <Text style={styles.creatorAvatarText}>{creatorInitial}</Text>
                </View>
              )}
              <Text style={styles.creatorName} numberOfLines={1}>
                {video.creator_name || platformInfo.name}
              </Text>
            </View>

            <View style={styles.actionsRight}>
              {/* Share Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionIconBtn}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={17} color="#A1A1AA" />
              </TouchableOpacity>

              {/* 3-dots More Actions */}
              {Boolean(onLongPress) && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionIconBtn}
                  onPress={() => {
                    haptics.selection();
                    onLongPress!();
                  }}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={17}
                    color="#A1A1AA"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  cardContainer: {
    backgroundColor: "transparent",
  },
  thumbnailBox: {
    width: "100%",
    height: 200,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#161618",
    position: "relative",
    justifyContent: "space-between",
  },
  thumbnailImage: {
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
    backgroundColor: "#141418",
  },
  placeholderIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  placeholderText: {
    color: "#71717A",
    fontSize: 12,
    fontWeight: "600",
  },
  thumbnailTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    zIndex: 2,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 5,
  },
  platformText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 4,
  },
  statusUnread: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  statusWatched: {
    backgroundColor: appleColors.accentLight,
    borderColor: appleColors.accentLight,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  statusTextWatched: {
    color: "#070A11",
  },
  centerPlayFab: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  durationOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 2,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  contentSection: {
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  videoTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  creatorActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  creatorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  creatorAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
  },
  creatorAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  creatorAvatarText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#E4E4E7",
  },
  creatorName: {
    color: "#A1A1AA",
    fontSize: 12.5,
    fontWeight: "500",
    flex: 1,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
});
