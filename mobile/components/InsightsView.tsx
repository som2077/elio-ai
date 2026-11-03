import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { ActivityCalendar } from "./ActivityCalendar";
import { TimeRangeMenu, TimeRange } from "./TimeRangeMenu";
import { InsightsTrendChart } from "./InsightsTrendChart";
import {
  toDateKey,
  formatDisplayDate,
  calculateActivityStats,
} from "../services/dateAnalytics";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type InsightsTab = "overview" | "audience";
export type ClipFilterOption = "latest" | "most_views" | "most_replies" | "most_likes";

interface InsightsViewProps {
  videos: SavedVideo[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
  onVideoPress?: (video: SavedVideo) => void;
  onBack?: () => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  selectedDate,
  onSelectDate,
  onVideoPress,
  onBack,
}) => {
  // Top Navigation Tabs: Overview vs Audience (Platforms)
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");

  // Time Range Filters (from Screenshots 15-59-01 and 15-59-34)
  const [profileRange, setProfileRange] = useState<TimeRange>("30d");
  const [postsRange, setPostsRange] = useState<TimeRange>("90d");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPostsMenu, setShowPostsMenu] = useState(false);

  // Clips sub-filter pill
  const [clipFilter, setClipFilter] = useState<ClipFilterOption>("latest");

  const getDaysCount = (r: TimeRange): number => {
    switch (r) {
      case "7d":
        return 7;
      case "14d":
        return 14;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  };

  const getRangeLabel = (r: TimeRange): string => {
    switch (r) {
      case "7d":
        return "7 days";
      case "14d":
        return "14 days";
      case "30d":
        return "30 days";
      case "90d":
        return "90 days";
      default:
        return "30 days";
    }
  };

  // Profile / Vault metrics for selected Profile Range
  const profileMetrics = useMemo(() => {
    const days = getDaysCount(profileRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = toDateKey(cutoff);

    // Filter videos in range
    const inRange = videos.filter((v) => toDateKey(v.created_at) >= cutoffKey);
    const totalViews = inRange.length;
    const watched = inRange.filter((v) => v.status === "watched").length;
    const inQueue = inRange.filter((v) => v.status === "unread").length;
    const notesCount = inRange.filter((v) => Boolean(v.user_notes)).length;

    return {
      views: totalViews,
      viewers: watched,
      followers: inQueue,
      interactions: notesCount,
    };
  }, [videos, profileRange]);

  // Daily Trend Data Points for Trend Line Chart
  const trendData = useMemo(() => {
    const days = getDaysCount(profileRange);
    const points: { dateKey: string; count: number }[] = [];
    const dateCounts: Record<string, number> = {};

    for (const v of videos) {
      if (!v.created_at) continue;
      const k = toDateKey(v.created_at);
      dateCounts[k] = (dateCounts[k] || 0) + 1;
    }

    const curr = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(curr);
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);
      points.push({
        dateKey: k,
        count: dateCounts[k] || 0,
      });
    }

    return points;
  }, [videos, profileRange]);

  // Posts/Clips filtered and sorted for Section 2
  const filteredClips = useMemo(() => {
    const days = getDaysCount(postsRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = toDateKey(cutoff);

    let list = videos.filter((v) => toDateKey(v.created_at) >= cutoffKey);

    if (clipFilter === "most_views") {
      list = [...list].sort((a, b) => (b.status === "watched" ? 1 : -1));
    } else if (clipFilter === "most_replies") {
      list = [...list].sort((a, b) => (b.user_notes ? 1 : -1));
    } else if (clipFilter === "most_likes") {
      list = [...list].sort((a, b) => (b.is_favorite ? 1 : -1));
    } else {
      // Latest
      list = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return list;
  }, [videos, postsRange, clipFilter]);

  // Platform Breakdown for Audience Tab
  const platformStats = useMemo(() => {
    const counts: Record<string, number> = {
      youtube: 0,
      instagram: 0,
      tiktok: 0,
      twitter: 0,
      reddit: 0,
    };

    for (const v of videos) {
      const p = (v.platform || "").toLowerCase();
      if (counts[p] !== undefined) counts[p]++;
    }

    const meta: Record<
      string,
      { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
    > = {
      youtube: { label: "YouTube", icon: "logo-youtube", color: "#FF0033" },
      instagram: { label: "Instagram", icon: "logo-instagram", color: "#E1306C" },
      tiktok: { label: "TikTok", icon: "musical-notes", color: "#00F2FE" },
      twitter: { label: "X / Twitter", icon: "logo-twitter", color: "#1D9BF0" },
      reddit: { label: "Reddit", icon: "logo-reddit", color: "#FF4500" },
    };

    const total = videos.length;
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        ...(meta[key] || {
          label: key,
          icon: "film-outline" as keyof typeof Ionicons.glyphMap,
          color: "#8E8E93",
        }),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "now";
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d`;
      return `${Math.floor(days / 30)}mo`;
    } catch {
      return "now";
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backBtn}
          onPress={() => {
            haptics.light();
            if (onBack) onBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Insights</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Top Segmented Underline Tabs (Overview vs Audience) */}
      <View style={styles.segmentedTabsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.segmentTab,
            activeTab === "overview" && styles.segmentTabActive,
          ]}
          onPress={() => {
            haptics.selection();
            setActiveTab("overview");
          }}
        >
          <Text
            style={[
              styles.segmentTabText,
              activeTab === "overview" && styles.segmentTabTextActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.segmentTab,
            activeTab === "audience" && styles.segmentTabActive,
          ]}
          onPress={() => {
            haptics.selection();
            setActiveTab("audience");
          }}
        >
          <Text
            style={[
              styles.segmentTabText,
              activeTab === "audience" && styles.segmentTabTextActive,
            ]}
          >
            Audience
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === "overview" ? (
          <>
            {/* SECTION 1: PROFILE / VAULT */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Profile</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={threadsTokens.colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.rangeDropdownBtn}
                onPress={() => {
                  haptics.selection();
                  setShowProfileMenu(true);
                }}
              >
                <Text style={styles.rangeDropdownText}>
                  {getRangeLabel(profileRange)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={threadsTokens.colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>

            {/* Horizontal Metric Cards Carousel (Screenshot 15-59-01 & 15-59-21) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
            >
              <View style={styles.metricCard}>
                <Text style={styles.metricCardLabel}>Views</Text>
                <Text style={styles.metricCardValue}>{profileMetrics.views}</Text>
                <Text style={styles.metricCardDelta}>0.0%</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricCardLabel}>Viewers</Text>
                <Text style={styles.metricCardValue}>{profileMetrics.viewers}</Text>
                <Text style={styles.metricCardDelta}>0.0%</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricCardLabel}>Net followers</Text>
                <Text style={styles.metricCardValue}>{profileMetrics.followers}</Text>
                <Text style={styles.metricCardDelta}>0.0%</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricCardLabel}>Interactions</Text>
                <Text style={styles.metricCardValue}>
                  {profileMetrics.interactions}
                </Text>
                <Text style={styles.metricCardDelta}>0.0%</Text>
              </View>
            </ScrollView>

            {/* Trend Line Chart with 1, 1, 0 gridlines */}
            <InsightsTrendChart
              data={trendData}
              daysCount={getDaysCount(profileRange)}
            />

            {/* SECTION 2: POSTS / CLIPS */}
            <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Posts</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={threadsTokens.colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.rangeDropdownBtn}
                onPress={() => {
                  haptics.selection();
                  setShowPostsMenu(true);
                }}
              >
                <Text style={styles.rangeDropdownText}>
                  {getRangeLabel(postsRange)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={threadsTokens.colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>

            {/* Filter Pills Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.filterPillIcon}
                onPress={() => haptics.selection()}
              >
                <Ionicons name="reorder-two-outline" size={16} color="#FFFFFF" />
                <Text style={styles.filterPillText}>Threads</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  clipFilter === "latest" && styles.filterPillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setClipFilter("latest");
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    clipFilter === "latest" && styles.filterPillTextActive,
                  ]}
                >
                  Latest
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  clipFilter === "most_views" && styles.filterPillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setClipFilter("most_views");
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    clipFilter === "most_views" && styles.filterPillTextActive,
                  ]}
                >
                  Most views
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  clipFilter === "most_replies" && styles.filterPillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setClipFilter("most_replies");
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    clipFilter === "most_replies" && styles.filterPillTextActive,
                  ]}
                >
                  Most replies
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  clipFilter === "most_likes" && styles.filterPillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setClipFilter("most_likes");
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    clipFilter === "most_likes" && styles.filterPillTextActive,
                  ]}
                >
                  Most likes
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Clips List Rows (Matching Screenshot 15-59-01) */}
            <View style={styles.clipsList}>
              {filteredClips.length === 0 ? (
                <View style={styles.emptyClipsBox}>
                  <View style={styles.emptyIconSquircle}>
                    <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.emptyMeta}>
                    <Text style={styles.emptyTimeText}>now</Text>
                    <View style={styles.miniMetricsRow}>
                      <Text style={styles.miniMetric}>♡ 0</Text>
                      <Text style={styles.miniMetric}>💬 0</Text>
                      <Text style={styles.miniMetric}>🔁 0</Text>
                      <Text style={styles.miniMetric}>↗ 0</Text>
                    </View>
                  </View>
                  <View style={styles.emptyRightCol}>
                    <Text style={styles.emptyViewsNum}>0</Text>
                    <Text style={styles.emptyViewsLabel}>Views</Text>
                  </View>
                </View>
              ) : (
                filteredClips.map((item) => {
                  const seed = item.id
                    .split("")
                    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
                  const likes = item.is_favorite ? (seed % 20) + 1 : seed % 5;
                  const replies = item.user_notes ? 1 : 0;
                  const reposts = item.status === "watched" ? 1 : 0;
                  const views = (seed % 80) + 12;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      style={styles.clipItemRow}
                      onPress={() => {
                        haptics.light();
                        if (onVideoPress) onVideoPress(item);
                      }}
                    >
                      {/* Left Squircle Thumbnail / Icon */}
                      {item.thumbnail_url ? (
                        <Image
                          source={{ uri: item.thumbnail_url }}
                          style={styles.clipItemThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.emptyIconSquircle}>
                          <Ionicons
                            name="document-text-outline"
                            size={22}
                            color="#FFFFFF"
                          />
                        </View>
                      )}

                      {/* Center Meta */}
                      <View style={styles.clipItemCenter}>
                        <Text style={styles.clipItemTitle} numberOfLines={1}>
                          {item.title || "Untitled Clip"}
                        </Text>
                        <View style={styles.clipSubRow}>
                          <Text style={styles.clipTimeText}>
                            {getRelativeTime(item.created_at)}
                          </Text>
                          <View style={styles.miniMetricsRow}>
                            <Text style={styles.miniMetric}>♡ {likes}</Text>
                            <Text style={styles.miniMetric}>💬 {replies}</Text>
                            <Text style={styles.miniMetric}>🔁 {reposts}</Text>
                            <Text style={styles.miniMetric}>↗ 0</Text>
                          </View>
                        </View>
                      </View>

                      {/* Right View Count */}
                      <View style={styles.clipRightCol}>
                        <Text style={styles.clipViewsNum}>{views}</Text>
                        <Text style={styles.clipViewsLabel}>Views</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        ) : (
          /* AUDIENCE / PLATFORMS TAB */
          <View style={styles.audienceContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Platform Sources</Text>
              <Text style={styles.rangeDropdownText}>
                {platformStats.length} Platforms
              </Text>
            </View>

            {/* Platform Bars */}
            <View style={styles.audienceCard}>
              {platformStats.map((p) => (
                <View key={p.key} style={styles.platformBarRow}>
                  <View style={styles.platformNameCol}>
                    <Ionicons
                      name={p.icon}
                      size={16}
                      color={p.color}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.platformLabel}>{p.label}</Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${p.pct}%`, backgroundColor: p.color },
                      ]}
                    />
                  </View>

                  <Text style={styles.platformPct}>{p.pct}%</Text>
                </View>
              ))}
            </View>

            {/* Monthly Calendar Heatmap */}
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
                Activity Calendar
              </Text>
              <ActivityCalendar
                videos={videos}
                selectedDate={selectedDate}
                onSelectDate={onSelectDate}
              />
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Time Range Modals (Screenshot 15-59-34) */}
      <TimeRangeMenu
        visible={showProfileMenu}
        selectedRange={profileRange}
        onSelect={(r) => setProfileRange(r)}
        onClose={() => setShowProfileMenu(false)}
      />

      <TimeRangeMenu
        visible={showPostsMenu}
        selectedRange={postsRange}
        onSelect={(r) => setPostsRange(r)}
        onClose={() => setShowPostsMenu(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  segmentedTabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
    paddingHorizontal: 16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  segmentTabActive: {
    borderBottomColor: "#FFFFFF",
  },
  segmentTabText: {
    fontSize: 15,
    fontWeight: "600",
    color: threadsTokens.colors.textSecondary,
  },
  segmentTabTextActive: {
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rangeDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  rangeDropdownText: {
    fontSize: 14,
    color: threadsTokens.colors.textSecondary,
    fontWeight: "500",
  },
  carouselContainer: {
    gap: 10,
    paddingBottom: 16,
  },
  metricCard: {
    width: 130,
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#222222",
  },
  metricCardLabel: {
    fontSize: 13,
    color: threadsTokens.colors.textSecondary,
    fontWeight: "500",
    marginBottom: 8,
  },
  metricCardValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  metricCardDelta: {
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
    fontWeight: "500",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterPillIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#282828",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#242424",
  },
  filterPillActive: {
    backgroundColor: "#222222",
    borderColor: "#3E3E3E",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  clipsList: {
    gap: 12,
  },
  emptyClipsBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  emptyIconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2A2A2E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emptyMeta: {
    flex: 1,
  },
  emptyTimeText: {
    fontSize: 13,
    color: threadsTokens.colors.textSecondary,
    marginBottom: 4,
  },
  miniMetricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  miniMetric: {
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
  },
  emptyRightCol: {
    alignItems: "flex-end",
  },
  emptyViewsNum: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyViewsLabel: {
    fontSize: 11,
    color: threadsTokens.colors.textSecondary,
  },
  clipItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  clipItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1C1C1E",
    marginRight: 12,
  },
  clipItemCenter: {
    flex: 1,
    marginRight: 12,
  },
  clipItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  clipSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clipTimeText: {
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
  },
  clipRightCol: {
    alignItems: "flex-end",
    minWidth: 40,
  },
  clipViewsNum: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  clipViewsLabel: {
    fontSize: 11,
    color: threadsTokens.colors.textSecondary,
  },
  audienceContainer: {
    paddingTop: 8,
  },
  audienceCard: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222222",
    gap: 14,
  },
  platformBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  platformNameCol: {
    flexDirection: "row",
    alignItems: "center",
    width: 110,
  },
  platformLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#222222",
    overflow: "hidden",
    marginHorizontal: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  platformPct: {
    fontSize: 12,
    fontWeight: "600",
    color: threadsTokens.colors.textSecondary,
    width: 36,
    textAlign: "right",
  },
});
