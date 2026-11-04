import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
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
 * Modern, Clean Video Card
 * Streamlined layout:
 * - Full-width 16:9 media preview with subtle platform badge & duration
 * - Minimalist frosted glass play button
 * - Clear, legible title directly below
 * - Simple footer meta: Creator, time ago, watch status toggle, and more actions
 */
export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onToggleStatus,
  onLongPress,
}) => {
  const isWatched = video.status === "watched";
  const platform = (video.platform || "youtube").toLowerCase();
  const platformConfig =
    appleColors.platforms[platform as keyof typeof appleColors.platforms] ||
    appleColors.platforms.youtube;

  const [imageError, setImageError] = useState(false);
  const cardScale = useRef(new Animated.Value(1)).current;

  const handleCardPressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.985,
      useNativeDriver: true,
      damping: motionTokens.spring.settle.damping,
      stiffness: motionTokens.spring.settle.stiffness,
    }).start();
  };

  const handleCardPressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: motionTokens.spring.bouncy.damping,
      stiffness: motionTokens.spring.bouncy.stiffness,
    }).start();
  };

  const handleToggle = () => {
    if (!isWatched) {
      haptics.success();
    } else {
      haptics.light();
    }
    onToggleStatus();
  };

  const getPlatformIcon = (p: string): keyof typeof Ionicons.glyphMap => {
    switch (p) {
      case "youtube":
        return "logo-youtube";
      case "instagram":
        return "logo-instagram";
      case "twitter":
        return "logo-twitter";
      case "reddit":
        return "logo-reddit";
      case "tiktok":
        return "musical-notes";
      case "linkedin":
        return "logo-linkedin";
      case "facebook":
        return "logo-facebook";
      case "pinterest":
        return "logo-pinterest";
      default:
        return "play-circle-outline";
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const durationStr = formatDuration(video.duration_seconds);

  const hasValidThumbnail =
    Boolean(video.thumbnail_url) &&
    !imageError &&
    !video.thumbnail_url?.includes(".mp4") &&
    !video.thumbnail_url?.includes(".m3u8");

  const creatorDisplay = video.creator_name || platformConfig.label;

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <View style={styles.cardContainer}>
        {/* 1. Full-Width 16:9 Thumbnail Preview */}
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.thumbnailContainer}
          onPress={onPress}
          onLongPress={() => {
            if (onLongPress) {
              haptics.selection();
              onLongPress();
            }
          }}
          delayLongPress={260}
          onPressIn={handleCardPressIn}
          onPressOut={handleCardPressOut}
        >
          {hasValidThumbnail ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={styles.thumbnailImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.fallbackThumbnail}>
              <Ionicons
                name={getPlatformIcon(platform)}
                size={44}
                color={platformConfig.color}
              />
            </View>
          )}

          {/* Subtle Dark Gradient Overlay for readability */}
          <View style={styles.thumbnailScrim} />

          {/* Platform Badge (Top-Left) */}
          <View style={styles.platformBadge}>
            <Ionicons
              name={getPlatformIcon(platform)}
              size={12}
              color={platformConfig.color}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.platformBadgeText}>{platformConfig.label}</Text>
          </View>

          {/* Duration Badge (Bottom-Right, if exists) */}
          {durationStr && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationStr}</Text>
            </View>
          )}

          {/* Sleek Frosted Center Play Button */}
          <View style={styles.playButtonCircle}>
            <Ionicons
              name="play"
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: 2 }}
            />
          </View>
        </TouchableOpacity>

        {/* 2. Video Title */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.titleArea}
          onPress={onPress}
          onLongPress={() => {
            if (onLongPress) {
              haptics.selection();
              onLongPress();
            }
          }}
          delayLongPress={260}
          onPressIn={handleCardPressIn}
          onPressOut={handleCardPressOut}
        >
          <Text
            style={[styles.titleText, isWatched && styles.titleTextWatched]}
            numberOfLines={2}
          >
            {video.title || `${platformConfig.label} Clip`}
          </Text>
        </TouchableOpacity>

        {/* 3. Footer Row: Creator · Time Ago  —  Watched Status & More */}
        <View style={styles.footerRow}>
          {/* Left: Creator info & Relative Time */}
          <View style={styles.metaLeft}>
            {video.is_favorite && (
              <Ionicons
                name="heart"
                size={13}
                color="#F91880"
                style={{ marginRight: 5 }}
              />
            )}
            <Text style={styles.creatorText} numberOfLines={1}>
              {creatorDisplay}
            </Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.timeText}>{getRelativeTime(video.created_at)}</Text>
          </View>

          {/* Right: Watch Status Toggle Pill & Overflow Menu */}
          <View style={styles.actionsRight}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.statusPill,
                isWatched ? styles.statusPillWatched : styles.statusPillUnread,
              ]}
              onPress={handleToggle}
            >
              <Ionicons
                name={isWatched ? "checkmark-circle" : "ellipse-outline"}
                size={12}
                color={isWatched ? "#1D9BF0" : "#71767B"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.statusPillText,
                  isWatched && styles.statusPillTextWatched,
                ]}
              >
                {isWatched ? "Watched" : "In Queue"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.moreButton}
              onPress={() => {
                haptics.light();
                if (onLongPress) onLongPress();
              }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color="#71767B"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#000000",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#11141A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackThumbnail: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12141A",
  },
  thumbnailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  platformBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  platformBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  playButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleArea: {
    marginTop: 10,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  titleTextWatched: {
    color: "#8E8E93",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  creatorText: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "500",
    maxWidth: "55%",
  },
  dotSeparator: {
    color: "#48484A",
    fontSize: 13,
    marginHorizontal: 5,
  },
  timeText: {
    color: "#636366",
    fontSize: 12.5,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillUnread: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusPillWatched: {
    backgroundColor: "rgba(29, 155, 240, 0.14)",
    borderColor: "rgba(29, 155, 240, 0.28)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#71767B",
  },
  statusPillTextWatched: {
    color: "#1D9BF0",
    fontWeight: "600",
  },
  moreButton: {
    padding: 4,
    marginRight: -4,
  },
});
