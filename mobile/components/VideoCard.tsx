import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import { appleColors, threadsTokens } from "../theme/appleTokens";
import { PlatformIcon } from "./PlatformIcon";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";
import { fetchVideoAIMetadata } from "../services/aiService";
import type { VideoAIMetadata } from "../types/ai";

interface VideoCardProps {
  video: SavedVideo;
  onPress: () => void;
  onToggleStatus?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
}

/**
 * Authentic Twitter / X Inspired Post Card
 * - Top: Author Avatar, Display Name, Verified Badge, Handle, Time, Overflow Menu
 * - Middle: Post Title / Caption (#E7E9EA)
 * - Below ("nechay jha per video hota ha"): 16:9 Video Preview with #000000 background, #2F3336 border, borderRadius 16
 * - Footer: Watch Status Toggle, Favorite Heart, and Share actions
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
  const [aiMeta, setAiMeta] = useState<VideoAIMetadata | null>(video.ai_metadata || null);
  const [showAiDigest, setShowAiDigest] = useState(false);
  const cardScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;
    if (video.ai_metadata) {
      setAiMeta(video.ai_metadata);
    } else {
      fetchVideoAIMetadata(video.id).then((meta) => {
        if (isMounted && meta) {
          setAiMeta(meta);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [video.id, video.ai_metadata]);

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

  const getPlatformIcon = (p: string): string => {
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

  const creatorDisplay =
    video.creator_name || `${platformConfig.label} Creator`;
  const cleanHandle = (video.creator_name || platform)
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <View style={styles.cardContainer}>
        {/* 1. Header: Author Avatar & Metadata & Overflow Menu */}
        <View style={styles.authorRow}>
          {/* Avatar Icon */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.avatarCircle}
            onPress={onPress}
          >
            <PlatformIcon
              platform={platform}
              size={18}
              color={platformConfig.color}
            />
          </TouchableOpacity>

          {/* Author Name, Verified, Handle, Time */}
          <View style={styles.authorMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {creatorDisplay}
              </Text>
              <PikaIcon
                name="checkmark-circle"
                size={14}
                color="#1D9BF0"
                style={styles.verifiedIcon}
              />
              <Text style={styles.handleText} numberOfLines={1}>
                @{cleanHandle}
              </Text>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.timeText}>
                {getRelativeTime(video.created_at)}
              </Text>
            </View>
          </View>

          {/* More Menu */}
          <TouchableOpacity
            activeOpacity={0.6}
            style={styles.moreButton}
            onPress={() => {
              haptics.light();
              if (onLongPress) onLongPress();
            }}
          >
            <PikaIcon name="ellipsis-horizontal" size={17} color="#71767B" />
          </TouchableOpacity>
        </View>

        {/* 2. Post Title / Caption */}
        <TouchableOpacity
          activeOpacity={0.85}
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
            numberOfLines={3}
          >
            {video.title || `${platformConfig.label} Clip`}
          </Text>
        </TouchableOpacity>

        {/* 2.1 AI Digest Teaser Pill & Snippet */}
        {aiMeta?.tldw && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.aiDigestContainer}
            onPress={() => {
              haptics.selection();
              setShowAiDigest(!showAiDigest);
            }}
          >
            <View style={styles.aiDigestHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={styles.aiSparkleBadge}>
                  <PikaIcon name="sparkles" size={11} color="#A78BFA" />
                  <Text style={styles.aiBadgeText}>30s Digest</Text>
                </View>
                {aiMeta.primary_category && (
                  <View style={styles.aiCategoryBadge}>
                    <Text style={styles.aiCategoryBadgeText}>
                      {aiMeta.primary_category}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.aiExpandHint}>
                {showAiDigest ? "hide" : "tap to expand"}
              </Text>
            </View>
            <Text
              style={styles.aiTldwText}
              numberOfLines={showAiDigest ? 8 : 2}
            >
              {aiMeta.tldw}
            </Text>
          </TouchableOpacity>
        )}

        {/* 3. Media Preview ("nechay jha per video hota ha") */}
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
              <PlatformIcon platform={platform} size={44} color="#71767B" />
            </View>
          )}

          {/* Subtle Scrim */}
          <View style={styles.thumbnailScrim} />

          {/* Platform Badge (Top-Left) */}
          <View style={styles.platformBadge}>
            <PlatformIcon
              platform={platform}
              size={12}
              color={platformConfig.color}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.platformBadgeText}>{platformConfig.label}</Text>
          </View>

          {/* Duration Badge (Bottom-Right) */}
          {durationStr && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationStr}</Text>
            </View>
          )}

          {/* Frosted Play Button Circle */}
          <View style={styles.playButtonCircle}>
            <PikaIcon
              name="play"
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: 2 }}
            />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 0,
    backgroundColor: threadsTokens.colors.canvas,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  authorMeta: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  authorName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    maxWidth: "40%",
  },
  verifiedIcon: {
    marginHorizontal: 3,
  },
  handleText: {
    color: "#71767B",
    fontSize: 14,
    maxWidth: "30%",
  },
  dotSeparator: {
    color: "#71767B",
    fontSize: 13,
    marginHorizontal: 4,
  },
  timeText: {
    color: "#71767B",
    fontSize: 14,
  },
  moreButton: {
    padding: 6,
    marginRight: -4,
  },
  titleArea: {
    marginTop: 6,
    marginBottom: 10,
  },
  titleText: {
    color: "#E7E9EA",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  titleTextWatched: {
    color: "#71767B",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
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
    backgroundColor: "#181818",
  },
  thumbnailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  platformBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2F3336",
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#2F3336",
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
  aiDigestContainer: {
    marginTop: 4,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.22)",
  },
  aiDigestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  aiSparkleBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiCategoryBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.35)",
  },
  aiCategoryBadgeText: {
    color: "#818CF8",
    fontSize: 9.5,
    fontWeight: "700",
  },
  aiBadgeText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    letterSpacing: -0.2,
  },
  aiExpandHint: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "500",
  },
  aiTldwText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
});
