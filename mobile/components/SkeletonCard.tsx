import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { appleColors, appleRadii } from '../theme/appleTokens';

/**
 * Apple-grade Shimmer Skeleton Loader
 * Matched with Apple concentric card geometry and smooth harmonic pulse.
 */
export const SkeletonCard: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.card, { opacity: pulseAnim }]}>
      <View style={styles.thumbnailSkeleton} />
      <View style={styles.body}>
        <View style={styles.titleLine} />
        <View style={[styles.titleLine, { width: '60%', marginTop: 8 }]} />
        <View style={styles.metaRow}>
          <View style={styles.avatarSkeleton} />
          <View style={styles.creatorSkeleton} />
        </View>
        <View style={styles.footerRow}>
          <View style={styles.btnSkeleton} />
          <View style={[styles.btnSkeleton, { width: 70 }]} />
        </View>
      </View>
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
  },
  thumbnailSkeleton: {
    width: '100%',
    height: 180,
    backgroundColor: appleColors.surfaceTertiary,
  },
  body: {
    padding: 14,
  },
  titleLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: appleColors.surfaceTertiary,
    width: '90%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  avatarSkeleton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: appleColors.surfaceTertiary,
  },
  creatorSkeleton: {
    width: 90,
    height: 12,
    borderRadius: 6,
    backgroundColor: appleColors.surfaceTertiary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: appleColors.borderSubtle,
  },
  btnSkeleton: {
    width: 100,
    height: 26,
    borderRadius: appleRadii.pill,
    backgroundColor: appleColors.surfaceTertiary,
  },
});
