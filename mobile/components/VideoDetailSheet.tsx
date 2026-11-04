import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { IndustryBottomSheet } from "./IndustryBottomSheet";

interface VideoDetailSheetProps {
  video: SavedVideo | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (video: SavedVideo) => void;
  onToggleStatus: (video: SavedVideo) => void;
  onCopyLink?: (url: string) => void;
  onDelete: (video: SavedVideo) => void;
}

/**
 * Authentic Instagram Threads / Twitter Action Sheet
 * Powered by IndustryBottomSheet:
 * - 60fps gesture drag-to-dismiss (PanResponder)
 * - Velocity flick detection
 * - Specular highlight top border
 * - Haptic feedback
 */
export const VideoDetailSheet: React.FC<VideoDetailSheetProps> = ({
  video,
  visible,
  onClose,
  onPlay,
  onToggleStatus,
  onCopyLink,
  onDelete,
}) => {
  if (!video) return null;

  const isWatched = video.status === "watched";

  const handleCopy = () => {
    haptics.light();
    if (onCopyLink) {
      onCopyLink(video.clean_url);
    }
    onClose();
  };

  const handleSaveToggle = () => {
    haptics.selection();
    onToggleStatus(video);
    onClose();
  };

  const handleOpenPlay = () => {
    haptics.selection();
    onClose();
    onPlay(video);
  };

  const handleDeletePrompt = () => {
    haptics.warning();
    Alert.alert(
      "Remove Clip",
      "Are you sure you want to remove this clip from your vault?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            onClose();
            onDelete(video);
          },
        },
      ]
    );
  };

  return (
    <IndustryBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.75}
    >
      {/* Action List Section 1 */}
      <View style={styles.actionGroup}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={handleCopy}
        >
          <Text style={styles.actionLabel}>Copy link</Text>
          <Ionicons name="link-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={handleSaveToggle}
        >
          <Text style={styles.actionLabel}>
            {isWatched ? "Move back to Queue" : "Save"}
          </Text>
          <Ionicons
            name={isWatched ? "bookmark" : "bookmark-outline"}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={handleOpenPlay}
        >
          <Text style={styles.actionLabel}>Open in App</Text>
          <Ionicons name="open-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={() => {
            haptics.light();
            onClose();
          }}
        >
          <Text style={styles.actionLabel}>Not interested</Text>
          <Ionicons name="eye-off-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Section Divider */}
      <View style={styles.divider} />

      {/* Action List Section 2 */}
      <View style={styles.actionGroup}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={() => {
            haptics.light();
            onClose();
          }}
        >
          <Text style={styles.actionLabel}>Mute</Text>
          <Ionicons name="volume-mute-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={() => {
            haptics.light();
            onClose();
          }}
        >
          <Text style={styles.actionLabel}>Restrict</Text>
          <Ionicons name="person-remove-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={handleDeletePrompt}
        >
          <Text style={[styles.actionLabel, styles.dangerText]}>
            Remove clip
          </Text>
          <Ionicons
            name="trash-outline"
            size={22}
            color={threadsTokens.colors.destructive}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionRow}
          onPress={() => {
            haptics.warning();
            onClose();
          }}
        >
          <Text style={[styles.actionLabel, styles.dangerText]}>Report</Text>
          <Ionicons
            name="alert-circle-outline"
            size={22}
            color={threadsTokens.colors.destructive}
          />
        </TouchableOpacity>
      </View>
    </IndustryBottomSheet>
  );
};

const styles = StyleSheet.create({
  actionGroup: {
    paddingVertical: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  dangerText: {
    color: threadsTokens.colors.destructive,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 4,
  },
});
