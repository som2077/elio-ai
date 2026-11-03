import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  BackHandler,
  Platform,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { processSharedContent } from "../services/shareHandler";
import { haptics } from "../utils/haptics";

export default function FastSharePillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ text?: string }>();

  const [status, setStatus] = useState<"saving" | "success" | "duplicate" | "error">("saving");
  const [platformName, setPlatformName] = useState<string>("App");

  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const hasExecutedRef = useRef(false);

  const formatPlatform = (raw: string): string => {
    const l = raw.toLowerCase();
    if (l.includes("youtube")) return "YouTube";
    if (l.includes("instagram")) return "Instagram";
    if (l.includes("twitter") || l === "x") return "X";
    if (l.includes("tiktok")) return "TikTok";
    if (l.includes("reddit")) return "Reddit";
    return "Clip";
  };

  const instantExit = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (Platform.OS === "android") {
        BackHandler.exitApp();
      } else {
        router.replace("/");
      }
    });
  };

  useEffect(() => {
    // 1. Spring-in animation for Dynamic Island Pill
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();

    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    async function handleFastSave() {
      let rawText = "";

      if (typeof params.text === "string" && params.text.trim()) {
        rawText = params.text.trim();
      }

      if (!rawText) {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && initialUrl.includes("text=")) {
            const split = initialUrl.split("text=")[1];
            if (split) {
              rawText = decodeURIComponent(split.split("&")[0]);
            }
          }
        } catch {}
      }

      if (!rawText) {
        setStatus("error");
        setTimeout(instantExit, 600);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const result = await processSharedContent(rawText, session?.user?.id);

        if (result.success) {
          const appLabel = formatPlatform(result.platform || "App");
          setPlatformName(appLabel);

          if (result.isDuplicate) {
            haptics.warning();
            setStatus("duplicate");
          } else {
            haptics.success();
            setStatus("success");
          }

          // Ultra-quick exit: 400ms after completion
          setTimeout(instantExit, 450);
        } else {
          setStatus("error");
          setTimeout(instantExit, 600);
        }
      } catch {
        setStatus("error");
        setTimeout(instantExit, 600);
      }
    }

    handleFastSave();
  }, [params.text]);

  return (
    <View style={styles.overlay}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Tapping anywhere dismisses immediately */}
      <TouchableOpacity
        style={styles.touchBackdrop}
        activeOpacity={1}
        onPress={instantExit}
      >
        <Animated.View
          style={[
            styles.pill,
            {
              transform: [{ translateY }, { scale }],
              opacity,
            },
          ]}
        >
          {status === "saving" && (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
              <Text style={styles.pillText}>Saving clip...</Text>
            </>
          )}

          {status === "success" && (
            <>
              <View style={[styles.circleDot, { backgroundColor: "#30D158" }]}>
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              </View>
              <Text style={styles.pillText}>Saved from {platformName} ⚡</Text>
            </>
          )}

          {status === "duplicate" && (
            <>
              <View style={[styles.circleDot, { backgroundColor: "#FF9F0A" }]}>
                <Ionicons name="bookmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.pillText}>Already saved 📌</Text>
            </>
          )}

          {status === "error" && (
            <>
              <View style={[styles.circleDot, { backgroundColor: "#FF453A" }]}>
                <Ionicons name="alert" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.pillText}>Could not save</Text>
            </>
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  touchBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "android" ? 44 : 54,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 20, 0.94)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 16,
    gap: 8,
  },
  icon: {
    marginRight: 2,
  },
  circleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
