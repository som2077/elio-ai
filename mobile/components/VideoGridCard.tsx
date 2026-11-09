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
import { PikaIcon } from "./PikaIcon";
import { PlatformIcon } from "./PlatformIcon";
import { SavedVideo } from "../types/video";
import { appleColors } from "../theme/appleTokens";
import { motionTokens } from "../utils/motion";
import { haptics } from "../utils/haptics";

interface VideoGridCardProps {
  video: SavedVideo;
  index?: number;
  onPress: () => void;
  onToggleStatus: () => void;
  onLongPress?: () => void;
}

/**
 * Pinterest-style Masonry Brick Card
 * - Variable height media thumbnail with smooth rounded corners
 * - Platform pill & quick status indicator overlaid on media
 * - Clean title & creator info directly below thumbnail (outside image)
 * - 3-dots more menu for actions
 */
export const VideoGridCard: React.FC<VideoGridCardProps> = ({
  video,
  index = 0,
  onPress,
  onToggleStatus,
  onLongPress,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const [imageError, setImageError] = useState(false);

  const animatePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
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

  // Determine dynamic masonry brick image height
  const getBrickImageHeight = () => {
    const p = (video.platform || "").toLowerCase();
    const cat = (video.category || "").toLowerCase();
    const title = (video.title || "").toLowerCase();

    // Reels, Shorts, TikTok are tall portrait bricks
    if (
      cat === "reel" ||
      cat === "short" ||
      p === "tiktok" ||
      p === "instagram" ||
      title.includes("short") ||
      title.includes("reel")
    ) {
      return 240;
    }

    // Standard YouTube landscape brick
    if (p === "youtube" && !title.includes("short")) {
      return 165;
    }

    // Pseudo-random staggered height based on video ID for natural brick wall look
    const charCode = (video.id || "a").charCodeAt(0) + index;
    const heights = [170, 215, 185, 235, 195];
    return heights[charCode % heights.length];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const platformInfo = getPlatformDetails(video.platform);
  const isUnread = video.status === "unread";
  const durationText = formatDuration(video.duration_seconds);
  const imageHeight = getBrickImageHeight();
  const hasValidThumbnail =
    Boolean(video.thumbnail_url) &&
    !imageError &&
    !video.thumbnail_url?.includes(".mp4") &&
    !video.thumbnail_url?.includes(".m3u8");

  const creatorInitial = (
    video.creator_name?.trim()?.charAt(0) || platformInfo.name.charAt(0)
  ).toUpperCase();

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
        {/* 1. Pinterest Thumbnail Brick */}
        <View style={[styles.imageBox, { height: imageHeight }]}>
          {hasValidThumbnail ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={styles.posterImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.placeholderBox}>
              <View style={styles.placeholderIconBox}>
                <PlatformIcon platform={video.platform} size={40} />
              </View>
              <Text style={styles.placeholderText}>Video Clip</Text>
            </View>
          )}

          {/* Top Row Overlays: Platform Pill & Status Pill */}
          <View style={styles.thumbnailTopRow}>
            {/* Platform Badge */}
            <View style={styles.platformBadge}>
              <PlatformIcon
                platform={video.platform}
                size={12}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.platformText}>{platformInfo.name}</Text>
            </View>

            {/* AI Digest Sparkle Pill */}
            {video.ai_metadata?.tldw && (
              <View style={styles.aiSparkleBadge}>
                <PikaIcon name="sparkles" size={10} color="#C4B5FD" />
              </View>
            )}

            {/* Status Quick Toggle */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.statusPill,
                !isUnread ? styles.statusPillWatched : styles.statusPillUnread,
              ]}
              onPress={() => {
                haptics.selection();
                onToggleStatus();
              }}
            >
              <PikaIcon
                name={!isUnread ? "checkmark-done" : "bookmark"}
                size={11}
                color={!isUnread ? "#070A11" : "#FFFFFF"}
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Right: Duration or Play Icon */}
          <View style={styles.bottomOverlayRow}>
            {durationText ? (
              <View style={styles.durationBadge}>
                <PikaIcon
                  name="play"
                  size={8}
                  color="#FFFFFF"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.durationText}>{durationText}</Text>
              </View>
            ) : (
              <View style={styles.playFab}>
                <PikaIcon
                  name="play"
                  size={11}
                  color="#FFFFFF"
                  style={{ marginLeft: 1 }}
                />
              </View>
            )}
          </View>
        </View>

        {/* 2. Pin Info Below Thumbnail (Pinterest Style) */}
        <View style={styles.pinDetails}>
          {/* Video Title */}
          <Text style={styles.pinTitle} numberOfLines={2}>
            {video.title || "Untitled Video"}
          </Text>

          {/* Creator & Options Menu */}
          <View style={styles.pinMetaRow}>
            <View style={styles.creatorMeta}>
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
              <Text style={styles.creatorNameText} numberOfLines={1}>
                {video.creator_name || platformInfo.name}
              </Text>
            </View>

            {/* 3-dots More Actions */}
            {Boolean(onLongPress) && (
              <TouchableOpacity
                activeOpacity={0.65}
                style={styles.moreBtn}
                onPress={() => {
                  haptics.selection();
                  onLongPress!();
                }}
              >
                <PikaIcon
                  name="ellipsis-horizontal"
                  size={14}
                  color="#8E8E93"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: "100%",
    marginBottom: 12,
  },
  cardContainer: {
    backgroundColor: "transparent",
    borderRadius: 16,
  },
  imageBox: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#161618",
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
    backgroundColor: "#16161A",
  },
  placeholderIconBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  placeholderText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  thumbnailTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    zIndex: 2,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 9,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    gap: 4,
  },
  platformText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  aiSparkleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(167, 139, 250, 0.25)",
    borderWidth: 0.5,
    borderColor: "rgba(167, 139, 250, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  statusPillUnread: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  statusPillWatched: {
    backgroundColor: appleColors.accentLight,
    borderColor: appleColors.accentLight,
  },
  bottomOverlayRow: {
    alignItems: "flex-end",
    padding: 8,
    zIndex: 2,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "700",
  },
  playFab: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinDetails: {
    paddingTop: 8,
    paddingHorizontal: 3,
    paddingBottom: 2,
  },
  pinTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17.5,
    letterSpacing: -0.15,
  },
  pinMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  creatorMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 6,
  },
  creatorAvatarImg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },
  creatorAvatarCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  creatorAvatarText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#E4E4E7",
  },
  creatorNameText: {
    color: "#A1A1AA",
    fontSize: 11.5,
    fontWeight: "500",
    flex: 1,
  },
  moreBtn: {
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
