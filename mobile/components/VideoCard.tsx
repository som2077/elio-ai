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
import { appleColors, appleRadii } from "../theme/appleTokens";
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
 * Authentic Threads / X Inspired Single-Column Feed Post Card
 * Left column: Creator / Platform Avatar
 * Right column: Header (Name, Verified, Handle, Time, Menu), Title, 16:9 Media
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
      toValue: 0.99,
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
        return "musical-notes-outline";
      case "linkedin":
        return "logo-linkedin";
      case "facebook":
        return "logo-facebook";
      case "pinterest":
        return "logo-pinterest";
      default:
        return "film-outline";
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "now";
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d`;
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const creatorDisplay = video.creator_name || `${platformConfig.label} Creator`;
  const cleanHandle = (video.creator_name || platform)
    .replace(/\s+/g, "")
    .toLowerCase();

  const hasValidThumbnail =
    Boolean(video.thumbnail_url) &&
    !imageError &&
    !video.thumbnail_url?.includes(".mp4") &&
    !video.thumbnail_url?.includes(".m3u8");

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <View style={styles.tweetContainer}>
        {/* Left Column: Creator / Platform Avatar */}
        <View style={styles.avatarColumn}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.avatarCircle,
              { backgroundColor: platformConfig.bg, borderColor: platformConfig.border },
            ]}
            onPress={onPress}
          >
            <Ionicons
              name={getPlatformIcon(platform)}
              size={18}
              color={platformConfig.color}
            />
          </TouchableOpacity>
        </View>

        {/* Right Column: Post Body */}
        <View style={styles.contentColumn}>
          {/* Header Row: Name, Verified, Handle, Time, More Options */}
          <View style={styles.headerRow}>
            <View style={styles.authorMeta}>
              <Text style={styles.displayName} numberOfLines={1}>
                {creatorDisplay}
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={appleColors.twitterBlue}
                style={styles.verifiedIcon}
              />
              <Text style={styles.handleText} numberOfLines={1}>
                @{cleanHandle}
              </Text>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.timeText}>{getRelativeTime(video.created_at)}</Text>
            </View>

            {/* Overflow Menu Button */}
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.moreBtn}
              onPress={() => {
                haptics.light();
                if (onLongPress) onLongPress();
              }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color={appleColors.twitterMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Post Text: Video Title / Caption */}
          <TouchableOpacity
            activeOpacity={0.85}
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
              style={[styles.postTitle, isWatched && styles.postTitleWatched]}
              numberOfLines={3}
            >
              {video.title || "Untitled Video Clip"}
            </Text>
          </TouchableOpacity>

          {/* Embedded 16:9 Media Thumbnail */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.mediaContainer}
            onPress={onPress}
            onLongPress={() => {
              if (onLongPress) {
                haptics.selection();
                onLongPress();
              }
            }}
            delayLongPress={260}
          >
            {hasValidThumbnail ? (
              <Image
                source={{ uri: video.thumbnail_url }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View
                style={[
                  styles.mediaThumbnail,
                  {
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#11141C",
                  },
                ]}
              >
                <Ionicons
                  name={getPlatformIcon(platform)}
                  size={42}
                  color={platformConfig.color}
                />
              </View>
            )}

            {/* Subtle Gradient Scrim */}
            <View style={styles.mediaScrim} />

            {/* Platform Tag in media */}
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{platformConfig.label}</Text>
            </View>

            {/* Telegram double-checkmark status pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.telegramStatusBadge,
                isWatched && styles.telegramStatusBadgeWatched,
              ]}
              onPress={handleToggle}
            >
              <Ionicons
                name={isWatched ? "checkmark-done" : "checkmark"}
                size={12}
                color={isWatched ? "#FFFFFF" : appleColors.textSecondary}
              />
              <Text
                style={[
                  styles.telegramStatusText,
                  isWatched && styles.telegramStatusTextWatched,
                ]}
              >
                {isWatched ? "Watched" : "In Queue"}
              </Text>
            </TouchableOpacity>

            {/* Centered Play Button Overlay */}
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tweetContainer: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    backgroundColor: "#000000",
  },
  avatarColumn: {
    marginRight: 10,
    alignItems: "center",
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  contentColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  authorMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 6,
  },
  displayName: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
    maxWidth: "45%",
  },
  verifiedIcon: {
    marginLeft: 3,
  },
  handleText: {
    color: appleColors.twitterMuted,
    fontSize: 13,
    marginLeft: 4,
    maxWidth: "28%",
  },
  dotSeparator: {
    color: appleColors.twitterMuted,
    fontSize: 13,
    marginHorizontal: 4,
  },
  timeText: {
    color: appleColors.twitterMuted,
    fontSize: 12.5,
  },
  moreBtn: {
    padding: 4,
    marginRight: -4,
  },
  postTitle: {
    color: "#E7E9EA",
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  postTitleWatched: {
    color: appleColors.twitterMuted,
  },
  mediaContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0F141C",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  mediaThumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  categoryPill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryPillText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  telegramStatusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: appleRadii.pill,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  telegramStatusBadgeWatched: {
    backgroundColor: appleColors.telegramCyan,
    borderColor: appleColors.telegramCyan,
  },
  telegramStatusText: {
    color: appleColors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  telegramStatusTextWatched: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  playOverlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
