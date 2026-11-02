import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { supabase } from "../services/supabase";
import { motionTokens } from "../utils/motion";

// Safe dynamic helper
const getRedirectUri = () => "elio-ai://auth";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "info" | "error" | "success";
  } | null>(null);

  // Micro-interaction animated scale
  const googleBtnScale = useRef(new Animated.Value(1)).current;

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

  // 1-Tap Google Sign-In (Auto Signup for new users / Signin for existing)
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setMessage(null);
      const redirectUrl = getRedirectUri();

      if (!WebBrowser) {
        throw new Error(
          "WebBrowser module not available in this APK build. Please rebuild the app."
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
          redirectUrl
        );

        if (result.type === "success" && result.url) {
          const urlParams = new URLSearchParams(
            result.url.split("#")[1] || result.url.split("?")[1]
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
      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <Text style={styles.appName}>Elio AI</Text>
          <Text style={styles.tagline}>
            AI Watchlist & Intelligent Video Recall
          </Text>
        </View>

        {/* Message Alert Banner */}
        {message && (
          <View
            style={[
              styles.alertBanner,
              message.type === "error" && styles.alertError,
              message.type === "success" && styles.alertSuccess,
            ]}
          >
            <Text style={styles.alertText}>{message.text}</Text>
          </View>
        )}

        {/* Card Container */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to Elio AI</Text>
          <Text style={styles.cardSubtitle}>
            1-Tap instant access. Your saved social clips and AI summaries sync
            seamlessly across devices.
          </Text>

          {/* 1-Tap Hero Google Button */}
          <Animated.View style={{ transform: [{ scale: googleBtnScale }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              onPressIn={() => animatePressIn(googleBtnScale)}
              onPressOut={() => animatePressOut(googleBtnScale)}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#0F172A" />
                  <Text style={styles.loadingText}>Opening Google...</Text>
                </View>
              ) : (
                <View style={styles.googleBtnContent}>
                  <View style={styles.googleIconBadge}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Security footnote */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              🔒 Protected with Supabase Row-Level Security
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080C14",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  logoIcon: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },
  alertBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
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
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
  },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  googleBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  googleIcon: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  footerNote: {
    marginTop: 20,
    alignItems: "center",
  },
  footerNoteText: {
    fontSize: 12,
    color: "#64748B",
  },
});
