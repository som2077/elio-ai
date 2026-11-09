import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  BackHandler,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { appleRadii } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { motionTokens } from "../utils/motion";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 44, 380);

export interface FirstTimeScanPromptModalProps {
  visible: boolean;
  onScanPress: () => void;
  onSkipPress: () => void;
}

/**
 * FirstTimeScanPromptModal — Apple HIG / Threads Obsidian Theme
 * In-tree overlay with true native hardware Frosted Glass Blur over the HomeScreen.
 */
export const FirstTimeScanPromptModal: React.FC<
  FirstTimeScanPromptModalProps
> = ({ visible, onScanPress, onSkipPress }) => {
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scanBtnScale = useRef(new Animated.Value(1)).current;
  const skipBtnScale = useRef(new Animated.Value(1)).current;

  // Handle Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleSkip();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [visible]);

  // Spring entrance & exit
  useEffect(() => {
    if (visible) {
      haptics.medium();
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 9,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      cardScale.setValue(0.92);
      cardOpacity.setValue(0);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const handleScan = () => {
    haptics.success();
    onScanPress();
  };

  const handleSkip = () => {
    haptics.light();
    onSkipPress();
  };

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: backdropOpacity,
        },
      ]}
      pointerEvents="auto"
    >
      {/* 1. Real-time Native Hardware Frosted Glass Blur over HomeScreen */}
      <BlurView
        intensity={Platform.OS === "ios" ? 75 : 45}
        tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
        blurReductionFactor={Platform.OS === "android" ? 2 : 1}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Soft obsidian dark veil for rich depth and text pop */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0, 0, 0, 0.62)" },
        ]}
      />

      {/* 3. Tap outside backdrop to dismiss */}
      <TouchableWithoutFeedback onPress={handleSkip}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      {/* 4. Floating Concentric Obsidian Modal Card */}
      <TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          {/* Subtle Specular Top Highlight */}
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.14)",
              "rgba(255, 255, 255, 0.03)",
              "transparent",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.35 }}
            style={styles.specularBorder}
          />

          {/* Minimalist Hero Icon Emblem */}
          <View style={styles.heroIconWrapper}>
            <View style={styles.heroIconBox}>
              <Ionicons name="desktop-outline" size={26} color="#FFFFFF" />
              <View style={styles.qrBadgeMini}>
                <Ionicons name="qr-code-outline" size={11} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Main Title */}
          <Text style={styles.title}>Link Desktop Browser</Text>

          {/* Explanatory Subtitle */}
          <Text style={styles.message}>
            Sync all your saved reels, shorts & videos seamlessly between your
            PC and phone with a quick QR scan.
          </Text>

          {/* Inset Steps Summary */}
          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={styles.stepIconBox}>
                <Ionicons name="laptop-outline" size={14} color="#D4D4D8" />
              </View>
              <Text style={styles.stepText}>
                Open <Text style={styles.boldText}>Elio Extension</Text> on your
                PC browser
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepIconBox}>
                <Ionicons name="qr-code-outline" size={14} color="#D4D4D8" />
              </View>
              <Text style={styles.stepText}>
                Point camera at the QR code on screen
              </Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepIconBox}>
                <Ionicons name="flash-outline" size={14} color="#D4D4D8" />
              </View>
              <Text style={styles.stepText}>
                Auto-syncs clips & AI takeaways in real-time
              </Text>
            </View>
          </View>

          {/* Actions: High-contrast Apple White Pill & Minimal Ghost Cancel */}
          <View style={styles.actionsContainer}>
            {/* Primary Action: White Pill Scan Button */}
            <Animated.View
              style={{
                width: "100%",
                transform: [{ scale: scanBtnScale }],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.primaryScanBtn}
                onPress={handleScan}
                onPressIn={() =>
                  Animated.spring(scanBtnScale, {
                    toValue: motionTokens.scale.pressed,
                    useNativeDriver: true,
                    speed: 40,
                  }).start()
                }
                onPressOut={() =>
                  Animated.spring(scanBtnScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    speed: 40,
                  }).start()
                }
              >
                <Ionicons name="qr-code-outline" size={17} color="#000000" />
                <Text style={styles.primaryScanBtnText}>Scan QR Code</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Secondary Action: Sleek Ghost Skip Button */}
            <Animated.View
              style={{
                width: "100%",
                transform: [{ scale: skipBtnScale }],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.65}
                style={styles.skipBtn}
                onPress={handleSkip}
                onPressIn={() =>
                  Animated.spring(skipBtnScale, {
                    toValue: motionTokens.scale.pressed,
                    useNativeDriver: true,
                    speed: 40,
                  }).start()
                }
                onPressOut={() =>
                  Animated.spring(skipBtnScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    speed: 40,
                  }).start()
                }
              >
                <Text style={styles.skipBtnText}>Skip for Now</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Helper Footnote */}
          <Text style={styles.footnote}>
            You can always connect later from the Devices tab.
          </Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: "#0E0E11",
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.7,
        shadowRadius: 30,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  specularBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    pointerEvents: "none",
  },
  heroIconWrapper: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#16171B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  qrBadgeMini: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#27272A",
    borderRadius: 7,
    padding: 3,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
    gap: 5,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A1A1AA",
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    lineHeight: 18.5,
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  stepsContainer: {
    width: "100%",
    backgroundColor: "#141519",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 18,
    gap: 9,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "#1F2025",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  stepText: {
    fontSize: 12.5,
    color: "#D4D4D8",
    flex: 1,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionsContainer: {
    width: "100%",
    gap: 6,
  },
  primaryScanBtn: {
    width: "100%",
    borderRadius: appleRadii.pill,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    gap: 7,
    ...Platform.select({
      ios: {
        shadowColor: "#FFFFFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  primaryScanBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: -0.2,
  },
  skipBtn: {
    width: "100%",
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#71767B",
  },
  footnote: {
    fontSize: 10.5,
    color: "#52525B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 14,
  },
});
