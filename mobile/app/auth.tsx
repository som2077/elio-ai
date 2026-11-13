import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    let isMounted = true;

    const processAuth = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const urlToParse = initialUrl || "";

        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Check search params first
        if (params.access_token && params.refresh_token) {
          accessToken = params.access_token as string;
          refreshToken = params.refresh_token as string;
        } else if (urlToParse.includes("#") || urlToParse.includes("?")) {
          const hashOrQuery =
            urlToParse.split("#")[1] || urlToParse.split("?")[1] || "";
          const searchParams = new URLSearchParams(hashOrQuery);
          accessToken = searchParams.get("access_token");
          refreshToken = searchParams.get("refresh_token");

          const code = searchParams.get("code");
          if (code && (!accessToken || !refreshToken)) {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            if (data?.session && isMounted) {
              router.replace("/");
              return;
            }
          }
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        // Check if session is active
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && isMounted) {
          router.replace("/");
          return;
        }

        // Small delay fallback
        setTimeout(async () => {
          if (isMounted) {
            router.replace("/");
          }
        }, 800);
      } catch (err: any) {
        logger.error("Auth callback notice:", err?.message || "Sign-in interrupted");
        if (isMounted) {
          router.replace("/");
        }
      }
    };

    processAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.title}>Welcome to Elio AI</Text>
      <Text style={styles.subtitle}>Completing secure sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f19",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
  },
});
