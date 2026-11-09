import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PikaIcon } from "./PikaIcon";
import { PlatformIcon, PLATFORM_BRAND_COLORS } from "./PlatformIcon";
import { SavedVideo } from "../types/video";
import { toDateKey } from "../services/dateAnalytics";
import { haptics } from "../utils/haptics";

export type TimeRangeFilter = "7d" | "14d" | "30d" | "all";

export interface InsightsViewProps {
  videos: SavedVideo[];
  selectedDate?: string | null;
  onSelectDate?: (dateKey: string | null) => void;
  onVideoPress?: (video: SavedVideo) => void;
  onBack?: () => void;
}

interface DailyBarPoint {
  dateKey: string;
  displayDate: string;
  saved: number;
  watched: number;
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  twitter: "Twitter / 𝕏",
  x: "Twitter / 𝕏",
  tiktok: "TikTok",
  reddit: "Reddit",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
};

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  onBack,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("7d");
  const [selectedBar, setSelectedBar] = useState<DailyBarPoint | null>(null);

  const getDaysCount = (r: TimeRangeFilter): number => {
    switch (r) {
      case "7d":
        return 7;
      case "14d":
        return 14;
      case "30d":
        return 30;
      case "all":
        return 90;
      default:
        return 7;
    }
  };

  // 1. Filtered videos & Core KPI metrics for the selected time range
  const { metrics, inRangeVideos } = useMemo(() => {
    const days = getDaysCount(timeRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = toDateKey(cutoff);

    const inRange =
      timeRange === "all"
        ? videos
        : videos.filter((v) => toDateKey(v.created_at) >= cutoffKey);

    const totalSaved = inRange.length;
    const watched = inRange.filter((v) => v.status === "watched").length;
    const inQueue = inRange.filter((v) => v.status === "unread").length;
    const favorites = inRange.filter((v) => v.is_favorite).length;
    const completionRate =
      totalSaved > 0 ? Math.round((watched / totalSaved) * 100) : 0;

    return {
      inRangeVideos: inRange,
      metrics: {
        totalSaved,
        watched,
        inQueue,
        favorites,
        completionRate,
      },
    };
  }, [videos, timeRange]);

  // 2. Daily Bar Chart Data Points (Last 7 or 14 days)
  const dailyPoints: DailyBarPoint[] = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 7;
    const savedMap: Record<string, number> = {};
    const watchedMap: Record<string, number> = {};

    for (const v of videos) {
      if (!v.created_at) continue;
      const k = toDateKey(v.created_at);
      savedMap[k] = (savedMap[k] || 0) + 1;
      if (v.status === "watched") {
        const wk = toDateKey(v.updated_at || v.created_at);
        watchedMap[wk] = (watchedMap[wk] || 0) + 1;
      }
    }

    const points: DailyBarPoint[] = [];
    const now = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);
      const displayDate =
        days === 7
          ? dayNames[d.getDay()]
          : `${d.getDate()} ${monthNames[d.getMonth()]}`;

      points.push({
        dateKey: k,
        displayDate,
        saved: savedMap[k] || 0,
        watched: watchedMap[k] || 0,
      });
    }

    return points;
  }, [videos, timeRange]);

  const maxDailyVal = useMemo(() => {
    const maxVal = Math.max(...dailyPoints.map((p) => p.saved), 1);
    return Math.max(maxVal, 4);
  }, [dailyPoints]);

  // 3. Platform Breakdown with Official Brand Colors
  const platformStats = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const v of inRangeVideos) {
      let p = (v.platform || "").toLowerCase();
      if (p === "twitter") p = "x";
      if (!p) continue;
      counts[p] = (counts[p] || 0) + 1;
    }

    const total = inRangeVideos.length;
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        label: PLATFORM_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1),
        color: PLATFORM_BRAND_COLORS[key] || "#FFFFFF",
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [inRangeVideos]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
      {/* 1. TOP HEADER & TIMEFRAME SWITCHER */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backBtn}
              onPress={() => {
                haptics.light();
                onBack();
              }}
            >
              <Ionicons name="arrow-back" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Insights</Text>
            <Text style={styles.headerSubtitle}>
              {metrics.totalSaved === 0
                ? "No clips saved"
                : `${metrics.totalSaved} ${metrics.totalSaved === 1 ? "clip" : "clips"} in vault`}
            </Text>
          </View>
        </View>

        {/* Apple Style Timeframe Pill Bar */}
        <View style={styles.timeframeBar}>
          {(["7d", "14d", "30d", "all"] as TimeRangeFilter[]).map((r) => {
            const isActive = timeRange === r;
            const label = r === "all" ? "ALL" : r.toUpperCase();
            return (
              <TouchableOpacity
                key={r}
                activeOpacity={0.8}
                style={[
                  styles.timeframePill,
                  isActive && styles.timeframePillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setTimeRange(r);
                  setSelectedBar(null);
                }}
              >
                <Text
                  style={[
                    styles.timeframePillText,
                    isActive && styles.timeframePillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. 2x2 APPLE BENTO METRIC CARDS */}
      <View style={styles.bentoGrid}>
        {/* Row 1 */}
        <View style={styles.bentoRow}>
          {/* Card 1: Total Saved */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>TOTAL SAVED</Text>
              <View style={styles.bentoIconBadge}>
                <PikaIcon name="film" size={12} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{metrics.totalSaved}</Text>
            <Text style={styles.bentoSub}>Clips added</Text>
          </View>

          {/* Card 2: In Queue */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>IN QUEUE</Text>
              <View style={styles.bentoIconBadge}>
                <Ionicons name="play" size={11} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{metrics.inQueue}</Text>
            <Text style={styles.bentoSub}>Ready to watch</Text>
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.bentoRow}>
          {/* Card 3: Watched */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>WATCHED</Text>
              <View
                style={[
                  styles.bentoIconBadge,
                  { backgroundColor: "rgba(16, 185, 129, 0.16)" },
                ]}
              >
                <Ionicons name="checkmark" size={12} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: "#FFFFFF" }]}>
              {metrics.watched}
            </Text>
            <Text style={styles.bentoSub}>Completed clips</Text>
          </View>

          {/* Card 4: Watch Completion Rate */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>COMPLETION</Text>
              <View style={styles.bentoIconBadge}>
                <Ionicons name="pie-chart" size={11} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.bentoNumber}>{metrics.completionRate}%</Text>
            <Text style={styles.bentoSub}>
              {metrics.favorites > 0
                ? `${metrics.favorites} favorites`
                : "Vault watch rate"}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. REFINED DAILY ACTIVITY BAR CHART */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Activity</Text>
            <Text style={styles.cardSubtitle}>
              {timeRange === "7d" ? "Past 7 days" : "Past 14 days"} volume
            </Text>
          </View>

          {selectedBar && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.selectedBubble}
              onPress={() => setSelectedBar(null)}
            >
              <Text style={styles.selectedBubbleText}>
                {selectedBar.displayDate}: {selectedBar.saved}{" "}
                {selectedBar.saved === 1 ? "clip" : "clips"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Capsule Columns Row */}
        <View style={styles.capsuleBarsRow}>
          {dailyPoints.map((pt) => {
            const isSelected = selectedBar?.dateKey === pt.dateKey;
            const barHeightPct = Math.max(
              Math.round((pt.saved / maxDailyVal) * 100),
              pt.saved > 0 ? 14 : 3,
            );

            return (
              <TouchableOpacity
                key={pt.dateKey}
                activeOpacity={0.75}
                style={styles.capsuleBarCol}
                onPress={() => {
                  haptics.selection();
                  setSelectedBar(isSelected ? null : pt);
                }}
              >
                {/* Micro count indicator above the capsule */}
                <Text
                  style={[
                    styles.capsuleBarVal,
                    isSelected && styles.capsuleBarValActive,
                  ]}
                >
                  {pt.saved > 0 ? pt.saved : ""}
                </Text>

                {/* Capsule Pill Track */}
                <View style={styles.capsuleTrack}>
                  <View
                    style={[
                      styles.capsuleFill,
                      {
                        height: `${barHeightPct}%`,
                        backgroundColor: isSelected
                          ? "#FFFFFF"
                          : pt.saved > 0
                          ? "rgba(255, 255, 255, 0.85)"
                          : "rgba(255, 255, 255, 0.08)",
                      },
                    ]}
                  />
                </View>

                {/* Day of Week Label */}
                <Text
                  style={[
                    styles.capsuleDayLabel,
                    isSelected && styles.capsuleDayLabelActive,
                  ]}
                >
                  {pt.displayDate}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. WATCH RATIO SEGMENTED PROGRESS CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Watch Ratio</Text>
            <Text style={styles.cardSubtitle}>
              {metrics.watched} of {metrics.totalSaved} clips watched
            </Text>
          </View>
          <View style={styles.completionPill}>
            <Text style={styles.completionPillText}>
              {metrics.completionRate}%
            </Text>
          </View>
        </View>

        {/* Multi-Segment Horizontal Pill Track */}
        <View style={styles.watchSegmentTrack}>
          <View
            style={[
              styles.watchSegmentFillWatched,
              { width: `${Math.max(metrics.completionRate, 0)}%` },
            ]}
          />
        </View>

        {/* Segment Legend Stats */}
        <View style={styles.watchLegendRow}>
          <View style={styles.watchLegendItem}>
            <View
              style={[styles.watchLegendDot, { backgroundColor: "#10B981" }]}
            />
            <Text style={styles.watchLegendLabel}>Watched</Text>
            <Text style={styles.watchLegendValue}>{metrics.watched}</Text>
          </View>

          <View style={styles.watchLegendItem}>
            <View
              style={[
                styles.watchLegendDot,
                { backgroundColor: "rgba(255, 255, 255, 0.25)" },
              ]}
            />
            <Text style={styles.watchLegendLabel}>In Queue</Text>
            <Text style={styles.watchLegendValue}>{metrics.inQueue}</Text>
          </View>

          {metrics.favorites > 0 && (
            <View style={styles.watchLegendItem}>
              <View
                style={[styles.watchLegendDot, { backgroundColor: "#EAB308" }]}
              />
              <Text style={styles.watchLegendLabel}>Favorites</Text>
              <Text style={styles.watchLegendValue}>{metrics.favorites}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 5. PLATFORM DISTRIBUTION BREAKDOWN */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Platforms</Text>
            <Text style={styles.cardSubtitle}>Saved clips by source</Text>
          </View>
        </View>

        {platformStats.length === 0 ? (
          <View style={styles.emptyCardBox}>
            <Ionicons name="film-outline" size={22} color="#71767B" />
            <Text style={styles.emptyCardText}>No clips in this timeframe</Text>
          </View>
        ) : (
          platformStats.map((item) => (
            <View key={item.key} style={styles.platformItemRow}>
              <View style={styles.platformTopMeta}>
                <View style={styles.platformLeftTitle}>
                  <PlatformIcon platform={item.key} size={16} />
                  <Text style={styles.platformLabel}>{item.label}</Text>
                </View>

                <View style={styles.platformRightMeta}>
                  <Text style={styles.platformCountText}>
                    {item.count} {item.count === 1 ? "clip" : "clips"}
                  </Text>
                  <Text style={styles.platformPctText}>{item.pct}%</Text>
                </View>
              </View>

              {/* Sleek Horizontal Progress Track */}
              <View style={styles.horizontalBarTrack}>
                <View
                  style={[
                    styles.horizontalBarFill,
                    {
                      width: `${item.pct}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
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
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // 1. TOP HEADER & TIMEFRAME PILL BAR
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: "#71767B",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  timeframeBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timeframePill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 10,
  },
  timeframePillActive: {
    backgroundColor: "#FFFFFF",
  },
  timeframePillText: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "700",
  },
  timeframePillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },

  // 2. 2x2 BENTO GRID
  bentoGrid: {
    gap: 10,
    marginBottom: 14,
  },
  bentoRow: {
    flexDirection: "row",
    gap: 10,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: "#111215",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  bentoCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bentoLabel: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bentoIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  bentoNumber: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  bentoSub: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },

  // SECTION CARDS (Shared Card Container)
  sectionCard: {
    backgroundColor: "#111215",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: "#71767B",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },

  // 3. DAILY ACTIVITY BAR CHART
  selectedBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectedBubbleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  capsuleBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    paddingTop: 8,
  },
  capsuleBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  capsuleBarVal: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "700",
    height: 14,
    marginBottom: 4,
  },
  capsuleBarValActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  capsuleTrack: {
    width: 14,
    height: 78,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  capsuleFill: {
    width: "100%",
    borderRadius: 7,
  },
  capsuleDayLabel: {
    color: "#71767B",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 6,
  },
  capsuleDayLabelActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // 4. WATCH RATIO SEGMENTED PROGRESS
  completionPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completionPillText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800",
  },
  watchSegmentTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    overflow: "hidden",
    marginBottom: 12,
  },
  watchSegmentFillWatched: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  watchLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  watchLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  watchLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  watchLegendLabel: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "500",
  },
  watchLegendValue: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },

  // 5. PLATFORM BREAKDOWN
  platformItemRow: {
    marginBottom: 14,
  },
  platformTopMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  platformLeftTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  platformLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  platformRightMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  platformCountText: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "600",
  },
  platformPctText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  horizontalBarTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  horizontalBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  emptyCardBox: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyCardText: {
    color: "#71767B",
    fontSize: 12,
  },
});
