import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavedVideo } from '../types/video';
import { threadsTokens } from '../theme/appleTokens';
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

/**
 * Authentic Instagram Threads Action Sheet
 * Matches Screenshot 4 layout and actions:
 * - Drag handle at top
 * - "Copy link"
 * - "Save" (toggle watched/unread)
 * - "Open in App"
 * - "Not interested"
 * - Hairline separator
 * - "Mute"
 * - "Restrict"
 * - "Block" / "Remove clip" (Red)
 * - "Report" (Red)
 */
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
          damping: 26,
          stiffness: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!video) return null;

  const isWatched = video.status === 'watched';

  const handleCopy = () => {
    haptics.light();
    if (onCopyLink) {
      onCopyLink(video.clean_url);
    }
    onClose();
  };

  const handleSaveToggle = () => {
    haptics.selection();
    onToggleStatus(video);
    onClose();
  };

  const handleOpenPlay = () => {
    haptics.selection();
    onClose();
    onPlay(video);
  };

  const handleDeletePrompt = () => {
    haptics.warning();
    Alert.alert(
      'Remove Clip',
      'Are you sure you want to remove this clip from your vault?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDelete(video);
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
        </TouchableWithoutFeedback>

        {/* Threads Action Sheet Panel */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Top Grabber Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          {/* Action List Section 1 */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleCopy}
            >
              <Text style={styles.actionLabel}>Copy link</Text>
              <Ionicons name="link-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleSaveToggle}
            >
              <Text style={styles.actionLabel}>
                {isWatched ? 'Move back to Queue' : 'Save'}
              </Text>
              <Ionicons
                name={isWatched ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleOpenPlay}
            >
              <Text style={styles.actionLabel}>Open in App</Text>
              <Ionicons name="open-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => {
                haptics.light();
                onClose();
              }}
            >
              <Text style={styles.actionLabel}>Not interested</Text>
              <Ionicons name="eye-off-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Section Divider */}
          <View style={styles.divider} />

          {/* Action List Section 2 */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => {
                haptics.light();
                onClose();
              }}
            >
              <Text style={styles.actionLabel}>Mute</Text>
              <Ionicons name="volume-mute-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => {
                haptics.light();
                onClose();
              }}
            >
              <Text style={styles.actionLabel}>Restrict</Text>
              <Ionicons name="person-remove-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleDeletePrompt}
            >
              <Text style={[styles.actionLabel, styles.dangerText]}>
                Remove clip
              </Text>
              <Ionicons
                name="trash-outline"
                size={22}
                color={threadsTokens.colors.destructive}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => {
                haptics.warning();
                onClose();
              }}
            >
              <Text style={[styles.actionLabel, styles.dangerText]}>Report</Text>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={threadsTokens.colors.destructive}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#181818',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3E3E3E',
  },
  actionGroup: {
    paddingVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  dangerText: {
    color: threadsTokens.colors.destructive,
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 4,
  },
});
