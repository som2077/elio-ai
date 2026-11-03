import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

interface AppleHeaderProps {
  userEmail?: string;
  totalCount: number;
  unreadCount: number;
  onOpenScanner: () => void;
  onOpenSearch?: () => void;
  onOpenFeedsDrawer?: () => void;
}

export const AppleHeader: React.FC<AppleHeaderProps> = ({
  userEmail: _userEmail,
  totalCount: _totalCount,
  unreadCount: _unreadCount,
  onOpenScanner,
  onOpenSearch,
  onOpenFeedsDrawer,
}) => {
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

  return (
    <View style={styles.headerContainer}>
      {/* Top Bar: Hamburger Menu, Center Threads Logo, Right Actions */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
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
