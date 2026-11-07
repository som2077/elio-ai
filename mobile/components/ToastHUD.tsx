import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { PikaIcon } from "./PikaIcon";
import { appleColors, appleRadii, appleShadows } from "../theme/appleTokens";

export interface ToastConfig {
  message: string;
  type?: "success" | "info" | "delete" | "link";
}

interface ToastHUDProps {
  toast: ToastConfig | null;
  onDismiss: () => void;
}

export const ToastHUD: React.FC<ToastHUDProps> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      // Enter spring animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 2400ms
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -60,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, 2400);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-60);
      opacity.setValue(0);
    }
  }, [toast]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <PikaIcon name="checkmark-circle" size={17} color="#30D158" />;
      case "delete":
        return <PikaIcon name="trash-outline" size={16} color="#FF453A" />;
      case "link":
        return (
          <PikaIcon
            name="link-outline"
            size={16}
            color={appleColors.accentLight}
          />
        );
      default:
        return (
          <PikaIcon name="sparkles" size={16} color={appleColors.accentLight} />
        );
    }
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.hudPill}>
        <View style={styles.iconContainer}>{getIcon()}</View>
        <Text style={styles.messageText} numberOfLines={1}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 21, 36, 0.96)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    gap: 8,
    ...appleShadows.card,
    maxWidth: "90%",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
