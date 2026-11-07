import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { threadsTokens, appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { supabase } from "../services/supabase";
import {
  cleanShareUrl,
  analyzeSharedUrl,
  processSharedContent,
} from "../services/shareHandler";

interface QuickClipModalProps {
  visible: boolean;
  userEmail?: string;
  onClose: () => void;
  onClipSaved: () => void;
}

export const QuickClipModal: React.FC<QuickClipModalProps> = ({
  visible,
  userEmail,
  onClose,
  onClipSaved,
}) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const username = userEmail ? userEmail.split("@")[0] : "clipper";

  const detectedAnalysis = url.trim()
    ? analyzeSharedUrl(cleanShareUrl(url.trim()))
    : null;
  const detected = detectedAnalysis ? detectedAnalysis.platform : "other";

  const handleSave = async () => {
    if (!url.trim()) return;
    haptics.selection();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await processSharedContent(url.trim(), user?.id);

      if (result.success) {
        // If user entered a custom title, update it
        if (title.trim() && result.video?.id) {
          await supabase
            .from("saved_videos")
            .update({ title: title.trim() })
            .eq("id", result.video.id);
        }
        haptics.success();
        setUrl("");
        setTitle("");
        onClipSaved();
        onClose();
      } else {
        console.warn("Save clip error:", result.error);
        Alert.alert("Unable to Save", result.error || "Please check the URL.");
      }
    } catch (err: any) {
      console.warn("Failed to insert clip:", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                onClose();
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>New clip</Text>

            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.postPill, !url.trim() && styles.postPillDisabled]}
              disabled={!url.trim() || loading}
              onPress={handleSave}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text
                  style={[
                    styles.postPillText,
                    !url.trim() && styles.postPillTextDisabled,
                  ]}
                >
                  Clip
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Threads Compose Body */}
          <View style={styles.body}>
            {/* Left Thread Line & Avatar */}
            <View style={styles.leftColumn}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {username.charAt(0).toUpperCase()}
                </Text>
                <View style={styles.plusBadge}>
                  <PikaIcon name="add" size={9} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.threadConnector} />
            </View>

            {/* Right Inputs Column */}
            <View style={styles.rightColumn}>
              <Text style={styles.usernameText}>{username}</Text>

              <TextInput
                style={styles.urlInput}
                placeholder="Paste video URL from Instagram, YouTube, X, TikTok..."
                placeholderTextColor="#666666"
                value={url}
                onChangeText={setUrl}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.titleInput}
                placeholder="Add clip notes or title (optional)"
                placeholderTextColor="#555555"
                value={title}
                onChangeText={setTitle}
              />

              {/* Detected Platform Tag */}
              {Boolean(url.trim()) && (
                <View style={styles.detectedPlatformRow}>
                  <PikaIcon
                    name={
                      detected === "youtube"
                        ? "logo-youtube"
                        : detected === "instagram"
                          ? "logo-instagram"
                          : detected === "twitter"
                            ? "logo-twitter"
                            : detected === "tiktok"
                              ? "musical-notes"
                              : "link-outline"
                    }
                    size={15}
                    color="#0095F6"
                  />
                  <Text style={styles.detectedPlatformText}>
                    Detected: {detected.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101010",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  cancelText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  postPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  postPillDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  postPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
  },
  postPillTextDisabled: {
    color: "rgba(0, 0, 0, 0.4)",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  leftColumn: {
    alignItems: "center",
    marginRight: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  plusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  threadConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "#262626",
    marginTop: 8,
    marginBottom: 16,
  },
  rightColumn: {
    flex: 1,
    paddingTop: 2,
  },
  usernameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  urlInput: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 22,
    minHeight: 50,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 14,
    color: threadsTokens.colors.textSecondary,
    marginBottom: 14,
  },
  detectedPlatformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#181818",
    alignSelf: "flex-start",
  },
  detectedPlatformText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0095F6",
  },
});
