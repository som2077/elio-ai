import React, { useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SavedVideo } from '../types/video';
import { motionTokens } from '../utils/motion';

interface VideoCardProps {
  video: SavedVideo;
  onPress: () => void;
  onToggleStatus: () => void;
  onDelete?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onPress, onToggleStatus, onDelete }) => {
  const isYouTube = video.platform === 'youtube';
  const isWatched = video.status === 'watched';

  // Motion interaction animated values
  const cardScale = useRef(new Animated.Value(1)).current;
  const statusScale = useRef(new Animated.Value(1)).current;
  const openBtnScale = useRef(new Animated.Value(1)).current;

  const handleCardPressIn = () => {
    Animated.spring(cardScale, {
      toValue: motionTokens.scale.pressed,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  const handleCardPressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handleStatusPress = () => {
    // Tactile bounce micro-interaction for status toggle
    Animated.sequence([
      Animated.timing(statusScale, {
        toValue: motionTokens.scale.buttonTap,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(statusScale, {
        toValue: 1,
        speed: 35,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
    onToggleStatus();
  };

  // Format date cleanly
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
        {/* Thumbnail Container */}
        <View style={styles.thumbnailWrapper}>
          <Image
            source={{
              uri:
                video.thumbnail_url ||
                (isYouTube
                  ? 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80'
                  : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80'),
            }}
            style={styles.thumbnail}
          />
          
          {/* Subtle Dark Gradient Overlay */}
          <View style={styles.gradientOverlay} />

          {/* Platform Badge */}
          <View
            style={[
              styles.platformBadge,
              video.platform === 'youtube' && styles.ytBadge,
              video.platform === 'instagram' && styles.igBadge,
              video.platform === 'twitter' && styles.xBadge,
              video.platform === 'facebook' && styles.fbBadge,
              video.platform === 'reddit' && styles.redditBadge,
              video.platform === 'linkedin' && styles.linkedinBadge,
              video.platform === 'pinterest' && styles.pinterestBadge,
              video.platform === 'tiktok' && styles.tiktokBadge,
            ]}
          >
            <Text style={styles.platformBadgeText}>
              {video.platform === 'youtube' && '▶ YouTube'}
              {video.platform === 'instagram' && '✦ Instagram'}
              {video.platform === 'twitter' && '𝕏 Twitter'}
              {video.platform === 'facebook' && 'f Facebook'}
              {video.platform === 'reddit' && '● Reddit'}
              {video.platform === 'linkedin' && 'in LinkedIn'}
              {video.platform === 'pinterest' && 'P Pinterest'}
              {video.platform === 'tiktok' && '♫ TikTok'}
            </Text>
          </View>

          {/* Category Pill (Short/Reel/Video) */}
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>{(video.category || 'VIDEO').toUpperCase()}</Text>
          </View>

          {/* Play Icon Hint in Center */}
          <View style={styles.playHintContainer}>
            <View style={styles.playHintCircle}>
              <Text style={styles.playHintIcon}>▶</Text>
            </View>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.body}>
          <Text style={[styles.title, isWatched && styles.titleWatched]} numberOfLines={2}>
            {video.title || 'Untitled Clip'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.creatorInfo}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.creatorAvatarText}>
                  {(video.creator_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.creatorName} numberOfLines={1}>
                {video.creator_name || (isYouTube ? 'YouTube Channel' : '@creator')}
              </Text>
            </View>

            <View style={styles.metaRight}>
              {video.source_device_name ? (
                <View style={styles.deviceSourceBadge}>
                  <Text style={styles.deviceSourceText} numberOfLines={1}>
                    💻 {video.source_device_name}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.timestamp}>{formattedDate}</Text>
            </View>
          </View>

          {/* Bottom Actions Row */}
          <View style={styles.footer}>
            <Animated.View style={{ transform: [{ scale: statusScale }] }}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.statusBtn, isWatched ? styles.statusBtnWatched : styles.statusBtnActive]}
                onPress={handleStatusPress}
              >
                <Text style={[styles.statusBtnText, isWatched ? styles.statusBtnTextWatched : styles.statusBtnTextActive]}>
                  {isWatched ? '✓ Watched' : '● Mark as Done'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.openNativeBtn}
              onPress={onPress}
            >
              <Text style={styles.openNativeBtnText}>Open Video ↗</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131B2E', // Deep premium obsidian dark
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  cardWatched: {
    opacity: 0.55,
    borderColor: '#1A2338',
  },
  thumbnailWrapper: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#0A0F1D',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 29, 0.25)',
  },
  platformBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  ytBadge: {
    backgroundColor: '#DC2626',
  },
  igBadge: {
    backgroundColor: '#D946EF',
  },
  xBadge: {
    backgroundColor: '#0F1419',
    borderWidth: 1,
    borderColor: '#38444D',
  },
  fbBadge: {
    backgroundColor: '#1877F2',
  },
  redditBadge: {
    backgroundColor: '#FF4500',
  },
  linkedinBadge: {
    backgroundColor: '#0A66C2',
  },
  pinterestBadge: {
    backgroundColor: '#E60023',
  },
  tiktokBadge: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#25F4EE',
  },
  platformBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  playHintContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playHintCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  playHintIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 3,
  },
  body: {
    padding: 14,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 10,
  },
  titleWatched: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  creatorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  creatorAvatarText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  creatorName: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  metaRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  deviceSourceBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: 130,
  },
  deviceSourceText: {
    color: '#818CF8',
    fontSize: 9,
    fontWeight: '700',
  },
  timestamp: {
    color: '#64748B',
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  statusBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBtnWatched: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBtnTextActive: {
    color: '#94A3B8',
  },
  statusBtnTextWatched: {
    color: '#34D399',
  },
  openNativeBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  openNativeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
