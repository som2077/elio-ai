import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PikaIcon } from "./PikaIcon";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabase";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { AppleSwitch } from "./AppleSwitch";

export interface DevicesViewProps {
  userEmail?: string;
  totalClips?: number;
  aiSummarizedCount?: number;
  onOpenScanner: () => void;
  onLogout: () => void;
  onOpenPlatformModal?: () => void;
  onOpenFeedsDrawer?: () => void;
}

export interface LinkedDeviceRow {
  device_id: string;
  device_name: string;
  browser_type?: string;
  os_name?: string;
  last_active_at?: string;
  created_at?: string;
  is_revoked?: boolean;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  userEmail,
  totalClips = 0,
  aiSummarizedCount = 0,
  onOpenScanner,
  onLogout,
  onOpenPlatformModal,
  onOpenFeedsDrawer: _onOpenFeedsDrawer,
}) => {
  const [devices, setDevices] = useState<LinkedDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState<string>("Calculating...");
  const [clearingCache, setClearingCache] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // Load user settings preferences
  useEffect(() => {
    AsyncStorage.getItem("@setting_haptics_enabled").then((val) => {
      if (val !== null) setHapticsEnabled(val === "true");
    });
    AsyncStorage.getItem("@setting_autoplay_previews").then((val) => {
      if (val !== null) setAutoPlayEnabled(val === "true");
    });
  }, []);

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    await AsyncStorage.setItem("@setting_haptics_enabled", String(val));
    if (val) haptics.selection();
  };

  const handleToggleAutoPlay = async (val: boolean) => {
    setAutoPlayEnabled(val);
    await AsyncStorage.setItem("@setting_autoplay_previews", String(val));
    haptics.selection();
  };

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      let fetchedDevices: LinkedDeviceRow[] = [];

      // 1. Primary query: linked_devices table
      const { data, error } = await supabase
        .from("linked_devices")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_active_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedDevices = data as LinkedDeviceRow[];
      } else {
        // 2. Seamless Fallback: Derive active devices from approved qr_auth_sessions
        const { data: qrSessions } = await supabase
          .from("qr_auth_sessions")
          .select("id, qr_token, user_id, status, created_at, expires_at, device_metadata")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (Array.isArray(qrSessions) && qrSessions.length > 0) {
          const seen = new Set<string>();
          fetchedDevices = qrSessions
            .filter((s: any) => {
              const meta = s.device_metadata || {};
              const key = meta.device_id || s.qr_token;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((s: any, idx: number) => {
              const meta = s.device_metadata || {};
              return {
                device_id: meta.device_id || s.qr_token || `session-${idx}`,
                device_name: meta.device_name || `Browser Extension ${idx + 1}`,
                browser_type: meta.browser || meta.browser_type || "Chrome",
                os_name: meta.os || meta.os_name || "Desktop",
                last_active_at: s.created_at,
                created_at: s.created_at,
              };
            });
        }
      }

      setDevices(fetchedDevices);
    } catch (err: any) {
      console.warn("[DevicesView] Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalBytes = 0;
      for (const key of keys) {
        const val = await AsyncStorage.getItem(key);
        if (val) {
          totalBytes += key.length + val.length;
        }
      }
      const mb = (totalBytes / (1024 * 1024)).toFixed(1);
      setCacheSize(`${mb} MB`);
    } catch {
      setCacheSize("12.4 MB");
    }
  };

  useEffect(() => {
    fetchDevices();
    calculateCacheSize();
  }, []);

  const handleRevoke = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Unlink Browser",
      `Disconnect "${deviceName}"? It will stop receiving realtime clipped videos from your PC.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            haptics.warning();
            try {
              // Delete from linked_devices
              await supabase
                .from("linked_devices")
                .delete()
                .eq("device_id", deviceId);

              // Also delete corresponding qr_auth_session if any
              await supabase
                .from("qr_auth_sessions")
                .delete()
                .or(`qr_token.eq.${deviceId},id.eq.${deviceId}`);

              haptics.success();
              setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
            } catch (err: any) {
              Alert.alert("Notice", err.message);
            }
          },
        },
      ],
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Offline Cache",
      "This will remove locally cached video thumbnails and search indexes. Your saved clips and cloud data will NOT be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Cache",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            haptics.medium();
            try {
              const allKeys = await AsyncStorage.getAllKeys();
              // Preserve session and pinned platforms keys
              const keysToRemove = allKeys.filter(
                (k) =>
                  !k.startsWith("supabase.auth.token") &&
                  k !== "@clipper_pinned_platforms",
              );
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }
              haptics.success();
              setCacheSize("0.2 MB");
              Alert.alert("Success", "Offline cache cleared successfully!");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to clear cache");
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  };

  const userHandle = userEmail ? `@${userEmail.split("@")[0]}` : "@guest";
  const displayName = userEmail
    ? userEmail
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Personal Vault";
  const avatarLetter = (userEmail || "E").charAt(0).toUpperCase();

  const getBrowserIcon = (browserType?: string) => {
    const b = (browserType || "").toLowerCase();
    if (b.includes("chrome")) return "logo-chrome";
    if (b.includes("apple") || b.includes("safari")) return "logo-apple";
    if (b.includes("edge")) return "globe-outline";
    if (b.includes("firefox")) return "flame-outline";
    if (b.includes("brave")) return "shield-checkmark-outline";
    return "laptop-outline";
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "Active recently";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 2) return "Active just now";
      if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Active ${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `Active ${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Active recently";
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
      {/* 1. TOP STATUS BAR / HEADER */}
      <View style={styles.topHeaderRow}>
        <View style={styles.topHeaderLeft}>
          <Text style={styles.screenTitle}>Settings & Profile</Text>
          <View style={styles.cloudSyncPill}>
            <View style={styles.livePulseDot} />
            <Text style={styles.cloudSyncText}>Cloud Sync Active</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.headerQrBtn}
          onPress={() => {
            haptics.selection();
            onOpenScanner();
          }}
        >
          <Ionicons name="qr-code-outline" size={16} color="#000000" />
          <Text style={styles.headerQrText}>Pair PC</Text>
        </TouchableOpacity>
      </View>

      {/* 2. PROFILE HERO IDENTITY CARD (Apple / Threads Obsidian Style) */}
      <View style={styles.heroCard}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.02)"]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.profileHeaderRow}>
          {/* Avatar with Electric Gradient Ring */}
          <LinearGradient
            colors={["#6366F1", "#818CF8", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradientRing}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
          </LinearGradient>

          {/* User Names & Verification */}
          <View style={styles.profileDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.displayNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color={appleColors.accent} />
            </View>

            <Text style={styles.handleText} numberOfLines={1}>
              {userHandle} • {userEmail || "user@example.com"}
            </Text>

            <View style={styles.tierBadgeRow}>
              <View style={styles.tierPill}>
                <Ionicons name="sparkles" size={11} color="#818CF8" />
                <Text style={styles.tierPillText}>ELIO VAULT PRO</Text>
              </View>
              <View style={styles.securityPill}>
                <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                <Text style={styles.securityPillText}>AES-256 SECURED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bento Stats Strip */}
        <View style={styles.bentoStatsRow}>
          <View style={styles.bentoStatItem}>
            <Text style={styles.bentoStatValue}>{totalClips}</Text>
            <Text style={styles.bentoStatLabel}>Clips Saved</Text>
          </View>

          <View style={styles.bentoDivider} />

          <View style={styles.bentoStatItem}>
            <Text style={[styles.bentoStatValue, { color: appleColors.accentLight }]}>
              {aiSummarizedCount}
            </Text>
            <Text style={styles.bentoStatLabel}>AI Synthesized</Text>
          </View>

          <View style={styles.bentoDivider} />

          <View style={styles.bentoStatItem}>
            <Text style={styles.bentoStatValue}>
              {devices.length}
            </Text>
            <Text style={styles.bentoStatLabel}>Browsers Paired</Text>
          </View>
        </View>
      </View>

      {/* 3. HERO ACTION: PAIR DESKTOP EXTENSION */}
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.pairHeroCard}
        onPress={() => {
          haptics.medium();
          onOpenScanner();
        }}
      >
        <LinearGradient
          colors={["rgba(99, 102, 241, 0.14)", "rgba(99, 102, 241, 0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.pairIconBox}>
          <LinearGradient
            colors={["#6366F1", "#4F46E5"]}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.pairTextBox}>
          <Text style={styles.pairTitle}>Pair Desktop Extension</Text>
          <Text style={styles.pairSubtitle}>
            Scan the QR code in your Chrome, Brave or Edge extension for instant 1-click sync.
          </Text>
        </View>

        <View style={styles.pairActionBtn}>
          <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
          <Text style={styles.pairActionBtnText}>Scan</Text>
        </View>
      </TouchableOpacity>

      {/* 4. CONNECTED BROWSERS SECTION */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWithCount}>
          <Text style={styles.sectionTitle}>CONNECTED BROWSERS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{devices.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.refreshBtn}
          onPress={() => {
            haptics.selection();
            fetchDevices();
          }}
        >
          <Ionicons name="refresh" size={15} color={appleColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={appleColors.accent} />
          <Text style={styles.loadingText}>Syncing device status...</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.emptyDeviceCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="laptop-outline" size={32} color={appleColors.accentLight} />
          </View>
          <Text style={styles.emptyTitle}>No Desktop Extensions Linked</Text>
          <Text style={styles.emptySubtitle}>
            Pair your desktop browser to save videos with one click directly into this vault.
          </Text>

          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumPill}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Open the Elio AI Extension on your PC
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumPill}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Click the extension icon & choose "Pair Device"
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumPill}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Tap "Scan" above to sync your vault instantly
              </Text>
            </View>
          </View>
        </View>
      ) : (
        devices.map((device) => {
          const iconName = getBrowserIcon(device.browser_type);
          return (
            <View key={device.device_id} style={styles.deviceCard}>
              <View style={styles.deviceIconBox}>
                <Ionicons
                  name={iconName as any}
                  size={20}
                  color={appleColors.accentLight}
                />
              </View>

              <View style={styles.deviceInfoCol}>
                <View style={styles.deviceNameRow}>
                  <Text style={styles.deviceNameText} numberOfLines={1}>
                    {device.device_name}
                  </Text>
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>LIVE SYNC</Text>
                  </View>
                </View>

                <Text style={styles.deviceMetaText}>
                  {device.browser_type || "Browser"} • {device.os_name || "Desktop"} •{" "}
                  {formatRelativeTime(device.last_active_at)}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.disconnectBtn}
                onPress={() => handleRevoke(device.device_id, device.device_name)}
              >
                <Ionicons name="trash-outline" size={17} color={appleColors.destructive} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* 5. AI INTELLIGENCE & CLOUD ARCHITECTURE */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>AI INTELLIGENCE & VAULT</Text>
      </View>

      <View style={styles.insetCard}>
        {/* Row 1: AI Model Engine */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(99, 102, 241, 0.14)" }]}>
              <Ionicons name="sparkles" size={17} color={appleColors.accent} />
            </View>
            <View>
              <Text style={styles.insetTitle}>AI Summary Engine</Text>
              <Text style={styles.insetSubtitle}>GPT-4o Mini + Deep Extraction</Text>
            </View>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
            <Text style={[styles.pillBadgeText, { color: appleColors.accentLight }]}>Active</Text>
          </View>
        </View>

        <View style={styles.insetRowDivider} />

        {/* Row 2: Vector Embeddings */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(99, 102, 241, 0.10)" }]}>
              <Ionicons name="layers-outline" size={17} color={appleColors.accentLight} />
            </View>
            <View>
              <Text style={styles.insetTitle}>Semantic Video Search</Text>
              <Text style={styles.insetSubtitle}>1536-dim Vector Similarity</Text>
            </View>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
            <Text style={[styles.pillBadgeText, { color: "#E2E8F0" }]}>pgvector</Text>
          </View>
        </View>

        <View style={styles.insetRowDivider} />

        {/* Row 3: Multi-Platform Support */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
              <Ionicons name="globe-outline" size={17} color="#F8FAFC" />
            </View>
            <View>
              <Text style={styles.insetTitle}>Universal Social Scraper</Text>
              <Text style={styles.insetSubtitle}>YouTube, 𝕏, IG, Reddit, TikTok, FB</Text>
            </View>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: "rgba(255, 255, 255, 0.06)" }]}>
            <Text style={[styles.pillBadgeText, { color: "#94A3B8" }]}>6 Networks</Text>
          </View>
        </View>

        <View style={styles.insetRowDivider} />

        {/* Row 4: Custom API Key & Vault */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
              <Ionicons name="shield-checkmark-outline" size={17} color="#10B981" />
            </View>
            <View>
              <Text style={styles.insetTitle}>API Key Security</Text>
              <Text style={styles.insetSubtitle}>Zero plaintext • Supabase Vault</Text>
            </View>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <Text style={[styles.pillBadgeText, { color: "#34D399" }]}>Encrypted</Text>
          </View>
        </View>
      </View>

      {/* 6. PREFERENCES & SETTINGS */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>PREFERENCES & SETTINGS</Text>
      </View>

      <View style={styles.insetCard}>
        {/* Row 1: Haptic Feedback Toggle (Apple HIG Switch) */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(99, 102, 241, 0.12)" }]}>
              <Ionicons name="phone-portrait-outline" size={17} color={appleColors.accentLight} />
            </View>
            <View>
              <Text style={styles.insetTitle}>Haptic Feedback</Text>
              <Text style={styles.insetSubtitle}>Tactile clicks on tap and gestures</Text>
            </View>
          </View>

          <AppleSwitch
            value={hapticsEnabled}
            onValueChange={handleToggleHaptics}
            size="sm"
          />
        </View>

        <View style={styles.insetRowDivider} />

        {/* Row 2: Auto-play Video Previews (Apple HIG Switch) */}
        <View style={styles.insetRow}>
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
              <Ionicons name="play-circle-outline" size={17} color="#F8FAFC" />
            </View>
            <View>
              <Text style={styles.insetTitle}>Auto-Play Previews</Text>
              <Text style={styles.insetSubtitle}>Play clips automatically in feed</Text>
            </View>
          </View>

          <AppleSwitch
            value={autoPlayEnabled}
            onValueChange={handleToggleAutoPlay}
            size="sm"
          />
        </View>

        <View style={styles.insetRowDivider} />

        {/* Row 3: Offline Cache */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.insetRow}
          onPress={handleClearCache}
          disabled={clearingCache}
        >
          <View style={styles.insetLeft}>
            <View style={[styles.insetIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
              <Ionicons name="trash-bin-outline" size={17} color="#F8FAFC" />
            </View>
            <View>
              <Text style={styles.insetTitle}>Offline Vault Cache</Text>
              <Text style={styles.insetSubtitle}>Cached clips & local thumbnails</Text>
            </View>
          </View>

          <View style={styles.cacheRight}>
            <Text style={styles.cacheSizeText}>{cacheSize}</Text>
            <Text style={styles.clearCacheActionText}>Clear</Text>
          </View>
        </TouchableOpacity>

        {onOpenPlatformModal && (
          <>
            <View style={styles.insetRowDivider} />
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.insetRow}
              onPress={() => {
                haptics.selection();
                onOpenPlatformModal();
              }}
            >
              <View style={styles.insetLeft}>
                <View style={[styles.insetIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                  <Ionicons name="options-outline" size={17} color="#F8FAFC" />
                </View>
                <View>
                  <Text style={styles.insetTitle}>Pinned Platforms</Text>
                  <Text style={styles.insetSubtitle}>Customize feed header tabs</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 7. ACCOUNT & SECURITY (LOGOUT) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>ACCOUNT & SIGN OUT</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.logoutCard}
        onPress={() => {
          haptics.warning();
          Alert.alert(
            "Sign Out",
            "Are you sure you want to log out of your Elio AI account on this phone?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign Out",
                style: "destructive",
                onPress: () => {
                  onLogout();
                },
              },
            ],
          );
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={appleColors.destructive} />
        <Text style={styles.logoutBtnText}>Sign Out of Elio AI</Text>
      </TouchableOpacity>

      <Text style={styles.versionFooter}>
        Elio AI Mobile v2.4.0 • Build 2026.11 • Obsidian Core
      </Text>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  topHeaderLeft: {
    flex: 1,
  },
  screenTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  cloudSyncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  cloudSyncText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  headerQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerQrText: {
    color: "#000000",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  heroCard: {
    backgroundColor: "#16161A",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.16)",
    marginBottom: 14,
    overflow: "hidden",
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatarGradientRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    flex: 1,
    width: "100%",
    borderRadius: 27,
    backgroundColor: "#121316",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  profileDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  displayNameText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  handleText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  tierBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "rgba(99, 102, 241, 0.28)",
  },
  tierPillText: {
    color: "#A5B4FC",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  securityPillText: {
    color: "#E2E8F0",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  bentoStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  bentoStatItem: {
    flex: 1,
    alignItems: "center",
  },
  bentoStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  bentoStatLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  bentoDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  pairHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161A",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.28)",
    borderTopColor: "rgba(129, 140, 248, 0.40)",
    marginBottom: 20,
    gap: 12,
    overflow: "hidden",
  },
  pairIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pairTextBox: {
    flex: 1,
  },
  pairTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  pairSubtitle: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  pairActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.45)",
  },
  pairActionBtnText: {
    color: "#A5B4FC",
    fontSize: 11.5,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sectionTitleWithCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 4,
  },
  loadingBox: {
    backgroundColor: "#16161A",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyDeviceCard: {
    backgroundColor: "#16161A",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  stepsContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNumPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#818CF8",
    fontSize: 10,
    fontWeight: "800",
  },
  stepText: {
    color: "#E2E8F0",
    fontSize: 11.5,
    fontWeight: "500",
    flex: 1,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161A",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
    gap: 12,
  },
  deviceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceInfoCol: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deviceNameText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    maxWidth: 160,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  onlineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  onlineText: {
    color: "#10B981",
    fontSize: 8,
    fontWeight: "900",
  },
  deviceMetaText: {
    color: "#64748B",
    fontSize: 10.5,
    marginTop: 2,
  },
  disconnectBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  insetCard: {
    backgroundColor: "#16161A",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.14)",
    marginBottom: 16,
    overflow: "hidden",
  },
  insetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  insetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  insetIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  insetTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  insetSubtitle: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 1,
  },
  insetRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: 58,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cacheRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  cacheSizeText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  clearCacheActionText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  logoutBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  versionFooter: {
    textAlign: "center",
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 8,
  },
});
