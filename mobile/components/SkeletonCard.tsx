import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

/**
 * Skeleton Loader with looped opacity pulse (1.5s comfortable duration)
 * Aligned with Motion System v4.2 skeleton loading pattern.
 */
export const SkeletonCard: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 750,
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
        <View style={[styles.titleLine, { width: '65%', marginTop: 8 }]} />
        <View style={styles.metaRow}>
          <View style={styles.avatarSkeleton} />
          <View style={styles.creatorSkeleton} />
        </View>
        <View style={styles.footerRow}>
          <View style={styles.btnSkeleton} />
          <View style={[styles.btnSkeleton, { width: 90 }]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  thumbnailSkeleton: {
    width: '100%',
    height: 190,
    backgroundColor: '#1E293B',
  },
  body: {
    padding: 14,
  },
  titleLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#243048',
    width: '92%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
    gap: 8,
  },
  avatarSkeleton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#243048',
  },
  creatorSkeleton: {
    width: 100,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#243048',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  btnSkeleton: {
    width: 110,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#243048',
  },
});
