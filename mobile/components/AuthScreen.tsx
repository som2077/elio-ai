import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "info" | "error" | "success";
  } | null>(null);

  // Micro-interaction animated scale
  const googleBtnScale = useRef(new Animated.Value(1)).current;
  const emailBtnScale = useRef(new Animated.Value(1)).current;

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
        throw new Error("WebBrowser module not available in this APK build. Please use Email / OTP login below or rebuild the app.");
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
          // Parse access token or session if returned in url params
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
          }
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

  // Passwordless Email Magic Link / OTP
  const handleSendMagicLink = async () => {
    if (!email || !email.includes("@")) {
      setMessage({
        text: "Please enter a valid email address.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const redirectUrl = getRedirectUri();

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setOtpSent(true);
      setMessage({
        text: "✦ Magic link & 6-digit code sent to your email! Tap the link or enter the code below.",
        type: "success",
      });
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to send magic link.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify 6-digit OTP code directly in app
  const handleVerifyOtp = async () => {
    if (!otpToken || otpToken.length < 6) {
      setMessage({
        text: "Please enter the 6-digit verification code from your email.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpToken.trim(),
        type: "email",
      });

      if (error) throw error;

      if (data.session) {
        setMessage({ text: "Welcome to Elio AI!", type: "success" });
        onAuthSuccess?.();
      }
    } catch (err: any) {
      setMessage({
        text: err.message || "Invalid or expired code. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text style={styles.cardTitle}>Sign in to your account</Text>
          <Text style={styles.cardSubtitle}>
            Passwordless & instant. New users are registered automatically.
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
                <ActivityIndicator color="#0F172A" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>🌐</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Clean Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#475569"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* If OTP Sent, show 6-digit Code input */}
          {otpSent && (
            <View style={[styles.inputWrapper, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>6-Digit Verification Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="123456"
                placeholderTextColor="#475569"
                value={otpToken}
                onChangeText={setOtpToken}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
            </View>
          )}

          {/* Submit Action Button */}
          <Animated.View
            style={{ transform: [{ scale: emailBtnScale }], marginTop: 16 }}
          >
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.submitBtn}
              onPress={otpSent ? handleVerifyOtp : handleSendMagicLink}
              onPressIn={() => animatePressIn(emailBtnScale)}
              onPressOut={() => animatePressOut(emailBtnScale)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {otpSent
                    ? "Verify Code & Enter ↗"
                    : "✉️ Send Magic Link / Code"}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {otpSent && (
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => {
                setOtpSent(false);
                setOtpToken("");
              }}
            >
              <Text style={styles.resendBtnText}>← Try a different email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            🔒 Protected by Supabase Row-Level Security & AES encryption.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1D",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#1E293B",
    borderWidth: 1.5,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 28,
    color: "#818CF8",
  },
  appName: {
    fontSize: 30,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#131B2E",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1E293B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F1F5F9",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 20,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    fontSize: 18,
  },
  googleBtnText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E293B",
  },
  dividerText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#0A0F1D",
    borderWidth: 1,
    borderColor: "#243048",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F1F5F9",
    fontSize: 14,
  },
  otpInput: {
    letterSpacing: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#818CF8",
    borderColor: "#6366F1",
  },
  submitBtn: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  resendBtn: {
    marginTop: 12,
    alignItems: "center",
  },
  resendBtnText: {
    color: "#818CF8",
    fontSize: 12,
    fontWeight: "600",
  },
  alertBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  alertError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "#DC2626",
  },
  alertSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "#059669",
  },
  alertText: {
    color: "#F1F5F9",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footerNote: {
    marginTop: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#475569",
    fontSize: 11,
    textAlign: "center",
  },
});
