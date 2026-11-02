import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  appleColors,
  appleRadii,
  appleTypography,
  appleShadows,
} from '../theme/appleTokens';
import { haptics } from '../utils/haptics';

interface EmptyStateProps {
  onLinkPress: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onLinkPress }) => {
  return (
    <View style={styles.container}>
      {/* 3D Mascot in Concentric Squircle Frame */}
      <View style={styles.mascotGlowWrap}>
        <View style={styles.mascotGlow} />
        <View style={styles.mascotFrame}>
          <Image
            source={require('../assets/app-icon-original.jpg')}
            style={styles.mascotImage}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Editorial Copy */}
      <Text style={styles.heading}>Your Video Vault is Empty</Text>
      <Text style={styles.description}>
        Like or bookmark videos on YouTube, Instagram, Twitter, and TikTok in your
        desktop browser. They will sync here automatically!
      </Text>

      {/* Apple Primary Action Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.actionBtn}
        onPress={() => {
          haptics.light();
          onLinkPress();
        }}
      >
        <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
        <Text style={styles.actionBtnText}>Link Desktop Extension</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  mascotGlowWrap: {
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: appleColors.accentGlow,
  },
  mascotFrame: {
    width: 90,
    height: 90,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: appleColors.borderSpecularTop,
    ...appleShadows.elevated,
  },
  mascotImage: {
    width: '100%',
    height: '100%',
  },
  heading: {
    ...appleTypography.title2,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    ...appleTypography.subhead,
    color: appleColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: appleColors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
    borderColor: appleColors.accentLight,
    ...appleShadows.accentPill,
  },
  actionBtnText: {
    ...appleTypography.caption,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
