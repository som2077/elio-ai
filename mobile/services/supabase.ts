import { NativeModules, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

// Read exclusively from environment variables injected by Expo at runtime/build-time
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith("https://")
);

if (!isSupabaseConfigured) {
  logger.warn(
    "[Elio AI Security Warning] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Please verify your mobile/.env configuration file."
  );
}

// In-memory fallback to prevent crash if native module is not yet compiled into current binary
const memoryStore: Record<string, string> = {};

/**
 * Universal safe storage adapter:
 * - Uses AsyncStorage when native module is linked in binary or Expo Go
 * - Falls back to localStorage on Web
 * - Falls back to in-memory store if native module is null (preventing Android crashes)
 */
const SafeAsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return memoryStore[key] || null;
      }

      const hasNative = Boolean(
        NativeModules?.RNCAsyncStorage ||
        NativeModules?.RNC_AsyncSQLiteDBStorage,
      );

      if (hasNative) {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        return await AsyncStorage.getItem(key);
      }
      return memoryStore[key] || null;
    } catch {
      return memoryStore[key] || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
        memoryStore[key] = value;
        return;
      }

      const hasNative = Boolean(
        NativeModules?.RNCAsyncStorage ||
        NativeModules?.RNC_AsyncSQLiteDBStorage,
      );

      if (hasNative) {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        await AsyncStorage.setItem(key, value);
        return;
      }
      memoryStore[key] = value;
    } catch {
      memoryStore[key] = value;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
        delete memoryStore[key];
        return;
      }

      const hasNative = Boolean(
        NativeModules?.RNCAsyncStorage ||
        NativeModules?.RNC_AsyncSQLiteDBStorage,
      );

      if (hasNative) {
        const AsyncStorage =
          require("@react-native-async-storage/async-storage").default;
        await AsyncStorage.removeItem(key);
        return;
      }
      delete memoryStore[key];
    } catch {
      delete memoryStore[key];
    }
  },
};

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder-project.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
  auth: {
    storage: SafeAsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
