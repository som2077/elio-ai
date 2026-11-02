import React, { useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavedVideo } from '../types/video';
import {
  appleColors,
  appleRadii,
  appleTypography,
  appleShadows,
} from '../theme/appleTokens';
import { haptics } from '../utils/haptics';
import { motionTokens } from '../utils/motion';

interface VideoCardProps {
  video: SavedVideo;
  onPress: () => void;
  onToggleStatus: () => void;
  onDelete?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onToggleStatus,
  onDelete,
}) => {
  const isWatched = video.status === 'watched';
  const platformConfig =
    appleColors.platforms[video.platform as keyof typeof appleColors.platforms] ||
    appleColors.platforms.youtube;

  // Spring animation values
  const cardScale = useRef(new Animated.Value(1)).current;
  const checkmarkScale = useRef(new Animated.Value(1)).current;

  const handleCardPressIn = () => {
    Animated.spring(cardScale, {
      toValue: motionTokens.scale.pressed,
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

    // Apple tactile checkmark pop
    Animated.sequence([
      Animated.timing(checkmarkScale, {
        toValue: motionTokens.scale.buttonTap,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(checkmarkScale, {
        toValue: motionTokens.scale.checkmarkBurst,
        speed: 40,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.spring(checkmarkScale, {
        toValue: 1,
        speed: 30,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();

    onToggleStatus();
  };

  // Format date with tabular numbers
  const formattedDate = new Date(video.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <TouchableOpacity
        activeOpacity={0.92}
        style={[styles.card, isWatched && styles.cardWatched]}
        onPress={onPress}
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
      >
        {/* Top Light-Catching Specular Highlight */}
        <View style={styles.specularRim} />

        {/* Thumbnail Area */}
        <View style={styles.thumbnailWrapper}>
          <Image
            source={{
              uri:
                video.thumbnail_url &&
                !video.thumbnail_url.includes('.mp4') &&
                !video.thumbnail_url.includes('.m3u8')
                  ? video.thumbnail_url
                  : 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80',
            }}
            style={styles.thumbnail}
            resizeMode="cover"
          />

          {/* Inset Outline to prevent dark bleed */}
          <View style={styles.thumbnailOutline} />

          {/* Platform Tag */}
          <View
            style={[
              styles.platformPill,
              { backgroundColor: platformConfig.bg, borderColor: platformConfig.border },
            ]}
          >
            <Text style={[styles.platformPillText, { color: platformConfig.color }]}>
              {platformConfig.label}
            </Text>
          </View>

          {/* Category Tag (Video / Short / Reel) */}
          {video.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{video.category.toUpperCase()}</Text>
            </View>
          )}

          {/* Watched Overlay */}
          {isWatched && (
            <View style={styles.watchedOverlay}>
              <Ionicons name="checkmark-circle" size={24} color={appleColors.success} />
              <Text style={styles.watchedOverlayText}>Watched</Text>
            </View>
          )}
        </View>

        {/* Card Body */}
        <View style={styles.body}>
          {/* Creator & Date Row */}
          <View style={styles.metaRow}>
            {video.creator_name ? (
              <View style={styles.creatorGroup}>
                <Ionicons
                  name="person-circle-outline"
                  size={14}
                  color={appleColors.textSecondary}
                />
                <Text style={styles.creatorText} numberOfLines={1}>
                  {video.creator_name}
                </Text>
              </View>
            ) : null}
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>

          {/* Title */}
          <Text
            style={[styles.title, isWatched && styles.titleWatched]}
            numberOfLines={2}
          >
            {video.title || 'Untitled Social Clip'}
          </Text>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            {/* Apple Reminders-Style Circular Status Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.statusToggleBtn}
              onPress={handleToggle}
            >
              <Animated.View
                style={[
                  styles.statusCircle,
                  isWatched && styles.statusCircleActive,
                  { transform: [{ scale: checkmarkScale }] },
                ]}
              >
                {isWatched && (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                )}
              </Animated.View>
              <Text
                style={[
                  styles.statusLabel,
                  isWatched && styles.statusLabelActive,
                ]}
              >
                {isWatched ? 'Completed' : 'Mark Watched'}
              </Text>
            </TouchableOpacity>

            {/* Quick Open Action Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.openBtn}
              onPress={onPress}
            >
              <Text style={styles.openBtnText}>Open</Text>
              <Ionicons
                name="arrow-forward"
                size={12}
                color={appleColors.accentLight}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appleColors.surfaceSecondary,
    borderRadius: appleRadii.card,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
    ...appleShadows.card,
  },
  cardWatched: {
    opacity: 0.72,
    backgroundColor: '#0A0F1E',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: appleColors.borderSpecularTop,
    zIndex: 2,
  },
  thumbnailWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#070A13',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailOutline: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  platformPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
  },
  platformPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  watchedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 19, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  watchedOverlayText: {
    ...appleTypography.caption,
    color: appleColors.success,
    fontWeight: '700',
  },
  body: {
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  creatorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  creatorText: {
    ...appleTypography.subhead,
    color: appleColors.textSecondary,
    fontWeight: '600',
  },
  dateText: {
    ...appleTypography.footnote,
    ...appleTypography.tabularNums,
    color: appleColors.textTertiary,
  },
  title: {
    ...appleTypography.headline,
    marginBottom: 12,
  },
  titleWatched: {
    color: appleColors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: appleColors.borderSubtle,
  },
  statusToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: appleColors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCircleActive: {
    backgroundColor: appleColors.success,
    borderColor: appleColors.success,
  },
  statusLabel: {
    ...appleTypography.footnote,
    fontWeight: '600',
    color: appleColors.textSecondary,
  },
  statusLabelActive: {
    color: appleColors.success,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: appleColors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
  },
  openBtnText: {
    ...appleTypography.caption,
    color: appleColors.accentLight,
    fontWeight: '700',
  },
});
