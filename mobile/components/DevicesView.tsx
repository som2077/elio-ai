import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { supabase } from "../services/supabase";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface DevicesViewProps {
  userEmail?: string;
  onOpenScanner: () => void;
  onLogout: () => void;
}

interface LinkedDeviceRow {
  device_id: string;
  device_name: string;
  browser_type?: string;
  os_name?: string;
  last_active_at?: string;
  is_revoked?: boolean;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  userEmail,
  onOpenScanner,
  onLogout,
}) => {
  const [devices, setDevices] = useState<LinkedDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("linked_devices")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_active_at", { ascending: false });

      if (error) {
        console.warn("[DevicesView] Notice:", error.message);
      } else if (data) {
        setDevices(data as LinkedDeviceRow[]);
      }
    } catch (err: any) {
      console.warn("[DevicesView] Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevoke = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Unlink Device",
      `Are you sure you want to disconnect "${deviceName}"? It will stop syncing clips automatically.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            haptics.warning();
            try {
              const { error } = await supabase
                .from("linked_devices")
                .delete()
                .eq("device_id", deviceId);

              if (error) {
                Alert.alert("Error", error.message);
              } else {
                haptics.success();
                setDevices((prev) =>
                  prev.filter((d) => d.device_id !== deviceId),
                );
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.headerTitle}>Profile & Sync</Text>
            <Text style={styles.headerSubtitle}>
              Manage paired desktop extensions and realtime sync connections.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.scanHeaderBtn}
            onPress={() => {
              haptics.selection();
              onOpenScanner();
            }}
          >
            <PikaIcon name="qr-code-outline" size={17} color="#000000" />
            <Text style={styles.scanHeaderBtnText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Info Card */}
      <View style={styles.accountCard}>
        <View style={styles.accountLeft}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "E"}
            </Text>
          </View>
          <View>
            <Text style={styles.accountLabel}>Signed In Account</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {userEmail || "user@example.com"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.logoutBtn}
          onPress={() => {
            haptics.warning();
            onLogout();
          }}
        >
          <PikaIcon name="log-out-outline" size={15} color="#FF453A" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Link PC Action Card */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.heroLinkCard}
        onPress={() => {
          haptics.light();
          onOpenScanner();
        }}
      >
        <View style={styles.heroIconBox}>
          <PikaIcon name="qr-code-outline" size={24} color="#070A11" />
        </View>
        <View style={styles.heroTextBox}>
          <Text style={styles.heroTitle}>Link New Computer</Text>
          <Text style={styles.heroSubtitle}>
            Scan the QR code in your desktop Chrome, Brave, or Edge extension to
            pair instantly.
          </Text>
        </View>
        <PikaIcon
          name="chevron-forward"
          size={18}
          color={appleColors.accentLight}
        />
      </TouchableOpacity>

      {/* Connected Devices Section */}
      <View style={styles.devicesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Connected Browsers</Text>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              fetchDevices();
            }}
          >
            <PikaIcon
              name="refresh"
              size={16}
              color={appleColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={appleColors.accentLight}
            style={{ marginVertical: 20 }}
          />
        ) : devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <PikaIcon
              name="laptop-outline"
              size={32}
              color={appleColors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No browsers linked yet</Text>
            <Text style={styles.emptySubtitle}>
              Install the Elio AI Chrome Extension on your PC, click its icon,
              and scan the QR code above.
            </Text>
          </View>
        ) : (
          devices.map((device) => (
            <View key={device.device_id} style={styles.deviceCard}>
              <View style={styles.deviceIcon}>
                <PikaIcon
                  name="desktop-outline"
                  size={20}
                  color={appleColors.accentLight}
                />
              </View>

              <View style={styles.deviceDetails}>
                <View style={styles.deviceNameRow}>
                  <Text style={styles.deviceName}>{device.device_name}</Text>
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>LIVE SYNC</Text>
                  </View>
                </View>
                <Text style={styles.deviceMeta}>
                  {device.browser_type || "Browser"} •{" "}
                  {device.os_name || "Desktop"}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.revokeBtn}
                onPress={() =>
                  handleRevoke(device.device_id, device.device_name)
                }
              >
                <PikaIcon name="trash-outline" size={16} color="#FF453A" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appleColors.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scanHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  scanHeaderBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: appleColors.textSecondary,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 4,
    lineHeight: 16,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D111E",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 14,
  },
  accountLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: appleColors.accentLight,
    fontSize: 14,
    fontWeight: "800",
  },
  accountLabel: {
    color: appleColors.textTertiary,
    fontSize: 9.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountEmail: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    maxWidth: 160,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 69, 58, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "rgba(255, 69, 58, 0.25)",
    gap: 5,
  },
  logoutText: {
    color: "#FF453A",
    fontSize: 11,
    fontWeight: "700",
  },
  heroLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 229, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
    marginBottom: 20,
    gap: 12,
  },
  heroIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: appleColors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBox: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    color: appleColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  devicesSection: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyCard: {
    backgroundColor: "#0D111E",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 6,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  emptySubtitle: {
    color: appleColors.textTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D111E",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
    gap: 12,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceDetails: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(48, 209, 88, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  onlineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#30D158",
  },
  onlineText: {
    color: "#30D158",
    fontSize: 8,
    fontWeight: "900",
  },
  deviceMeta: {
    color: appleColors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  revokeBtn: {
    padding: 6,
  },
});
