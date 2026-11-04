import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Video, ResizeMode } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { motionTokens } from "../utils/motion";

// Safe dynamic helper
const getRedirectUri = () => "elio-ai://auth";

// Supported platforms with authentic high-res official app icons
const SOCIAL_PLATFORMS = [
  {
    name: "Instagram",
    image: require("../assets/social-icons/instagram.png"),
    glowColor: "#E1306C",
  },
  {
    name: "YouTube",
    image: require("../assets/social-icons/youtube.png"),
    glowColor: "#FF0000",
  },
  {
    name: "TikTok",
    image: require("../assets/social-icons/tiktok.png"),
    glowColor: "#00F2FE",
  },
  {
    name: "X",
    image: require("../assets/social-icons/twitter.png"),
    glowColor: "#FFFFFF",
  },
  {
    name: "Reddit",
    image: require("../assets/social-icons/reddit.png"),
    glowColor: "#FF4500",
  },
  {
    name: "LinkedIn",
    image: require("../assets/social-icons/linkedin.png"),
    glowColor: "#0A66C2",
  },
  {
    name: "Pinterest",
    image: require("../assets/social-icons/pinterest.png"),
    glowColor: "#E60023",
  },
];

// Safe dynamic import to prevent native module crashes on older APK builds
let WebBrowser: any = null;
try {
  WebBrowser = require("expo-web-browser");
  WebBrowser?.maybeCompleteAuthSession?.();
} catch {
  WebBrowser = null;
}

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const insets = useSafeAreaInsets();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "info" | "error" | "success";
  } | null>(null);

  // Micro-interaction animated scale
  const googleBtnScale = useRef(new Animated.Value(1)).current;

  // Rotating Social Platform Badge Loop
  const [platformIndex, setPlatformIndex] = useState(0);
  const badgeOpacity = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Smooth exit animation (scale down & fade out)
      Animated.parallel([
        Animated.timing(badgeOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(badgeScale, {
          toValue: 0.72,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 2. Next platform in loop
        setPlatformIndex((prev) => (prev + 1) % SOCIAL_PLATFORMS.length);

        // 3. Smooth entrance with spring pop
        Animated.parallel([
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(badgeScale, {
            toValue: 1,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  const currentPlatform = SOCIAL_PLATFORMS[platformIndex];

  // Auto-listen to auth state changes (e.g. When Google deep link redirects back)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        onAuthSuccess?.();
      }
    });

    // Check if session already exists on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        onAuthSuccess?.();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onAuthSuccess]);

  const animatePressIn = (scaleAnim: Animated.Value) => {
    Animated.spring(scaleAnim, {
      toValue: motionTokens.scale.pressed,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  const animatePressOut = (scaleAnim: Animated.Value) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handleOpenTerms = () => {
    Alert.alert(
      "Terms of Service",
      "By using Elio AI, you agree to save and manage your personal video clips securely and adhere to our terms.",
      [{ text: "OK" }],
    );
  };

  const handleOpenPrivacy = () => {
    Alert.alert(
      "Privacy Policy",
      "We respect your privacy. Your saved video bookmarks, notes, and activity are stored securely in your private vault and never shared.",
      [{ text: "OK" }],
    );
  };

  // 1-Tap Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setMessage(null);
      const redirectUrl = getRedirectUri();

      if (!WebBrowser) {
        throw new Error(
          "WebBrowser module not available in this APK build. Please rebuild the app.",
        );
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );

        if (result.type === "success" && result.url) {
          const urlParams = new URLSearchParams(
            result.url.split("#")[1] || result.url.split("?")[1],
          );
          const accessToken = urlParams.get("access_token");
          const refreshToken = urlParams.get("refresh_token");

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            onAuthSuccess?.();
            return;
          }
        }

        // Check if session was set via callback route
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          onAuthSuccess?.();
        }
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Google Sign-In was cancelled or failed.",
        type: "error",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        style="light"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* TOP TO BOTTOM: 3D Animated Social Ribbons starting from status bar (Threads layout) */}
      <View style={styles.videoHeroSection}>
        <Video
          source={require("../assets/gemini_generated_video_b2132d12.mp4")}
          style={styles.fullVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={true}
          isMuted={true}
          volume={0}
          rate={0.8} // <-- Video speed: 1.0 (normal), 1.2 / 1.5 (fast), 0.8 (slow)
          shouldCorrectPitch={false}
          useNativeControls={false}
        />

        {/* Alert Banner (if any error/message) */}
        {message && (
          <View
            style={[
              styles.alertBanner,
              { marginTop: Math.max(insets.top, 16) + 12 },
              message.type === "error"
                ? styles.alertError
                : styles.alertSuccess,
            ]}
          >
            <Text style={styles.alertText}>{message.text}</Text>
          </View>
        )}
      </View>

      {/* BOTTOM: USP Headline, Luxury Continue with Google Pill, and Terms/Privacy Policy */}
      <View
        style={[
          styles.bottomActionSection,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
      >
        {/* Screenshot Inspired Signature Headline: Save from / every [Social Logo Badge] app / in seconds */}
        <View style={styles.headlineSection}>
          <Text style={styles.uspLineMuted}>Save from</Text>
          <View style={styles.uspLineMiddleRow}>
            <Text style={styles.uspLineBold}>every</Text>
            <Animated.View
              style={[
                styles.platformBadge,
                {
                  opacity: badgeOpacity,
                  transform: [{ scale: badgeScale }],
                  shadowColor: currentPlatform.glowColor,
                },
              ]}
            >
              <Image
                source={currentPlatform.image}
                style={styles.platformIconImage}
                resizeMode="cover"
              />
            </Animated.View>
            <Text style={styles.uspLineBold}>app</Text>
          </View>
          <Text style={styles.uspLineMuted}>in seconds</Text>
        </View>

        <Animated.View
          style={{ width: "100%", transform: [{ scale: googleBtnScale }] }}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.primaryPillBtn}
            onPress={handleGoogleSignIn}
            onPressIn={() => animatePressIn(googleBtnScale)}
            onPressOut={() => animatePressOut(googleBtnScale)}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#000000" size="small" />
                <Text style={styles.loadingText}>Opening Google...</Text>
              </View>
            ) : (
              <View style={styles.pillContentRow}>
                <Ionicons name="logo-google" size={19} color="#000000" />
                <Text style={styles.pillBtnText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Terms of Service & Privacy Policy customized for Elio */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By continuing, you agree to Elio's{"\n"}
            <Text style={styles.termsLink} onPress={handleOpenTerms}>
              Terms of Service
            </Text>
            {" and "}
            <Text style={styles.termsLink} onPress={handleOpenPrivacy}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  alertBanner: {
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  alertError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  alertSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  alertText: {
    color: "#F8FAFC",
    fontSize: 13,
    textAlign: "center",
  },
  videoHeroSection: {
    flex: 1,
    width: "100%",
  },
  fullVideo: {
    width: "100%",
    height: "85%",
  },
  bottomActionSection: {
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
  },
  headlineSection: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 26,
    paddingLeft: 4,
  },
  uspLineMuted: {
    fontSize: 32,
    fontWeight: "500",
    color: "#8E8E93",
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  uspLineMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 1,
  },
  uspLineBold: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  platformBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: "hidden",
    marginHorizontal: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: "#16181C",
  },
  platformIconImage: {
    width: "100%",
    height: "100%",
  },
  primaryPillBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  pillContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  pillBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    letterSpacing: -0.2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
  },
  termsContainer: {
    marginTop: 18,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  termsLink: {
    color: "#8E8E93",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
});
