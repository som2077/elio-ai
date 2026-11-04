import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  onOpenScanner: () => void;
  onOpenSearch?: () => void;
  onOpenFeedsDrawer?: () => void;
  translateY?: Animated.Value;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  userEmail: _userEmail,
  totalCount: _totalCount,
  unreadCount: _unreadCount,
  onOpenScanner,
  onOpenSearch,
  onOpenFeedsDrawer,
  translateY,
}) => {
  const insets = useSafeAreaInsets();
  const qrScale = useRef(new Animated.Value(1)).current;
  const searchScale = useRef(new Animated.Value(1)).current;

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

  // Header content fades out slightly when sliding up
  const barOpacity = translateY
    ? translateY.interpolate({
        inputRange: [-48, 0],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  // Status bar bottom hairline appears when header bar collapses
  const statusBarHairlineOpacity = translateY
    ? translateY.interpolate({
        inputRange: [-48, 0],
        outputRange: [1, 0],
        extrapolate: "clamp",
      })
    : 0;

  return (
    <>
      {/* 1. Permanent Status Bar Frosted Blur (Always active even when header slides out) */}
      <View
        style={[
          styles.statusBarBlurContainer,
          {
            height: insets.top,
          },
        ]}
        pointerEvents="none"
      >
        <BlurView
          intensity={50}
          tint="systemUltraThinMaterialDark"
          blurReductionFactor={2}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Subtle hairline under status bar visible when header is collapsed */}
        <Animated.View
          style={[
            styles.statusBarHairline,
            { opacity: statusBarHairlineOpacity },
          ]}
        />
      </View>

      {/* 2. Sliding Collapsible Header Bar */}
      <Animated.View
        style={[
          styles.headerBarContainer,
          {
            top: insets.top,
            transform: [{ translateY: translateY || 0 }],
            opacity: barOpacity,
          },
        ]}
      >
        {/* Frosted Glass Backdrop Blur for Header Bar */}
        <BlurView
          intensity={50}
          tint="systemUltraThinMaterialDark"
          blurReductionFactor={2}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />

        {/* Top Bar Content: Hamburger, Elio Logo, QR, Search */}
        <View style={styles.topBar}>
          {/* Left Hamburger Drawer Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            onPress={() => {
              haptics.selection();
              if (onOpenFeedsDrawer) onOpenFeedsDrawer();
            }}
          >
            <Ionicons name="reorder-two-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Center Elio AI Logo */}
          <View style={styles.logoCenter} pointerEvents="none">
            <Image
              source={require("../assets/elio-logo-header.png")}
              style={styles.elioLogo}
              resizeMode="contain"
            />
          </View>

          {/* Right Actions: QR Scanner & Search Button */}
          <View style={styles.actionsRight}>
            <Animated.View style={{ transform: [{ scale: qrScale }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.iconBtn}
                onPressIn={() => animatePressIn(qrScale)}
                onPressOut={() => animatePressOut(qrScale)}
                onPress={() => {
                  haptics.selection();
                  onOpenScanner();
                }}
              >
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: searchScale }] }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.iconBtn}
                onPressIn={() => animatePressIn(searchScale)}
                onPressOut={() => animatePressOut(searchScale)}
                onPress={() => {
                  haptics.selection();
                  if (onOpenSearch) onOpenSearch();
                }}
              >
                <Ionicons name="search-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Hairline Divider at the bottom of the header */}
        <View style={styles.headerBottomHairline} />
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  statusBarBlurContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
    overflow: "hidden",
  },
  statusBarHairline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  headerBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 48,
    zIndex: 11,
    overflow: "hidden",
  },
  headerBottomHairline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "relative",
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  elioLogo: {
    width: 36,
    height: 36,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
