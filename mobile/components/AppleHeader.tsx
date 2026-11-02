import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  layoutMode: "grid" | "list";
  onToggleLayout: () => void;
  onOpenScanner: () => void;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  userEmail,
  totalCount,
  unreadCount,
  layoutMode,
  onToggleLayout,
  onOpenScanner,
}) => {
  const qrScale = useRef(new Animated.Value(1)).current;
  const layoutScale = useRef(new Animated.Value(1)).current;

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
      {/* Brand & Greeting Block */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          {/* Mascot Squircle Badge */}
          <View style={styles.mascotBadge}>
            <View style={styles.mascotHead}>
              <View style={styles.mascotEyeLeft} />
              <View style={styles.mascotEyeRight} />
            </View>
          </View>

          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>Elio AI</Text>
              <View style={styles.livePulseDot} />
            </View>
            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread • ${totalCount} saved clips`
                : `All caught up • ${totalCount} clips`}
            </Text>
          </View>
        </View>

        {/* Right Action Icons: Grid/List Toggle + Link PC */}
        <View style={styles.actionsRight}>
          {/* Grid vs List View Mode Toggle */}
          <Animated.View style={{ transform: [{ scale: layoutScale }] }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.actionCircleBtn}
              onPressIn={() => animatePressIn(layoutScale)}
              onPressOut={() => animatePressOut(layoutScale)}
              onPress={() => {
                haptics.selection();
                onToggleLayout();
              }}
            >
              <Ionicons
                name={layoutMode === "grid" ? "list-outline" : "grid-outline"}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Link PC QR Scanner */}
          <Animated.View style={{ transform: [{ scale: qrScale }] }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.linkPill}
              onPressIn={() => animatePressIn(qrScale)}
              onPressOut={() => animatePressOut(qrScale)}
              onPress={() => {
                haptics.light();
                onOpenScanner();
              }}
            >
              <Ionicons name="qr-code-outline" size={14} color="#070A11" />
              <Text style={styles.linkPillText}>Link PC</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: appleColors.canvas,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  mascotBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  mascotHead: {
    width: 22,
    height: 20,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "12deg" }],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  mascotEyeLeft: {
    width: 2.5,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: "#070A11",
  },
  mascotEyeRight: {
    width: 2.5,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: "#070A11",
  },
  titleColumn: {
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: appleColors.accentLight,
  },
  subtitle: {
    color: appleColors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appleColors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 18,
    gap: 5,
  },
  linkPillText: {
    color: "#070A11",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
});
