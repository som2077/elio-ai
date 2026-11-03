import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

/**
 * Pinterest-style Brick Card Skeleton Shimmer
 * Matches the geometry of VideoGridCard.
 */
export const GridSkeletonCard: React.FC<{ height?: number }> = ({ height = 190 }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
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
    <Animated.View style={[styles.cardWrapper, { opacity: pulseAnim }]}>
      {/* Thumbnail placeholder */}
      <View style={[styles.imagePlaceholder, { height }]} />

      {/* Pin info below thumbnail */}
      <View style={styles.infoBlock}>
        <View style={styles.titleLine1} />
        <View style={styles.titleLine2} />
        <View style={styles.creatorRow}>
          <View style={styles.avatarCircle} />
          <View style={styles.creatorName} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    marginBottom: 14,
  },
  imagePlaceholder: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  infoBlock: {
    paddingTop: 8,
    paddingHorizontal: 2,
    gap: 6,
  },
  titleLine1: {
    width: '90%',
    height: 11,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleLine2: {
    width: '65%',
    height: 11,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  avatarCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  creatorName: {
    width: '50%',
    height: 9,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
