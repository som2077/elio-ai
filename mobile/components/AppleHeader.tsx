import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appleColors, appleRadii, appleTypography } from '../theme/appleTokens';
import { haptics } from '../utils/haptics';
import { motionTokens } from '../utils/motion';

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  showCalendar: boolean;
  onToggleCalendar: () => void;
  onOpenScanner: () => void;
  onOpenDevices: () => void;
  onLogout: () => void;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  userEmail,
  totalCount,
  unreadCount,
  showCalendar,
  onToggleCalendar,
  onOpenScanner,
  onOpenDevices,
  onLogout,
}) => {
  const qrScale = useRef(new Animated.Value(1)).current;
  const calScale = useRef(new Animated.Value(1)).current;
  const menuScale = useRef(new Animated.Value(1)).current;

  const animatePressIn = (val: Animated.Value) => {
    Animated.spring(val, {
      toValue: motionTokens.scale.pressed,
      useNativeDriver: true,
      damping: motionTokens.spring.settle.damping,
      stiffness: motionTokens.spring.settle.stiffness,
    }).start();
  };

  const animatePressOut = (val: Animated.Value) => {
    Animated.spring(val, {
      toValue: 1,
      useNativeDriver: true,
      damping: motionTokens.spring.bouncy.damping,
      stiffness: motionTokens.spring.bouncy.stiffness,
    }).start();
  };

  return (
    <View style={styles.headerContainer}>
      {/* Top Identity Row */}
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.largeTitle}>Elio AI</Text>
          <View style={styles.statusRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.statusText}>
              {unreadCount > 0
                ? `${unreadCount} unread • ${totalCount} saved`
                : `All caught up • ${totalCount} saved`}
            </Text>
          </View>
        </View>

        {/* Apple HIG Action Capsule */}
        <View style={styles.actionsGroup}>
          {/* Link PC (QR Scan) Button */}
          <Animated.View style={{ transform: [{ scale: qrScale }] }}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.actionPill}
              onPressIn={() => animatePressIn(qrScale)}
              onPressOut={() => animatePressOut(qrScale)}
              onPress={() => {
                haptics.light();
                onOpenScanner();
              }}
            >
              <Ionicons name="qr-code-outline" size={15} color={appleColors.accentLight} />
              <Text style={styles.actionPillText}>Link PC</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Activity Calendar / Stats Button */}
          <Animated.View style={{ transform: [{ scale: calScale }] }}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.actionPill,
                showCalendar && styles.actionPillActive,
              ]}
              onPressIn={() => animatePressIn(calScale)}
              onPressOut={() => animatePressOut(calScale)}
              onPress={() => {
                haptics.selection();
                onToggleCalendar();
              }}
            >
              <Ionicons
                name={showCalendar ? 'calendar' : 'calendar-outline'}
                size={15}
                color={showCalendar ? '#FFFFFF' : appleColors.textSecondary}
              />
              <Text
                style={[
                  styles.actionPillText,
                  showCalendar && styles.actionPillTextActive,
                ]}
              >
                {showCalendar ? 'Close' : 'Stats'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Devices Manager */}
          <Animated.View style={{ transform: [{ scale: menuScale }] }}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.iconCircleBtn}
              onPressIn={() => animatePressIn(menuScale)}
              onPressOut={() => animatePressOut(menuScale)}
              onPress={() => {
                haptics.light();
                onOpenDevices();
              }}
            >
              <Ionicons name="laptop-outline" size={16} color={appleColors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>

          {/* Sign Out Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.iconCircleBtn}
            onPress={() => {
              haptics.warning();
              onLogout();
            }}
          >
            <Ionicons name="log-out-outline" size={16} color={appleColors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: appleColors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: appleColors.borderSubtle,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleGroup: {
    flex: 1,
  },
  largeTitle: {
    ...appleTypography.largeTitle,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: appleColors.success,
  },
  statusText: {
    ...appleTypography.footnote,
    ...appleTypography.tabularNums,
    color: appleColors.textSecondary,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: appleRadii.pill,
    backgroundColor: appleColors.surfaceGlass,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
  },
  actionPillActive: {
    backgroundColor: appleColors.accent,
    borderColor: appleColors.accentLight,
  },
  actionPillText: {
    ...appleTypography.caption,
    color: appleColors.textSecondary,
    fontWeight: '700',
  },
  actionPillTextActive: {
    color: '#FFFFFF',
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: appleColors.surfaceGlass,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
