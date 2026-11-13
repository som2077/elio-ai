import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../services/supabase";
import { haptics } from "../utils/haptics";
import { logger } from "../utils/logger";

let ExpoCameraModule: any = null;
try {
  ExpoCameraModule = require("expo-camera");
} catch {
  ExpoCameraModule = null;
}

const { width } = Dimensions.get("window");
const SCAN_SIZE = width * 0.72;

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  let permission: any = null;
  let requestPermission = async () => {};

  try {
    if (ExpoCameraModule?.useCameraPermissions) {
      const [perm, reqPerm] = ExpoCameraModule.useCameraPermissions();
      permission = perm;
      requestPermission = reqPerm;
    }
  } catch {
    permission = null;
  }

  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [scannedDevice, setScannedDevice] = useState<{
    device_id?: string;
    device_name?: string;
    browser_type?: string;
    os_name?: string;
  } | null>(null);
  const [approving, setApproving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Animated laser scan line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && !scannedToken) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: SCAN_SIZE - 4,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [visible, scannedToken]);

  // Handle scanned barcode data
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedToken || approving) return;

    try {
      const raw = (data || "").trim();

      // Check if user accidentally scanned Metro / Expo terminal QR code
      if (
        raw.includes("expo-development-client") ||
        raw.includes("exp://") ||
        raw.includes("192.168.") ||
        raw.includes(":8081")
      ) {
        setStatusMessage({
          text: "⚠️ Yeh Metro terminal ka QR code hai! Kripya Chrome browser me Elio AI extension ka popup khol kar uska QR code scan karein.",
          isError: true,
        });
        return;
      }

      let token = raw;

      // Extract 36-char standard UUID
      const uuidMatch = raw.match(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
      );
      const tokenMatch = raw.match(/[?&]token=([a-zA-Z0-9-]+)/);
      const sessionMatch = raw.match(/[?&]session=([a-zA-Z0-9-]+)/);

      if (uuidMatch && uuidMatch[0]) {
        token = uuidMatch[0];
      } else if (tokenMatch && tokenMatch[1]) {
        token = tokenMatch[1];
      } else if (sessionMatch && sessionMatch[1]) {
        token = sessionMatch[1];
      } else if (raw.startsWith("elio-auth:")) {
        token = raw.replace("elio-auth:", "").trim();
      } else {
        setStatusMessage({
          text: "⚠️ Invalid QR Code. Kripya Chrome browser me Elio AI extension popup ka QR code scan karein.",
          isError: true,
        });
        return;
      }

      setStatusMessage(null);
      haptics.success();
      setScannedToken(token);

      // Pre-fetch device metadata from the pending QR session
      (async () => {
        try {
          const { data } = await supabase
            .from("qr_auth_sessions")
            .select("*")
            .eq("qr_token", token)
            .maybeSingle();

          if (data?.device_metadata) {
            setScannedDevice(data.device_metadata);
          }
          if (data?.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
            setStatusMessage({
              text: "⚠️ QR session expired. Please click 'Refresh QR Code' on PC.",
              isError: true,
            });
          }
        } catch {
          // Pre-fetch is optional
        }
      })();
    } catch {
      setStatusMessage({
        text: "⚠️ QR Code read error. Please try scanning again.",
        isError: true,
      });
    }
  };

  // Authorize extension in Supabase
  const handleApproveLink = async () => {
    if (!scannedToken) return;

    try {
      setApproving(true);
      setStatusMessage(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(
          "Active mobile session not found. Please log in to your account first."
        );
      }

      // Update Supabase qr_auth_sessions table
      const { data: updateData, error: updateError } = await supabase
        .from("qr_auth_sessions")
        .update({
          status: "approved",
          user_id: session.user.id,
          auth_payload: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user_id: session.user.id,
            email: session.user.email,
          },
        })
        .eq("qr_token", scannedToken)
        .select();

      if (updateError) throw updateError;

      if (!updateData || updateData.length === 0) {
        throw new Error(
          "QR session not found or expired. Please refresh the QR code on your PC."
        );
      }

      // Upsert linked device registry for multi-device management
      const meta = scannedDevice || updateData[0]?.device_metadata;
      if (meta && meta.device_id) {
        try {
          await supabase.from("linked_devices").upsert(
            {
              user_id: session.user.id,
              device_id: meta.device_id,
              device_name: meta.device_name || "Browser Extension",
              browser_type: meta.browser_type || "Chrome",
              os_name: meta.os_name || "Unknown",
              last_active_at: new Date().toISOString(),
              is_revoked: false,
            },
            { onConflict: "user_id,device_id" }
          );
        } catch (linkErr) {
          logger.warn("[Elio AI] Linked devices sync notice:", linkErr);
        }
      }

      setStatusMessage({ text: "✦ Extension linked successfully!" });
      setTimeout(() => {
        setScannedToken(null);
        setScannedDevice(null);
        setApproving(false);
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({
        text: err.message || "Failed to authorize extension.",
        isError: true,
      });
      setApproving(false);
    }
  };

  const handleCancel = () => {
    setScannedToken(null);
    setStatusMessage(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor="#000000" translucent={true} />

        {!ExpoCameraModule?.CameraView ? (
          <View
            style={[
              styles.permissionContainer,
              {
                paddingTop: insets.top + 16,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            <View style={styles.permissionTopNav}>
              <TouchableOpacity
                style={styles.navCloseBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.permissionContent}>
              <View style={styles.permissionIconWrapper}>
                <View style={styles.permissionIconBox}>
                  <Ionicons name="videocam-off-outline" size={30} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.permissionTitle}>Camera Module Not Available</Text>
              <Text style={styles.permissionDesc}>
                This development build needs a native build to link camera modules.
                {"\n\n"}
                To test the camera scanner, please open the project using Expo Go, or rebuild with:
                {"\n"}
                <Text style={styles.codeText}>npx expo run:android</Text>
              </Text>
            </View>

            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.allowBtn}
                onPress={handleCancel}
                activeOpacity={0.88}
              >
                <Text style={styles.allowBtnText}>Back to Watchlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : !permission?.granted ? (
          <View
            style={[
              styles.permissionContainer,
              {
                paddingTop: insets.top + 16,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            {/* Top Close Nav */}
            <View style={styles.permissionTopNav}>
              <TouchableOpacity
                style={styles.navCloseBtn}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Centered Content Card */}
            <View style={styles.permissionContent}>
              <View style={styles.permissionIconWrapper}>
                <View style={styles.permissionIconBox}>
                  <Ionicons name="camera-outline" size={30} color="#FFFFFF" />
                  <View style={styles.permissionMiniBadge}>
                    <Ionicons name="qr-code-outline" size={11} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              <View style={styles.permissionPill}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#A1A1AA" />
                <Text style={styles.permissionPillText}>PERMISSION REQUIRED</Text>
              </View>

              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                Elio AI uses your camera to scan the QR code on your Chrome or Brave
                browser extension to link your account.
              </Text>

              {/* Privacy Trust Callout */}
              <View style={styles.privacyBox}>
                <Ionicons name="lock-closed-outline" size={14} color="#10B981" />
                <Text style={styles.privacyText}>
                  Your camera is only active while scanning and processed securely on-device.
                </Text>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.allowBtn}
                onPress={requestPermission}
                activeOpacity={0.88}
              >
                <Ionicons name="camera" size={18} color="#000000" />
                <Text style={styles.allowBtnText}>Allow Camera Access</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtnGhost}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnGhostText}>Not Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Active Camera Scanner View */
          <View style={styles.cameraWrapper}>
            <StatusBar style="light" backgroundColor="transparent" translucent={true} />
            {React.createElement(ExpoCameraModule.CameraView, {
              style: StyleSheet.absoluteFillObject,
              barcodeScannerSettings: {
                barcodeTypes: ["qr"],
              },
              onBarcodeScanned: scannedToken ? undefined : handleBarcodeScanned,
            })}

            {/* Top Bar Header */}
            <View style={[styles.topHeader, { top: insets.top + 12 }]}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleCancel}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Scan Desktop QR</Text>
              <View style={{ width: 68 }} />
            </View>

            {/* Scan Reticle Frame */}
            <View style={styles.reticleContainer}>
              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated Laser Scanline */}
                {!scannedToken && (
                  <Animated.View
                    style={[
                      styles.laserLine,
                      { transform: [{ translateY: laserAnim }] },
                    ]}
                  />
                )}
              </View>

              <View style={styles.reticleInstructionPill}>
                <Ionicons name="qr-code-outline" size={13} color="#D4D4D8" />
                <Text style={styles.reticleInstruction}>
                  Align QR code from browser extension inside frame
                </Text>
              </View>
            </View>

            {/* Approval Dialog Overlay when QR detected */}
            {scannedToken && (
              <View
                style={[
                  styles.approvalSheet,
                  { paddingBottom: Math.max(insets.bottom, 16) + 16 },
                ]}
              >
                {/* Specular Top Rim */}
                <LinearGradient
                  colors={[
                    "rgba(255, 255, 255, 0.15)",
                    "rgba(255, 255, 255, 0.03)",
                    "transparent",
                  ]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.4 }}
                  style={styles.specularBorder}
                />

                <View style={styles.approvalBadge}>
                  <Ionicons name="laptop-outline" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.approvalTitle}>
                  Authorize Browser Extension?
                </Text>

                {scannedDevice?.device_name ? (
                  <View style={styles.devicePill}>
                    <Ionicons name="laptop-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.devicePillText}>
                      {scannedDevice.device_name}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.approvalDesc}>
                  Your saved videos from Chrome/Brave will automatically sync to
                  your Elio AI mobile library in real time.
                </Text>

                {statusMessage && (
                  <Text
                    style={[
                      styles.statusMsg,
                      statusMessage.isError && styles.statusMsgError,
                    ]}
                  >
                    {statusMessage.text}
                  </Text>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn]}
                    onPress={() => setScannedToken(null)}
                    disabled={approving}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Rescan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={handleApproveLink}
                    disabled={approving}
                    activeOpacity={0.88}
                  >
                    {approving ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.approveBtnText}>
                        Approve & Link ✦
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  permissionTopNav: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  navCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionContent: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  permissionIconWrapper: {
    marginBottom: 16,
  },
  permissionIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#16171B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  permissionMiniBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#27272A",
    borderRadius: 7,
    padding: 3,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  permissionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
    gap: 5,
  },
  permissionPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A1A1AA",
    letterSpacing: 0.7,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  privacyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#141519",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  privacyText: {
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
    lineHeight: 16,
  },
  permissionActions: {
    width: "100%",
    gap: 8,
  },
  allowBtn: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  allowBtnText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  cancelBtnGhost: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnGhostText: {
    color: "#71767B",
    fontSize: 14,
    fontWeight: "500",
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#818CF8",
    fontWeight: "600",
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  topHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  reticleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  reticleBox: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: "relative",
    backgroundColor: "transparent",
    borderRadius: 24,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 18,
  },
  laserLine: {
    width: "100%",
    height: 2.5,
    backgroundColor: "#6366F1",
    shadowColor: "#818CF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  reticleInstructionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0, 0, 0, 0.70)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 26,
  },
  reticleInstruction: {
    color: "#D4D4D8",
    fontSize: 12.5,
    fontWeight: "500",
  },
  approvalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0E0E11",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
      },
      android: {
        elevation: 20,
      },
    }),
    zIndex: 20,
  },
  specularBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    pointerEvents: "none",
  },
  approvalBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#16171B",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  devicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 20,
    marginBottom: 8,
  },
  devicePillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  approvalDesc: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 18.5,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  statusMsg: {
    color: "#10B981",
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 12,
  },
  statusMsgError: {
    color: "#EF4444",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#18191E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: "#D4D4D8",
    fontWeight: "600",
    fontSize: 14,
  },
  approveBtn: {
    backgroundColor: "#FFFFFF",
  },
  approveBtnText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 14,
  },
});
