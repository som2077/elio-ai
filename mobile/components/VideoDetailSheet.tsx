import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { IndustryBottomSheet } from "./IndustryBottomSheet";
import { fetchVideoAIMetadata, generateVideoAIOnDemand } from "../services/aiService";
import type { VideoAIMetadata, ActionItem } from "../types/ai";

interface VideoDetailSheetProps {
  video: SavedVideo | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (video: SavedVideo) => void;
  onToggleStatus: (video: SavedVideo) => void;
  onToggleFavorite?: (video: SavedVideo) => void;
  onCopyLink?: (url: string) => void;
  onDelete: (video: SavedVideo) => void;
}

export const VideoDetailSheet: React.FC<VideoDetailSheetProps> = ({
  video,
  visible,
  onClose,
  onPlay,
  onToggleStatus,
  onToggleFavorite,
  onCopyLink,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<"digest" | "actions">("digest");
  const [aiMeta, setAiMeta] = useState<VideoAIMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTakeaways, setCopiedTakeaways] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (visible && video) {
      if (video.ai_metadata) {
        setAiMeta(video.ai_metadata);
      } else {
        setIsLoadingMeta(true);
        fetchVideoAIMetadata(video.id).then((meta) => {
          if (isMounted) {
            setAiMeta(meta);
            setIsLoadingMeta(false);
          }
        });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [visible, video?.id, video?.ai_metadata]);

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

  const handleGenerateAI = async () => {
    haptics.selection();
    setIsGenerating(true);
    const res = await generateVideoAIOnDemand(video);
    setIsGenerating(false);

    if (res.success && res.data) {
      setAiMeta(res.data);
      haptics.success();
    } else {
      Alert.alert("AI Engine Notice", res.error || "Could not generate digest right now.");
    }
  };

  const handleTranscribeWhisper = async () => {
    haptics.selection();
    setIsGenerating(true);
    const res = await generateVideoAIOnDemand(video, true);
    setIsGenerating(false);

    if (res.success && res.data) {
      setAiMeta(res.data);
      haptics.success();
    } else {
      Alert.alert("Speech Engine Notice", res.error || "Could not transcribe audio right now.");
    }
  };

  const handleCopyTranscript = () => {
    if (!aiMeta?.full_transcript) return;
    haptics.light();
    if (onCopyLink) {
      onCopyLink(aiMeta.full_transcript);
    }
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleCopyTakeaways = () => {
    if (!aiMeta) return;
    haptics.light();
    const textToCopy = `📌 ${aiMeta.tldw}\n\nKey Takeaways:\n${aiMeta.key_takeaways.map((k) => `• ${k}`).join("\n")}`;
    if (onCopyLink) {
      onCopyLink(textToCopy);
    }
    setCopiedTakeaways(true);
    setTimeout(() => setCopiedTakeaways(false), 2000);
  };

  const handleOpenResource = (item: ActionItem) => {
    haptics.light();
    if (item.url && (item.url.startsWith("https://") || item.url.startsWith("http://"))) {
      Linking.openURL(item.url).catch(() => {
        Alert.alert("Unable to Open Link", item.url);
      });
    } else if (onCopyLink) {
      onCopyLink(item.title);
      Alert.alert("Copied to Clipboard", item.title);
    }
  };

  const renderActionIcon = (type: ActionItem["type"]) => {
    switch (type) {
      case "repo":
        return "code-slash-outline";
      case "recipe":
        return "restaurant-outline";
      case "book":
        return "book-outline";
      case "tool":
        return "construct-outline";
      default:
        return "link-outline";
    }
  };

  return (
    <IndustryBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.82}
    >
      {/* 1. Header Segmented Toggle */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.segmentBtn, activeTab === "digest" && styles.segmentBtnActive]}
          onPress={() => {
            haptics.selection();
            setActiveTab("digest");
          }}
        >
          <PikaIcon
            name="sparkles"
            size={13}
            color={activeTab === "digest" ? "#A78BFA" : "#71767B"}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === "digest" && styles.segmentBtnTextActive,
            ]}
          >
            ✦ AI Digest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.segmentBtn, activeTab === "actions" && styles.segmentBtnActive]}
          onPress={() => {
            haptics.selection();
            setActiveTab("actions");
          }}
        >
          <Text
            style={[
              styles.segmentBtnText,
              activeTab === "actions" && styles.segmentBtnTextActive,
            ]}
          >
            Actions & Options
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. TAB: AI DIGEST */}
      {activeTab === "digest" && (
        <ScrollView
          style={styles.digestScroll}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingMeta || isGenerating ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color="#A78BFA" size="large" />
              <Text style={styles.loaderText}>
                {isGenerating
                  ? "OpenAI is analyzing video transcript..."
                  : "Retrieving AI digest..."}
              </Text>
            </View>
          ) : aiMeta ? (
            <View>
              {/* Speech Intelligence Status Pill */}
              <View style={styles.speechBadgeRow}>
                <View
                  style={[
                    styles.speechBadge,
                    aiMeta.has_spoken_audio
                      ? styles.speechBadgeActive
                      : styles.speechBadgeNotes,
                  ]}
                >
                  <PikaIcon
                    name={aiMeta.has_spoken_audio ? "sparkles" : "film-outline"}
                    size={12}
                    color={aiMeta.has_spoken_audio ? "#10B981" : "#A78BFA"}
                  />
                  <Text
                    style={[
                      styles.speechBadgeText,
                      {
                        color: aiMeta.has_spoken_audio ? "#10B981" : "#A78BFA",
                      },
                    ]}
                  >
                    {aiMeta.has_spoken_audio
                      ? `Spoken Speech Extracted (${(aiMeta.transcript_language || "EN").toUpperCase()})`
                      : "Post Caption & Notes Context"}
                  </Text>
                </View>

                {!aiMeta.has_spoken_audio && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.whisperTriggerBtn}
                    onPress={handleTranscribeWhisper}
                  >
                    <Text style={styles.whisperTriggerText}>
                      Whisper Audio
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* TL;DW Capsule */}
              <View style={styles.tldwCard}>
                <View style={styles.tldwHeaderRow}>
                  <View style={styles.badgeRow}>
                    <PikaIcon name="flash" size={13} color="#FBBF24" />
                    <Text style={styles.tldwBadgeLabel}>30-SEC TL;DW</Text>
                  </View>
                  <Text style={styles.readTimeText}>{aiMeta.read_time_seconds}s read</Text>
                </View>
                <Text style={styles.tldwBodyText}>{aiMeta.tldw}</Text>
              </View>

              {/* Key Takeaways */}
              {aiMeta.key_takeaways && aiMeta.key_takeaways.length > 0 && (
                <View style={styles.takeawaysSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Key Takeaways</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.copyBtn}
                      onPress={handleCopyTakeaways}
                    >
                      <PikaIcon
                        name={copiedTakeaways ? "checkmark" : "copy-outline"}
                        size={13}
                        color={copiedTakeaways ? "#10B981" : "#A78BFA"}
                      />
                      <Text
                        style={[
                          styles.copyBtnText,
                          copiedTakeaways && { color: "#10B981" },
                        ]}
                      >
                        {copiedTakeaways ? "Copied" : "Copy"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {aiMeta.key_takeaways.map((takeaway, idx) => (
                    <View key={idx} style={styles.takeawayItem}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.takeawayText}>{takeaway}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Spoken Context & Step-by-Step Breakdown */}
              {aiMeta.context_breakdown && aiMeta.context_breakdown.length > 0 && (
                <View style={styles.contextBreakdownSection}>
                  <Text style={styles.sectionTitle}>Spoken Context & Steps</Text>
                  <View style={styles.breakdownList}>
                    {aiMeta.context_breakdown.map((item, idx) => (
                      <View key={idx} style={styles.breakdownCard}>
                        {item.time_formatted && (
                          <View style={styles.timeBadge}>
                            <Text style={styles.timeBadgeText}>
                              {item.time_formatted}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownTitle}>{item.title}</Text>
                          <Text style={styles.breakdownDetail}>{item.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Full Spoken Dialog & Transcript Panel */}
              {aiMeta.full_transcript && aiMeta.full_transcript.length > 0 && (
                <View style={styles.transcriptSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Spoken Transcript</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.copyBtn}
                        onPress={handleCopyTranscript}
                      >
                        <PikaIcon
                          name={copiedTranscript ? "checkmark" : "copy-outline"}
                          size={13}
                          color={copiedTranscript ? "#10B981" : "#A78BFA"}
                        />
                        <Text
                          style={[
                            styles.copyBtnText,
                            copiedTranscript && { color: "#10B981" },
                          ]}
                        >
                          {copiedTranscript ? "Copied" : "Copy All"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.copyBtn}
                        onPress={() => setShowFullTranscript(!showFullTranscript)}
                      >
                        <Text style={styles.copyBtnText}>
                          {showFullTranscript ? "Collapse" : "Expand"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showFullTranscript ? (
                    <View style={styles.transcriptBox}>
                      <Text style={styles.transcriptText} selectable>
                        {aiMeta.full_transcript}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.transcriptCollapsed}
                      onPress={() => setShowFullTranscript(true)}
                    >
                      <Text
                        style={styles.transcriptCollapsedText}
                        numberOfLines={3}
                      >
                        "{aiMeta.full_transcript.slice(0, 180)}..."
                      </Text>
                      <Text style={styles.readMoreText}>
                        Tap to read full transcript →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Action Items / Extracted Resources */}
              {aiMeta.action_items && aiMeta.action_items.length > 0 && (
                <View style={styles.actionsSection}>
                  <Text style={styles.sectionTitle}>Mentioned Resources & Actions</Text>
                  <View style={styles.actionChipsContainer}>
                    {aiMeta.action_items.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        style={styles.actionChip}
                        onPress={() => handleOpenResource(item)}
                      >
                        <PikaIcon
                          name={renderActionIcon(item.type)}
                          size={14}
                          color="#A78BFA"
                          style={{ marginRight: 6 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.actionChipTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.subtitle && (
                            <Text style={styles.actionChipSubtitle} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          )}
                        </View>
                        <PikaIcon name="open-outline" size={13} color="#71767B" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyAiBox}>
              <View style={styles.emptyAiIconRing}>
                <PikaIcon name="sparkles" size={26} color="#A78BFA" />
              </View>
              <Text style={styles.emptyAiTitle}>No Digest Generated Yet</Text>
              <Text style={styles.emptyAiSubtitle}>
                Extract transcripts, 3-bullet takeaways, and clickable resources using OpenAI in seconds.
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.generateBtn}
                onPress={handleGenerateAI}
              >
                <PikaIcon name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.generateBtnText}>Generate 30-Sec Digest</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* 3. TAB: ACTIONS */}
      {activeTab === "actions" && (
        <View>
          <View style={styles.actionGroup}>
            <TouchableOpacity activeOpacity={0.7} style={styles.actionRow} onPress={handleCopy}>
              <Text style={styles.actionLabel}>Copy link</Text>
              <PikaIcon name="link-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleSaveToggle}
            >
              <Text style={styles.actionLabel}>
                {isWatched ? "Move back to Queue" : "Mark as Watched"}
              </Text>
              <PikaIcon
                name={isWatched ? "bookmark" : "checkmark-done-outline"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={() => {
                if (onToggleFavorite && video) onToggleFavorite(video);
              }}
            >
              <Text style={styles.actionLabel}>
                {video.is_favorite ? "Remove from Favorites" : "Add to Favorites ❤️"}
              </Text>
              <PikaIcon
                name={video.is_favorite ? "heart" : "heart-outline"}
                size={22}
                color={video.is_favorite ? "#EF4444" : "#FFFFFF"}
              />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.actionRow} onPress={handleOpenPlay}>
              <Text style={styles.actionLabel}>Open in Native App</Text>
              <PikaIcon name="open-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.actionRow}
              onPress={handleDeletePrompt}
            >
              <Text style={[styles.actionLabel, styles.dangerText]}>Remove clip</Text>
              <PikaIcon
                name="trash-outline"
                size={22}
                color={threadsTokens.colors.destructive}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </IndustryBottomSheet>
  );
};

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: "#1E1E22",
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71767B",
  },
  segmentBtnTextActive: {
    color: "#FFFFFF",
  },
  digestScroll: {
    maxHeight: 380,
  },
  loaderContainer: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 12,
    fontWeight: "500",
  },
  tldwCard: {
    backgroundColor: "rgba(167, 139, 250, 0.09)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    padding: 14,
    marginBottom: 14,
  },
  tldwHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tldwBadgeLabel: {
    color: "#FBBF24",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  readTimeText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  tldwBodyText: {
    color: "#F1F5F9",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  takeawaysSection: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
  },
  copyBtnText: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  takeawayItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#A78BFA",
    marginTop: 7,
    marginRight: 9,
  },
  takeawayText: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "400",
  },
  actionsSection: {
    marginTop: 6,
  },
  actionChipsContainer: {
    marginTop: 8,
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  actionChipTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  actionChipSubtitle: {
    color: "#71767B",
    fontSize: 11,
    marginTop: 1,
  },
  speechBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  speechBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  speechBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.28)",
  },
  speechBadgeNotes: {
    backgroundColor: "rgba(167, 139, 250, 0.10)",
    borderColor: "rgba(167, 139, 250, 0.24)",
  },
  speechBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  whisperTriggerBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  whisperTriggerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  contextBreakdownSection: {
    marginTop: 16,
  },
  breakdownList: {
    marginTop: 8,
    gap: 8,
  },
  breakdownCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#161618",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  timeBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.35)",
  },
  timeBadgeText: {
    color: "#818CF8",
    fontSize: 10.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  breakdownTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  breakdownDetail: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
  },
  transcriptSection: {
    marginTop: 16,
  },
  transcriptBox: {
    backgroundColor: "#121214",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 8,
    maxHeight: 220,
  },
  transcriptText: {
    color: "#CBD5E1",
    fontSize: 12.5,
    lineHeight: 18,
  },
  transcriptCollapsed: {
    backgroundColor: "#121214",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 8,
  },
  transcriptCollapsedText: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
  },
  readMoreText: {
    color: "#A78BFA",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 6,
  },
  emptyAiBox: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyAiIconRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyAiTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyAiSubtitle: {
    color: "#71767B",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
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
});
