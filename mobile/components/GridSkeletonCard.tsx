import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { appleColors, appleRadii } from '../theme/appleTokens';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 16 * 2 - 12) / 2;

/**
 * Cosmos-style 2-column poster grid skeleton shimmer
 * Exactly matches VideoGridCard geometry to prevent layout shift.
 */
export const GridSkeletonCard: React.FC = () => {
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
      {/* Top badges shimmer */}
      <View style={styles.topRow}>
        <View style={styles.badgeSkeleton} />
        <View style={styles.dotSkeleton} />
      </View>

      {/* Bottom text scrim shimmer */}
      <View style={styles.bottomBlock}>
        <View style={styles.creatorSkeleton} />
        <View style={styles.titleLine1} />
        <View style={styles.titleLine2} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: GRID_ITEM_WIDTH,
    aspectRatio: 0.78,
    borderRadius: appleRadii.card,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeSkeleton: {
    width: 50,
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dotSkeleton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomBlock: {
    gap: 6,
  },
  creatorSkeleton: {
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleLine1: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleLine2: {
    width: '60%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
