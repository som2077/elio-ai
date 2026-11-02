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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "../services/supabase";

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
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedToken, setScannedToken] = useState<string | null>(null);
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
      let token = data;
      // If it's a URL (Universal Smart Link e.g. https://...?session=xyz or token=xyz)
      if (data.includes("http://") || data.includes("https://")) {
        const url = new URL(data);
        token =
          url.searchParams.get("session") ||
          url.searchParams.get("token") ||
          data;
      } else if (data.startsWith("{")) {
        const parsed = JSON.parse(data);
        token = parsed.session || parsed.token || data;
      } else if (data.startsWith("elio-auth:")) {
        token = data.replace("elio-auth:", "");
      }

      setScannedToken(token);
    } catch {
      setScannedToken(data);
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
          "Active mobile session not found. Please log in first.",
        );
      }

      // Update Supabase qr_auth_sessions table
      const { error: updateError } = await supabase
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
        .eq("qr_token", scannedToken);

      if (updateError) throw updateError;

      setStatusMessage({ text: "✦ Extension linked successfully!" });
      setTimeout(() => {
        setScannedToken(null);
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
        {/* Permission Request View */}
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionDesc}>
              Elio AI uses your camera to scan the QR code on your Chrome/Brave
              browser extension to link your account.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>Allow Camera Access</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Active Camera Scanner View */
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={scannedToken ? undefined : handleBarcodeScanned}
            />

            {/* Top Bar Header */}
            <View style={styles.topHeader}>
              <TouchableOpacity style={styles.closeBtn} onPress={handleCancel}>
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Link Browser Extension</Text>
              <View style={{ width: 60 }} />
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
              <Text style={styles.reticleInstruction}>
                Point camera at the QR code displayed in your PC browser
                extension
              </Text>
            </View>

            {/* Approval Dialog Overlay when QR detected */}
            {scannedToken && (
              <View style={styles.approvalSheet}>
                <View style={styles.approvalBadge}>
                  <Text style={styles.approvalIcon}>💻</Text>
                </View>
                <Text style={styles.approvalTitle}>
                  Authorize Browser Extension?
                </Text>
                <Text style={styles.approvalDesc}>
                  Your saved videos from Chrome/Brave will automatically sync to
                  your Elio AI mobile inbox.
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
                  >
                    <Text style={styles.cancelBtnText}>Rescan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={handleApproveLink}
                    disabled={approving}
                  >
                    {approving ? (
                      <ActivityIndicator color="#FFFFFF" />
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
    backgroundColor: "#0A0F1D",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 10,
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  permissionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  cancelLink: {
    marginTop: 18,
    padding: 10,
  },
  cancelLinkText: {
    color: "#64748B",
    fontSize: 14,
  },
  cameraWrapper: {
    flex: 1,
    position: "relative",
  },
  topHeader: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  closeBtn: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  closeBtnText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
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
    backgroundColor: "rgba(10, 15, 29, 0.15)",
    borderRadius: 20,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#818CF8",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  laserLine: {
    width: "100%",
    height: 3,
    backgroundColor: "#6366F1",
    shadowColor: "#818CF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  reticleInstruction: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    marginTop: 24,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  approvalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#131B2E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 20,
  },
  approvalBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  approvalIcon: {
    fontSize: 24,
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  approvalDesc: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  statusMsg: {
    color: "#34D399",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 14,
  },
  statusMsgError: {
    color: "#EF4444",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 14,
  },
  approveBtn: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  approveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
