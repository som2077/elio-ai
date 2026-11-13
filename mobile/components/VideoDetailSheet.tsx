import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { IndustryBottomSheet } from "./IndustryBottomSheet";
import { fetchVideoAIMetadata, generateVideoAIOnDemand } from "../services/aiService";
import { openVideoDirectly } from "../services/deepLink";
import type {
  VideoAIMetadata,
  ActionItem,
  ContextStepItem,
  EntityReferenced,
  FactCheckNuance,
  BackgroundLore,
  CorePremiseThesis,
} from "../types/ai";

export type DetailTabType = "summary" | "lore" | "tools" | "timestamps" | "actions";

interface VideoDetailSheetProps {
  video: SavedVideo | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (video: SavedVideo) => void;
  onToggleStatus: (video: SavedVideo) => void;
  onToggleFavorite?: (video: SavedVideo) => void;
  onCopyLink?: (url: string) => void;
  onDelete: (video: SavedVideo) => void;
  onTestNotification?: (video: SavedVideo) => void;
  onAskElio?: (video: SavedVideo, initialQuestion?: string) => void;
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
  onTestNotification,
  onAskElio,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabType>("summary");
  const [langMode, setLangMode] = useState<"en" | "hinglish">("en");
  const [aiMeta, setAiMeta] = useState<VideoAIMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTakeaways, setCopiedTakeaways] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [activeFollowupIndex, setActiveFollowupIndex] = useState(0);

  // Rotating prompt interval for Ask Elio sticky button
  const intervalRef = useRef<any>(null);

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

  // Rotate Ask Elio prompts every 4 seconds
  useEffect(() => {
    if (aiMeta?.suggested_followups && aiMeta.suggested_followups.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveFollowupIndex((prev) => (prev + 1) % aiMeta.suggested_followups!.length);
      }, 4000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [aiMeta?.suggested_followups]);

  if (!video) return null;

  const isWatched = video.status === "watched";

  // Resolved English or Hinglish summary and takeaways
  const getResolvedTldw = (): string => {
    if (!aiMeta) return "";
    if (langMode === "hinglish") {
      return (
        aiMeta.tldw_hinglish ||
        aiMeta.tldw ||
        ""
      );
    }
    const core = typeof aiMeta.core_premise === "object" ? aiMeta.core_premise : null;
    return (
      aiMeta.tldw ||
      aiMeta.tldw_en ||
      core?.tldw_en ||
      (typeof aiMeta.core_premise === "string" ? aiMeta.core_premise : "") ||
      ""
    );
  };

  const getResolvedTakeaways = (): string[] => {
    if (!aiMeta?.key_takeaways) return [];
    if (Array.isArray(aiMeta.key_takeaways)) {
      return aiMeta.key_takeaways;
    }
    const record = aiMeta.key_takeaways as { english?: string[]; hinglish?: string[] };
    if (langMode === "hinglish" && record.hinglish && record.hinglish.length > 0) {
      return record.hinglish;
    }
    return record.english || [];
  };

  const resolvedTldw = getResolvedTldw();
  const resolvedTakeaways = getResolvedTakeaways();

  // Core Premise Dilemma Breakdown
  const corePremise: CorePremiseThesis | null =
    typeof aiMeta?.core_premise === "object" ? aiMeta.core_premise : null;

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
      Alert.alert("AI Engine Notice", res.error || "Could not generate full context right now.");
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
    const textToCopy = `📌 ${resolvedTldw}\n\nKey Takeaways:\n${resolvedTakeaways
      .map((k) => `• ${k}`)
      .join("\n")}`;
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

  const handleOpenEntity = (entity: EntityReferenced) => {
    haptics.light();
    if (
      entity.url_or_search_term &&
      (entity.url_or_search_term.startsWith("http://") ||
        entity.url_or_search_term.startsWith("https://"))
    ) {
      Linking.openURL(entity.url_or_search_term).catch(() => {});
    } else {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        entity.url_or_search_term || entity.name
      )}`;
      Linking.openURL(searchUrl).catch(() => {});
    }
  };

  const handleTimestampJump = (item: ContextStepItem) => {
    haptics.selection();
    if (video.clean_url) {
      openVideoDirectly(
        video.clean_url,
        video.platform as any,
        video.platform_video_id,
        item.time_seconds
      );
    }
  };

  const handleAskElioPress = (prompt?: string) => {
    haptics.selection();
    onClose();
    if (onAskElio) {
      onAskElio(video, prompt);
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

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case "verified_accurate":
        return { bg: "rgba(16, 185, 129, 0.12)", border: "#10B981", text: "#10B981" };
      case "mostly_accurate_with_nuance":
        return { bg: "rgba(245, 158, 11, 0.12)", border: "#F59E0B", text: "#F59E0B" };
      case "misleading_oversimplification":
        return { bg: "rgba(239, 68, 68, 0.12)", border: "#EF4444", text: "#EF4444" };
      case "sponsored_promo":
        return { bg: "rgba(139, 92, 246, 0.12)", border: "#8B5CF6", text: "#8B5CF6" };
      default:
        return { bg: "rgba(56, 189, 248, 0.12)", border: "#38BDF8", text: "#38BDF8" };
    }
  };

  const activeFollowup =
    aiMeta?.suggested_followups && aiMeta.suggested_followups.length > 0
      ? aiMeta.suggested_followups[activeFollowupIndex] || aiMeta.suggested_followups[0]
      : "Ask anything about this video...";

  return (
    <IndustryBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.88}
    >
      {/* 1. Header Row: Video Platform & Title + Instant 0ms Dual-Language Switch */}
      <View style={styles.sheetHeaderRow}>
        <View style={styles.videoHeaderMeta}>
          <Text style={styles.videoPlatformText}>
            {(video.platform || "Video").toUpperCase()}
            {video.creator_name ? ` • @${video.creator_name}` : ""}
          </Text>
          <Text style={styles.videoTitleText} numberOfLines={1}>
            {video.title || "Video Intelligence"}
          </Text>
        </View>

        <View style={styles.langTogglePill}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              haptics.selection();
              setLangMode("en");
            }}
            style={[styles.langBtn, langMode === "en" && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, langMode === "en" && styles.langBtnTextActive]}>
              EN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              haptics.selection();
              setLangMode("hinglish");
            }}
            style={[styles.langBtn, langMode === "hinglish" && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, langMode === "hinglish" && styles.langBtnTextActive]}>
              Hinglish
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. 5-Segment Horizontal Tab Navigation */}
      <View style={styles.tabScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeTab === "summary" && styles.segmentBtnActive]}
            onPress={() => {
              haptics.selection();
              setActiveTab("summary");
            }}
          >
            <PikaIcon
              name="sparkles"
              size={12}
              color={activeTab === "summary" ? "#A78BFA" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "summary" && styles.segmentBtnTextActive,
              ]}
            >
              Summary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeTab === "lore" && styles.segmentBtnActive]}
            onPress={() => {
              haptics.selection();
              setActiveTab("lore");
            }}
          >
            <PikaIcon
              name="book-outline"
              size={12}
              color={activeTab === "lore" ? "#A78BFA" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "lore" && styles.segmentBtnTextActive,
              ]}
            >
              Deep Lore
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeTab === "tools" && styles.segmentBtnActive]}
            onPress={() => {
              haptics.selection();
              setActiveTab("tools");
            }}
          >
            <PikaIcon
              name="construct-outline"
              size={12}
              color={activeTab === "tools" ? "#A78BFA" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "tools" && styles.segmentBtnTextActive,
              ]}
            >
              Tools & Graph
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeTab === "timestamps" && styles.segmentBtnActive]}
            onPress={() => {
              haptics.selection();
              setActiveTab("timestamps");
            }}
          >
            <PikaIcon
              name="time-outline"
              size={12}
              color={activeTab === "timestamps" ? "#A78BFA" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "timestamps" && styles.segmentBtnTextActive,
              ]}
            >
              Chapters
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
            <PikaIcon
              name="ellipsis-horizontal"
              size={12}
              color={activeTab === "actions" ? "#FFFFFF" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === "actions" && styles.segmentBtnTextActive,
              ]}
            >
              Options
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. SCROLLABLE TAB BODIES */}
      {isLoadingMeta || isGenerating ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#A78BFA" size="large" />
          <Text style={styles.loaderText}>
            {isGenerating
              ? "OpenAI is extracting deep lore & nuances..."
              : aiMeta?.processing_stage === "transcribing"
              ? "Whisper speech intelligence in progress..."
              : "Retrieving full video intelligence..."}
          </Text>
        </View>
      ) : !aiMeta ? (
        <View style={styles.emptyAiBox}>
          <View style={styles.emptyAiIconRing}>
            <PikaIcon name="sparkles" size={26} color="#A78BFA" />
          </View>
          <Text style={styles.emptyAiTitle}>Full Context Ready to Extract</Text>
          <Text style={styles.emptyAiSubtitle}>
            Extract spoken speech, industry backstory, fact-check nuances, and clickable tools with
            Elio AI.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.generateBtn}
            onPress={handleGenerateAI}
          >
            <PikaIcon name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.generateBtnText}>Generate Full Context</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.digestScroll}
          contentContainerStyle={{ paddingBottom: 85 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: SUMMARY (TL;DW) */}
          {activeTab === "summary" && (
            <View>
              {/* Spoken Speech Status Pill */}
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
                      ? `Spoken Speech Extracted (${(
                          aiMeta.transcript_language || "EN"
                        ).toUpperCase()})`
                      : "Post Caption & Notes Context"}
                  </Text>
                </View>

                {!aiMeta.has_spoken_audio && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.whisperTriggerBtn}
                    onPress={handleTranscribeWhisper}
                  >
                    <Text style={styles.whisperTriggerText}>Whisper Audio</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* TL;DW Capsule Card */}
              <View style={styles.tldwCard}>
                <View style={styles.tldwHeaderRow}>
                  <View style={styles.badgeRow}>
                    <PikaIcon name="flash" size={13} color="#FBBF24" />
                    <Text style={styles.tldwBadgeLabel}>30-SEC TL;DW</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {aiMeta.productivity_score ? (
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreBadgeText}>
                          {aiMeta.productivity_score} Score
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.readTimeText}>{aiMeta.read_time_seconds || 30}s read</Text>
                  </View>
                </View>
                <Text style={styles.tldwBodyText}>{resolvedTldw}</Text>
              </View>

              {/* Core Dilemma: Problem vs Solution Callout */}
              {corePremise?.problem_addressed && corePremise?.main_solution_or_claim && (
                <View style={styles.dilemmaContainer}>
                  <View style={styles.dilemmaBoxProblem}>
                    <Text style={styles.dilemmaLabelProblem}>THE FRICTION / PROBLEM</Text>
                    <Text style={styles.dilemmaText}>{corePremise.problem_addressed}</Text>
                  </View>
                  <View style={styles.dilemmaBoxSolution}>
                    <Text style={styles.dilemmaLabelSolution}>THE RESOLUTION</Text>
                    <Text style={styles.dilemmaText}>{corePremise.main_solution_or_claim}</Text>
                  </View>
                </View>
              )}

              {/* Key Takeaways */}
              {resolvedTakeaways && resolvedTakeaways.length > 0 && (
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
                        {copiedTakeaways ? "Copied" : "Copy All"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {resolvedTakeaways.map((takeaway, idx) => (
                    <View key={idx} style={styles.takeawayItem}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.takeawayText}>{takeaway}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: DEEP LORE & FACT CHECK */}
          {activeTab === "lore" && (
            <View>
              {/* Fact Check Nuance Banner */}
              {aiMeta.fact_check_nuance && (
                <View
                  style={[
                    styles.factCheckCard,
                    {
                      borderColor: getVerdictStyle(aiMeta.fact_check_nuance.verdict).border,
                      backgroundColor: getVerdictStyle(aiMeta.fact_check_nuance.verdict).bg,
                    },
                  ]}
                >
                  <View style={styles.factCheckHeader}>
                    <PikaIcon
                      name="shield-checkmark"
                      size={15}
                      color={getVerdictStyle(aiMeta.fact_check_nuance.verdict).text}
                    />
                    <Text
                      style={[
                        styles.factCheckBadgeText,
                        { color: getVerdictStyle(aiMeta.fact_check_nuance.verdict).text },
                      ]}
                    >
                      {aiMeta.fact_check_nuance.verdict_badge || "Fact-Check & Reality Check"}
                    </Text>
                  </View>
                  <Text style={styles.factCheckExplanation}>
                    {aiMeta.fact_check_nuance.explanation}
                  </Text>

                  {/* Missing Nuances */}
                  {aiMeta.fact_check_nuance.missing_nuances &&
                    aiMeta.fact_check_nuance.missing_nuances.length > 0 && (
                      <View style={styles.nuanceBox}>
                        <Text style={styles.nuanceHeader}>MISSING CAVEATS / TRADE-OFFS:</Text>
                        {aiMeta.fact_check_nuance.missing_nuances.map((nuance, idx) => (
                          <View key={idx} style={styles.nuanceItem}>
                            <Text style={styles.nuanceBullet}>⚠️</Text>
                            <Text style={styles.nuanceItemText}>{nuance}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                  {/* Hidden Costs / Prerequisites */}
                  {aiMeta.fact_check_nuance.hidden_costs_or_prereqs &&
                    aiMeta.fact_check_nuance.hidden_costs_or_prereqs.length > 0 && (
                      <View style={styles.costsContainer}>
                        {aiMeta.fact_check_nuance.hidden_costs_or_prereqs.map((cost, idx) => (
                          <View key={idx} style={styles.costChip}>
                            <Text style={styles.costChipText}>🔒 {cost}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                </View>
              )}

              {/* Deep Background Lore & Macro Significance */}
              {aiMeta.background_lore ? (
                <View style={styles.loreContainer}>
                  <View style={styles.loreCard}>
                    <View style={styles.loreCardHeader}>
                      <PikaIcon name="bulb-outline" size={15} color="#A78BFA" />
                      <Text style={styles.loreCardTitle}>Why It Matters Right Now</Text>
                    </View>
                    <Text style={styles.loreCardBody}>
                      {aiMeta.background_lore.why_it_matters}
                    </Text>
                  </View>

                  {aiMeta.background_lore.backstory && (
                    <View style={styles.loreCard}>
                      <View style={styles.loreCardHeader}>
                        <PikaIcon name="newspaper-outline" size={15} color="#38BDF8" />
                        <Text style={styles.loreCardTitle}>Backstory & Industry Lore</Text>
                      </View>
                      <Text style={styles.loreCardBody}>
                        {aiMeta.background_lore.backstory}
                      </Text>
                    </View>
                  )}

                  {/* Assumed Prerequisites */}
                  {aiMeta.background_lore.assumed_prerequisites &&
                    aiMeta.background_lore.assumed_prerequisites.length > 0 && (
                      <View style={styles.prereqSection}>
                        <Text style={styles.sectionTitle}>Assumed Prerequisites</Text>
                        <View style={styles.prereqChips}>
                          {aiMeta.background_lore.assumed_prerequisites.map((prereq, idx) => (
                            <View key={idx} style={styles.prereqChip}>
                              <Text style={styles.prereqChipText}>📚 {prereq}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                </View>
              ) : (
                <View style={styles.emptyTabCard}>
                  <Text style={styles.emptyTabText}>
                    No deep background lore generated for this short clip yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 3: TOOLS, REPOS & ENTITIES */}
          {activeTab === "tools" && (
            <View>
              {/* Action Items / Extracted Resources */}
              {aiMeta.action_items && aiMeta.action_items.length > 0 && (
                <View style={styles.actionsSection}>
                  <Text style={styles.sectionTitle}>Clickable Resources & Tools</Text>
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

              {/* Entities Referenced Knowledge Graph */}
              {aiMeta.entities_referenced && aiMeta.entities_referenced.length > 0 && (
                <View style={styles.entitiesSection}>
                  <Text style={styles.sectionTitle}>Entities & Concepts Mentioned</Text>
                  <View style={styles.entityList}>
                    {aiMeta.entities_referenced.map((entity, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        style={styles.entityCard}
                        onPress={() => handleOpenEntity(entity)}
                      >
                        <View style={styles.entityCategoryBadge}>
                          <Text style={styles.entityCategoryText}>
                            {(entity.category || "Entity").toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entityName}>{entity.name}</Text>
                          <Text style={styles.entityBio} numberOfLines={2}>
                            {entity.one_liner}
                          </Text>
                        </View>
                        <PikaIcon name="search-outline" size={13} color="#71767B" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {(!aiMeta.action_items || aiMeta.action_items.length === 0) &&
                (!aiMeta.entities_referenced || aiMeta.entities_referenced.length === 0) && (
                  <View style={styles.emptyTabCard}>
                    <Text style={styles.emptyTabText}>
                      No external tools or entity links referenced in this clip.
                    </Text>
                  </View>
                )}
            </View>
          )}

          {/* TAB 4: TIMESTAMPS & FULL TRANSCRIPT */}
          {activeTab === "timestamps" && (
            <View>
              {/* Chapter Milestones Breakdown */}
              {aiMeta.context_breakdown && aiMeta.context_breakdown.length > 0 && (
                <View style={styles.contextBreakdownSection}>
                  <Text style={styles.sectionTitle}>
                    Key Moments (Tap to Jump Video)
                  </Text>
                  <View style={styles.breakdownList}>
                    {aiMeta.context_breakdown.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        style={styles.breakdownCard}
                        onPress={() => handleTimestampJump(item)}
                      >
                        {item.time_formatted && (
                          <View style={styles.timeBadge}>
                            <PikaIcon
                              name="play"
                              size={9}
                              color="#818CF8"
                              style={{ marginRight: 3 }}
                            />
                            <Text style={styles.timeBadgeText}>
                              {item.time_formatted}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownTitle}>{item.title}</Text>
                          <Text style={styles.breakdownDetail}>{item.detail}</Text>
                        </View>
                        <PikaIcon name="open-outline" size={13} color="#71767B" />
                      </TouchableOpacity>
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
            </View>
          )}

          {/* TAB 5: OPTIONS & ACTIONS */}
          {activeTab === "actions" && (
            <View style={styles.actionGroup}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionRow}
                onPress={handleCopy}
              >
                <Text style={styles.actionLabel}>Copy video link</Text>
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

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionRow}
                onPress={handleOpenPlay}
              >
                <Text style={styles.actionLabel}>Open in Native App</Text>
                <PikaIcon name="open-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Test Notification Action */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionRow}
                onPress={() => {
                  if (onTestNotification && video) onTestNotification(video);
                }}
              >
                <View>
                  <Text style={styles.actionLabel}>Test Reminder (Send in 5s)</Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    Triggers reminder popup with hook headline after 5 seconds
                  </Text>
                </View>
                <PikaIcon name="notifications-outline" size={22} color="#8B5CF6" />
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
          )}
        </ScrollView>
      )}

      {/* 4. PERSISTENT FROSTED 'ASK ELIO' STICKY FOOTER */}
      {aiMeta && activeTab !== "actions" && (
        <View style={styles.stickyFooterContainer}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.askElioStickyBtn}
            onPress={() => handleAskElioPress(activeFollowup)}
          >
            <View style={styles.askElioIconBox}>
              <PikaIcon name="sparkles" size={14} color="#A78BFA" />
            </View>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.askElioBtnTitle} numberOfLines={1}>
                Ask Elio: "{activeFollowup}"
              </Text>
              <Text style={styles.askElioBtnSub}>
                Tap to chat with video context & citations
              </Text>
            </View>
            <PikaIcon name="arrow-forward" size={16} color="#A78BFA" />
          </TouchableOpacity>
        </View>
      )}
    </IndustryBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  langTogglePill: {
    flexDirection: "row",
    backgroundColor: "#16181C",
    borderRadius: 14,
    padding: 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  langBtnActive: {
    backgroundColor: "#8B5CF6",
  },
  langBtnText: {
    color: "#71767B",
    fontSize: 10.5,
    fontWeight: "600",
  },
  langBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  videoHeaderMeta: {
    flex: 1,
    marginRight: 10,
  },
  videoPlatformText: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  videoTitleText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  tabScrollContainer: {
    marginBottom: 14,
  },
  tabBarContent: {
    gap: 6,
    paddingHorizontal: 2,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  segmentBtnActive: {
    backgroundColor: "#1E1E22",
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  segmentBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#71767B",
  },
  segmentBtnTextActive: {
    color: "#FFFFFF",
  },
  digestScroll: {
    maxHeight: 460,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 12,
    fontWeight: "500",
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
  tldwCard: {
    backgroundColor: "rgba(167, 139, 250, 0.09)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    padding: 14,
    marginBottom: 12,
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
  scoreBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreBadgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
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
  dilemmaContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  dilemmaBoxProblem: {
    flex: 1,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  dilemmaLabelProblem: {
    color: "#F87171",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dilemmaBoxSolution: {
    flex: 1,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  dilemmaLabelSolution: {
    color: "#34D399",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dilemmaText: {
    color: "#E2E8F0",
    fontSize: 11.5,
    lineHeight: 16,
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
  factCheckCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  factCheckHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  factCheckBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  factCheckExplanation: {
    color: "#F1F5F9",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  nuanceBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  nuanceHeader: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nuanceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  nuanceBullet: {
    fontSize: 11,
    marginRight: 6,
    marginTop: 1,
  },
  nuanceItemText: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
  },
  costsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  costChip: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  costChipText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  loreContainer: {
    gap: 10,
  },
  loreCard: {
    backgroundColor: "#161618",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  loreCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  loreCardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  loreCardBody: {
    color: "#CBD5E1",
    fontSize: 12.5,
    lineHeight: 18,
  },
  prereqSection: {
    marginTop: 8,
  },
  prereqChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  prereqChip: {
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  prereqChipText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "600",
  },
  actionsSection: {
    marginBottom: 14,
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
  entitiesSection: {
    marginTop: 8,
  },
  entityList: {
    marginTop: 8,
    gap: 8,
  },
  entityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  entityCategoryBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  entityCategoryText: {
    color: "#38BDF8",
    fontSize: 9.5,
    fontWeight: "800",
  },
  entityName: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  entityBio: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 15,
  },
  emptyTabCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTabText: {
    color: "#71767B",
    fontSize: 13,
    textAlign: "center",
  },
  contextBreakdownSection: {
    marginBottom: 14,
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    paddingHorizontal: 7,
    paddingVertical: 4,
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
    marginTop: 8,
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
  stickyFooterContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 16 : 8,
    left: 14,
    right: 14,
  },
  askElioStickyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161720",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  askElioIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(167, 139, 250, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  askElioBtnTitle: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  askElioBtnSub: {
    color: "#A78BFA",
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 1,
  },
});
