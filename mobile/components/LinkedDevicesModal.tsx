import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { supabase } from "../services/supabase";
import { LinkedDevice } from "../types/video";

interface LinkedDevicesModalProps {
  visible: boolean;
  onClose: () => void;
  onLinkNewDevice?: () => void;
}

export const LinkedDevicesModal: React.FC<LinkedDevicesModalProps> = ({
  visible,
  onClose,
  onLinkNewDevice,
}) => {
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadDevices();
    }
  }, [visible]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      let fetchedDevices: LinkedDevice[] = [];

      // 1. Try querying primary linked_devices table
      const { data, error } = await supabase
        .from("linked_devices")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_active_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedDevices = data as LinkedDevice[];
      } else {
        // 2. Seamless Fallback: Derive active devices from approved qr_auth_sessions
        const { data: qrSessions } = await supabase
          .from("qr_auth_sessions")
          .select("id, qr_token, user_id, status, created_at, expires_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(15);

        if (Array.isArray(qrSessions) && qrSessions.length > 0) {
          // Deduplicate by qr_token or device_id
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
              const isRevoked = s.status === "expired";
              return {
                id: s.id,
                user_id: s.user_id,
                device_id: meta.device_id || s.qr_token,
                device_name:
                  meta.device_name ||
                  `Browser Extension (${idx === 0 ? "Chrome Primary" : "Profile " + (idx + 1)})`,
                browser_type: meta.browser_type || "Chrome",
                os_name: meta.os_name || "Linux",
                last_active_at: s.created_at,
                is_revoked: isRevoked,
                created_at: s.created_at,
              };
            });
        }
      }

      setDevices(fetchedDevices);
    } catch (err) {
      console.warn("[Elio AI] Linked devices notice:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = (device: LinkedDevice) => {
    Alert.alert(
      "Revoke Device Access?",
      `Are you sure you want to disconnect "${device.device_name}"? This browser extension will be logged out immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              setRevokingId(device.device_id);

              // 1. Mark in linked_devices if table exists
              try {
                await supabase
                  .from("linked_devices")
                  .update({ is_revoked: true })
                  .eq("device_id", device.device_id);
              } catch {}

              // 2. Also expire the QR auth session so extension logs out
              try {
                await supabase
                  .from("qr_auth_sessions")
                  .update({ status: "expired" })
                  .eq("qr_token", device.device_id);
              } catch {}

              setDevices((prev) =>
                prev.map((d) =>
                  d.device_id === device.device_id
                    ? { ...d, is_revoked: true }
                    : d
                )
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to revoke device.");
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const formatLastActive = (dateString: string) => {
    if (!dateString) return "Never";
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return "Active just now";
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  };

  const renderDeviceItem = ({ item }: { item: LinkedDevice }) => {
    const isRevoked = item.is_revoked;

    return (
      <View style={[styles.deviceCard, isRevoked && styles.deviceCardRevoked]}>
        <View style={styles.deviceIconBox}>
          <Text style={styles.deviceIconText}>
            {item.browser_type?.toLowerCase().includes("brave") ? "🦁" : "💻"}
          </Text>
        </View>

        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text
              style={[styles.deviceName, isRevoked && styles.deviceNameRevoked]}
              numberOfLines={1}
            >
              {item.device_name || "Browser Extension"}
            </Text>
            {isRevoked ? (
              <View style={styles.revokedBadge}>
                <Text style={styles.revokedBadgeText}>Revoked</Text>
              </View>
            ) : (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>● Live</Text>
              </View>
            )}
          </View>

          <Text style={styles.deviceMeta}>
            {item.browser_type || "Browser"} • {item.os_name || "Desktop"} •{" "}
            {formatLastActive(item.last_active_at)}
          </Text>
        </View>

        {!isRevoked && (
          <TouchableOpacity
            style={styles.revokeBtn}
            onPress={() => handleRevokeDevice(item)}
            disabled={revokingId === item.device_id}
          >
            {revokingId === item.device_id ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.revokeBtnText}>Revoke</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Connected Browsers</Text>
              <Text style={styles.headerSubtitle}>
                Extensions syncing likes to this mobile inbox
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* List or Loading or Empty */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#6366F1" size="large" />
              <Text style={styles.loadingText}>Checking linked devices...</Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.device_id || item.id}
              renderItem={renderDeviceItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>💻</Text>
                  <Text style={styles.emptyTitle}>No Browsers Linked Yet</Text>
                  <Text style={styles.emptyDesc}>
                    Install the Elio AI extension on Chrome, Brave, or Edge and
                    scan its QR code to sync liked videos across all your
                    devices.
                  </Text>
                </View>
              }
            />
          )}

          {/* Bottom Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.linkNewBtn}
              onPress={() => {
                onClose();
                onLinkNewDevice?.();
              }}
            >
              <Text style={styles.linkNewBtnText}>+ Link New Browser QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0B0F19",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: 400,
    borderTopWidth: 1,
    borderColor: "#1E293B",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#1E293B",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131B2E",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  deviceCardRevoked: {
    opacity: 0.5,
    backgroundColor: "#0F1420",
  },
  deviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deviceIconText: {
    fontSize: 22,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
    maxWidth: 160,
  },
  deviceNameRevoked: {
    textDecorationLine: "line-through",
    color: "#64748B",
  },
  activeBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadgeText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "700",
  },
  revokedBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  revokedBadgeText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "700",
  },
  deviceMeta: {
    fontSize: 11,
    color: "#64748B",
  },
  revokeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  revokeBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#1E293B",
  },
  linkNewBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  linkNewBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
