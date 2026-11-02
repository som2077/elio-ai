import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavedVideo } from '../types/video';
import { appleColors, appleRadii, appleTypography, appleShadows } from '../theme/appleTokens';
import { haptics } from '../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoDetailSheetProps {
  video: SavedVideo | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (video: SavedVideo) => void;
  onToggleStatus: (video: SavedVideo) => void;
  onCopyLink?: (url: string) => void;
  onDelete: (video: SavedVideo) => void;
}

export const VideoDetailSheet: React.FC<VideoDetailSheetProps> = ({
  video,
  visible,
  onClose,
  onPlay,
  onToggleStatus,
  onCopyLink,
  onDelete,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!video) return null;

  const isWatched = video.status === 'watched';
  const platform = (video.platform || 'youtube').toLowerCase();
  const platformConfig =
    appleColors.platforms[platform as keyof typeof appleColors.platforms] ||
    appleColors.platforms.youtube;

  const handleShare = async () => {
    try {
      haptics.light();
      await Share.share({
        message: `${video.title || 'Check this out'}: ${video.clean_url}`,
        url: video.clean_url,
      });
    } catch (err: any) {
      console.warn('Share error:', err.message);
    }
  };

  const handleDeletePrompt = () => {
    haptics.warning();
    Alert.alert(
      'Remove Video',
      'Are you sure you want to delete this clip from your Elio AI vault?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDelete(video);
          },
        },
      ]
    );
  };

  const formattedDate = new Date(video.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlayContainer}>
        {/* Backdrop Scrim */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sliding Bottom Drawer */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Top Specular Rim */}
          <View style={styles.specularRim} />

          {/* Grabber Handle & Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.grabberPill} />
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeBtn}
              onPress={() => {
                haptics.light();
                onClose();
              }}
            >
              <Ionicons name="close" size={18} color={appleColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Widescreen Preview Media */}
            <View style={styles.mediaContainer}>
              <Image
                source={{
                  uri:
                    video.thumbnail_url ||
                    'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&auto=format&fit=crop&q=80',
                }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
              <View style={styles.mediaScrim} />

              {/* Big Optical Play Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.playOverlayBtn}
                onPress={() => {
                  haptics.selection();
                  onClose();
                  onPlay(video);
                }}
              >
                <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </TouchableOpacity>

              {/* Platform & Type Pills */}
              <View style={styles.mediaBadgesRow}>
                <View
                  style={[
                    styles.platformBadge,
                    {
                      backgroundColor: platformConfig.bg,
                      borderColor: platformConfig.border,
                    },
                  ]}
                >
                  <Text style={[styles.platformBadgeText, { color: platformConfig.color }]}>
                    {platformConfig.label}
                  </Text>
                </View>

                {video.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {video.category.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Title & Metadata */}
            <Text style={styles.titleText}>{video.title || 'Untitled Social Clip'}</Text>

            <View style={styles.metaRow}>
              {video.creator_name ? (
                <View style={styles.creatorWrap}>
                  <Ionicons name="person-circle-outline" size={16} color={appleColors.accentLight} />
                  <Text style={styles.creatorText}>{video.creator_name}</Text>
                </View>
              ) : null}
              <View style={styles.dateWrap}>
                <Ionicons name="calendar-outline" size={13} color={appleColors.textTertiary} />
                <Text style={styles.dateText}>Saved {formattedDate}</Text>
              </View>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.actionsGrid}>
              {/* Play Now CTA */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryActionBtn}
                onPress={() => {
                  haptics.success();
                  onClose();
                  onPlay(video);
                }}
              >
                <Ionicons name="play" size={18} color="#070A11" />
                <Text style={styles.primaryActionText}>Watch Clip</Text>
              </TouchableOpacity>

              {/* Mark Watched Toggle */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.secondaryActionBtn,
                  isWatched && styles.secondaryActionBtnActive,
                ]}
                onPress={() => {
                  onToggleStatus(video);
                }}
              >
                <Ionicons
                  name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={isWatched ? '#30D158' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.secondaryActionText,
                    isWatched && { color: '#30D158' },
                  ]}
                >
                  {isWatched ? 'Completed' : 'Mark Watched'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Secondary Action Pills (Share, Copy Link, Delete) */}
            <View style={styles.utilRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.utilBtn}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={16} color={appleColors.textSecondary} />
                <Text style={styles.utilBtnText}>Share</Text>
              </TouchableOpacity>

              {onCopyLink ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.utilBtn}
                  onPress={() => {
                    haptics.light();
                    onCopyLink(video.clean_url);
                  }}
                >
                  <Ionicons name="link-outline" size={16} color={appleColors.textSecondary} />
                  <Text style={styles.utilBtnText}>Copy Link</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.utilBtn, styles.deleteBtn]}
                onPress={handleDeletePrompt}
              >
                <Ionicons name="trash-outline" size={16} color="#FF453A" />
                <Text style={[styles.utilBtnText, { color: '#FF453A' }]}>Remove</Text>
              </TouchableOpacity>
            </View>

            {/* Notes / Transcription Callout */}
            {video.user_notes ? (
              <View style={styles.notesBox}>
                <View style={styles.notesHeader}>
                  <Ionicons name="document-text-outline" size={14} color={appleColors.accentLight} />
                  <Text style={styles.notesTitle}>AI Notes & Summary</Text>
                </View>
                <Text style={styles.notesContent}>{video.user_notes}</Text>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheetContainer: {
    backgroundColor: '#0C101B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: 34,
    ...appleShadows.card,
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  sheetHeader: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  grabberPill: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 24,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#05070D',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playOverlayBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(15, 20, 35, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...appleShadows.card,
  },
  mediaBadgesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  creatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  creatorText: {
    color: appleColors.accentLight,
    fontSize: 13,
    fontWeight: '600',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    color: appleColors.textTertiary,
    fontSize: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appleColors.accentLight,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  primaryActionText: {
    color: '#070A11',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  secondaryActionBtnActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  secondaryActionText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  utilRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  utilBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 5,
  },
  utilBtnText: {
    color: appleColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    borderColor: 'rgba(255, 69, 58, 0.25)',
    backgroundColor: 'rgba(255, 69, 58, 0.06)',
  },
  notesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesTitle: {
    color: appleColors.accentLight,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  notesContent: {
    color: appleColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
