import { NativeModules, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Direct production credentials to guarantee mobile connectivity even without process.env in bundling
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://ooldsqkuxwvznnypumxd.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbGRzcWt1eHd2em5ueXB1bXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODQxMjcsImV4cCI6MjEwNjk2MDEyN30.BTk4_b98cJld5KBftoSvISE3u9qeoid6U7ynWMfArTo";

export const isSupabaseConfigured = true;

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
        NativeModules?.RNC_AsyncSQLiteDBStorage
      );

      if (hasNative) {
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
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
        NativeModules?.RNC_AsyncSQLiteDBStorage
      );

      if (hasNative) {
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
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
        NativeModules?.RNC_AsyncSQLiteDBStorage
      );

      if (hasNative) {
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        await AsyncStorage.removeItem(key);
        return;
      }
      delete memoryStore[key];
    } catch {
      delete memoryStore[key];
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SafeAsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
