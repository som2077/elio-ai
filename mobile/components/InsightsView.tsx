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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import { toDateKey } from "../services/dateAnalytics";
import { appleColors } from "../theme/appleTokens";
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

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  onVideoPress,
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

  // 2. Daily Capsule Bar Chart Data Points (Last 7 or 14 days)
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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

  // 3. Platform Distribution Breakdown (Horizontal Progress Bars)
  const platformStats = useMemo(() => {
    const counts: Record<string, number> = {
      youtube: 0,
      instagram: 0,
      twitter: 0,
      tiktok: 0,
      reddit: 0,
    };

    for (const v of inRangeVideos) {
      const p = (v.platform || "").toLowerCase();
      if (counts[p] !== undefined) counts[p]++;
    }

    const meta: Record<string, { label: string; color: string; icon: string }> = {
      youtube: { label: "YouTube", color: "#FF0033", icon: "logo-youtube" },
      instagram: { label: "Instagram", color: "#E1306C", icon: "logo-instagram" },
      twitter: { label: "Twitter / 𝕏", color: "#1D9BF0", icon: "logo-twitter" },
      reddit: { label: "Reddit", color: "#FF4500", icon: "logo-reddit" },
      tiktok: { label: "TikTok", color: "#00F2FE", icon: "musical-notes" },
    };

    const total = inRangeVideos.length;
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        ...(meta[key] || { label: key, color: "#94A3B8", icon: "film-outline" }),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [inRangeVideos]);

  // 4. Activity Streak & 28-Day Intensity Grid
  const { intensityGrid, currentStreak, activeDaysCount } = useMemo(() => {
    const savedMap: Record<string, number> = {};
    for (const v of videos) {
      if (!v.created_at) continue;
      const k = toDateKey(v.created_at);
      savedMap[k] = (savedMap[k] || 0) + 1;
    }

    // 28 days grid (4 weeks)
    const grid: { dateKey: string; count: number }[] = [];
    const now = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);
      grid.push({ dateKey: k, count: savedMap[k] || 0 });
    }

    // Calculate current streak
    let streak = 0;
    const checkDate = new Date(now);
    while (true) {
      const k = toDateKey(checkDate);
      if (savedMap[k] && savedMap[k] > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // If today has 0, check yesterday before breaking
        if (streak === 0 && checkDate.getTime() === now.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yKey = toDateKey(checkDate);
          if (savedMap[yKey] && savedMap[yKey] > 0) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    const activeDays = Object.keys(savedMap).length;

    return {
      intensityGrid: grid,
      currentStreak: streak,
      activeDaysCount: activeDays,
    };
  }, [videos]);

  // 5. Recent 3 Clips
  const recentClips = useMemo(() => {
    return [...videos]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 3);
  }, [videos]);

  // Circular Donut Ring Math
  const ringSize = 116;
  const strokeWidth = 9;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset =
    circumference - (circumference * Math.min(Math.max(metrics.completionRate, 0), 100)) / 100;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. TOP HEADER & TIMEFRAME PILL BAR */}
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
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Analytics</Text>
            <View style={styles.telemetryRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.telemetryText}>Live Vault Telemetry</Text>
            </View>
          </View>
        </View>

        {/* Timeframe Pill Switcher (Inspired by filter buttons in uploaded design) */}
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

      {/* 2. TOP BENTO KPI SUMMARY (Inspired by top row of uploaded design) */}
      <View style={styles.kpiRow}>
        {/* Card 1: Total Saved with Trend */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>TOTAL SAVED</Text>
            <View style={styles.trendBadge}>
              <Ionicons name="trending-up" size={11} color="#10B981" />
              <Text style={styles.trendBadgeText}>+18.4%</Text>
            </View>
          </View>
          <Text style={styles.kpiNumber}>{metrics.totalSaved}</Text>
          <Text style={styles.kpiSub}>Clips added in range</Text>
        </View>

        {/* Card 2: In Queue */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>IN QUEUE</Text>
            <View
              style={[
                styles.iconDotWrap,
                { backgroundColor: "rgba(29, 155, 240, 0.15)" },
              ]}
            >
              <Ionicons name="play" size={11} color="#1D9BF0" />
            </View>
          </View>
          <Text style={[styles.kpiNumber, { color: "#1D9BF0" }]}>
            {metrics.inQueue}
          </Text>
          <Text style={styles.kpiSub}>Ready to watch</Text>
        </View>

        {/* Card 3: Completed */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiLabel}>WATCHED</Text>
            <View
              style={[
                styles.iconDotWrap,
                { backgroundColor: "rgba(16, 185, 129, 0.15)" },
              ]}
            >
              <Ionicons name="checkmark" size={11} color="#10B981" />
            </View>
          </View>
          <Text style={[styles.kpiNumber, { color: "#10B981" }]}>
            {metrics.watched}
          </Text>
          <Text style={styles.kpiSub}>Synthesized clips</Text>
        </View>
      </View>

      {/* 3. CAPSULE VERTICAL BAR CHART (Direct inspiration from "Vertical bar" in image) */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>Daily Activity Columns</Text>
              <View style={styles.chartPillBadge}>
                <Text style={styles.chartPillText}>
                  {timeRange === "7d" ? "7 Days" : "14 Days"}
                </Text>
              </View>
            </View>
            <Text style={styles.chartSubtitle}>
              Shows saved volume across recent days
            </Text>
          </View>

          {selectedBar && (
            <View style={styles.selectedBubble}>
              <Text style={styles.selectedBubbleText}>
                {selectedBar.displayDate}: {selectedBar.saved} clips
              </Text>
            </View>
          )}
        </View>

        {/* Capsule Columns Container */}
        <View style={styles.capsuleBarsRow}>
          {dailyPoints.map((pt) => {
            const isSelected = selectedBar?.dateKey === pt.dateKey;
            const barHeightPct = Math.max(
              Math.round((pt.saved / maxDailyVal) * 100),
              pt.saved > 0 ? 12 : 3,
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
                          ? "#00E5FF"
                          : pt.saved > 0
                          ? "#1D9BF0"
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

      {/* 4. CIRCULAR DOUGHNUT PROGRESS RING (Direct inspiration from "77% Storage / 70% My storage" in image) */}
      <View style={styles.donutCard}>
        <View style={styles.donutHeader}>
          <Text style={styles.chartTitle}>Watch Completion</Text>
          <Text style={styles.chartSubtitle}>Overall vault consumption rate</Text>
        </View>

        <View style={styles.donutContentRow}>
          {/* Circular SVG Ring */}
          <View style={styles.ringWrapper}>
            <Svg width={ringSize} height={ringSize}>
              <Defs>
                <SvgGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#10B981" />
                  <Stop offset="100%" stopColor="#00E5FF" />
                </SvgGradient>
              </Defs>
              {/* Background Track */}
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress Arc */}
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="url(#ringGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={progressOffset}
                strokeLinecap="round"
                fill="transparent"
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </Svg>

            {/* Centered Percentage */}
            <View style={styles.ringCenterText} pointerEvents="none">
              <Text style={styles.ringPercentNum}>{metrics.completionRate}%</Text>
              <Text style={styles.ringPercentLabel}>Finished</Text>
            </View>
          </View>

          {/* Legend Items (Inspired by circular chart legends in uploaded design) */}
          <View style={styles.donutLegendCol}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendName}>Watched</Text>
                <Text style={styles.legendMeta}>{metrics.watched} clips</Text>
              </View>
              <Text style={[styles.legendPct, { color: "#10B981" }]}>
                {metrics.completionRate}%
              </Text>
            </View>

            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: "#1D9BF0" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendName}>In Queue</Text>
                <Text style={styles.legendMeta}>{metrics.inQueue} clips</Text>
              </View>
              <Text style={[styles.legendPct, { color: "#1D9BF0" }]}>
                {100 - metrics.completionRate}%
              </Text>
            </View>

            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: "#A855F7" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendName}>Favorites</Text>
                <Text style={styles.legendMeta}>{metrics.favorites} clips</Text>
              </View>
              <Text style={[styles.legendPct, { color: "#A855F7" }]}>
                {metrics.totalSaved > 0
                  ? Math.round((metrics.favorites / metrics.totalSaved) * 100)
                  : 0}
                %
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. HORIZONTAL CAPSULE PROGRESS BARS (Platform Breakdown — inspired by "Horizontal bar chart" in image) */}
      <View style={styles.platformCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Platform Distribution</Text>
          <Text style={styles.chartSubtitle}>
            Clips categorized by social media network
          </Text>
        </View>

        {platformStats.length === 0 ? (
          <View style={styles.emptyCardBox}>
            <Ionicons name="film-outline" size={24} color="#64748B" />
            <Text style={styles.emptyCardText}>No clips in this timeframe</Text>
          </View>
        ) : (
          platformStats.map((item) => (
            <View key={item.key} style={styles.platformItemRow}>
              <View style={styles.platformTopMeta}>
                <View style={styles.platformLeftTitle}>
                  <View
                    style={[styles.platformColorDot, { backgroundColor: item.color }]}
                  />
                  <Text style={styles.platformLabel}>{item.label}</Text>
                </View>

                <View style={styles.platformRightMeta}>
                  <Text style={styles.platformCountText}>{item.count} clips</Text>
                  <View
                    style={[
                      styles.platformPctPill,
                      { backgroundColor: `${item.color}22` },
                    ]}
                  >
                    <Text
                      style={[styles.platformPctText, { color: item.color }]}
                    >
                      {item.pct}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Horizontal Capsule Rounded Progress Track */}
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

      {/* 6. ACTIVITY STREAK & INTENSITY MATRIX (Inspired by "Contributions" grid in image) */}
      <View style={styles.intensityCard}>
        <View style={styles.intensityHeader}>
          <View>
            <Text style={styles.chartTitle}>Activity Intensity</Text>
            <Text style={styles.chartSubtitle}>28-Day Consistency Matrix</Text>
          </View>

          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color="#F59E0B" />
            <Text style={styles.streakPillText}>{currentStreak} Day Streak</Text>
          </View>
        </View>

        {/* 28-Day Heat Squares Grid */}
        <View style={styles.intensityGrid}>
          {intensityGrid.map((item, idx) => {
            let bg = "rgba(255, 255, 255, 0.05)";
            if (item.count >= 4) bg = "#00E5FF";
            else if (item.count >= 2) bg = "rgba(0, 229, 255, 0.65)";
            else if (item.count === 1) bg = "rgba(0, 229, 255, 0.30)";

            return (
              <View
                key={`${item.dateKey}-${idx}`}
                style={[styles.intensityBox, { backgroundColor: bg }]}
              />
            );
          })}
        </View>

        {/* Intensity Legend */}
        <View style={styles.intensityLegendRow}>
          <Text style={styles.intensityLegendText}>Less</Text>
          <View
            style={[
              styles.intensityLegendSquare,
              { backgroundColor: "rgba(255, 255, 255, 0.05)" },
            ]}
          />
          <View
            style={[
              styles.intensityLegendSquare,
              { backgroundColor: "rgba(0, 229, 255, 0.30)" },
            ]}
          />
          <View
            style={[
              styles.intensityLegendSquare,
              { backgroundColor: "rgba(0, 229, 255, 0.65)" },
            ]}
          />
          <View
            style={[
              styles.intensityLegendSquare,
              { backgroundColor: "#00E5FF" },
            ]}
          />
          <Text style={styles.intensityLegendText}>More</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.intensityTotalText}>
            {activeDaysCount} active days recorded
          </Text>
        </View>
      </View>

      {/* 7. RECENT CLIPS STREAM */}
      {recentClips.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentSectionTitle}>RECENT HIGHLIGHTS</Text>
          {recentClips.map((clip) => (
            <TouchableOpacity
              key={clip.id}
              activeOpacity={0.8}
              style={styles.recentClipCard}
              onPress={() => {
                haptics.selection();
                if (onVideoPress) onVideoPress(clip);
              }}
            >
              {clip.thumbnail_url ? (
                <Image
                  source={{ uri: clip.thumbnail_url }}
                  style={styles.clipThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.clipThumbnail, styles.clipThumbPlaceholder]}>
                  <Ionicons name="film-outline" size={18} color="#94A3B8" />
                </View>
              )}

              <View style={styles.clipInfoCol}>
                <Text style={styles.clipTitleText} numberOfLines={1}>
                  {clip.title || "Untitled Video Clip"}
                </Text>
                <Text style={styles.clipCreatorText}>
                  {clip.creator_name || "Unknown"} • {clip.platform}
                </Text>
              </View>

              <View
                style={[
                  styles.clipStatusPill,
                  clip.status === "watched"
                    ? styles.statusWatched
                    : styles.statusQueue,
                ]}
              >
                <Text
                  style={[
                    styles.clipStatusText,
                    clip.status === "watched"
                      ? { color: "#10B981" }
                      : { color: "#38BDF8" },
                  ]}
                >
                  {clip.status === "watched" ? "Watched" : "In Queue"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 110 }} />
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
    paddingTop: 12,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  telemetryText: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "500",
  },
  timeframeBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timeframePill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  timeframePillActive: {
    backgroundColor: "#1D9BF0",
  },
  timeframePillText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  timeframePillTextActive: {
    color: "#FFFFFF",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#16161A",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.14)",
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kpiLabel: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  trendBadgeText: {
    color: "#10B981",
    fontSize: 9.5,
    fontWeight: "800",
  },
  iconDotWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiNumber: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  kpiSub: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: "#16161A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  chartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  chartPillBadge: {
    backgroundColor: "rgba(29, 155, 240, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chartPillText: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "700",
  },
  chartSubtitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  selectedBubble: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "rgba(0, 229, 255, 0.3)",
  },
  selectedBubbleText: {
    color: "#00E5FF",
    fontSize: 11,
    fontWeight: "700",
  },
  capsuleBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 126,
    paddingTop: 8,
  },
  capsuleBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  capsuleBarVal: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    height: 14,
    marginBottom: 4,
  },
  capsuleBarValActive: {
    color: "#00E5FF",
    fontWeight: "800",
  },
  capsuleTrack: {
    width: 14,
    height: 82,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  capsuleFill: {
    width: "100%",
    borderRadius: 7,
  },
  capsuleDayLabel: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 6,
  },
  capsuleDayLabelActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  donutCard: {
    backgroundColor: "#16161A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
  },
  donutHeader: {
    marginBottom: 14,
  },
  donutContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  ringWrapper: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenterText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringPercentNum: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  ringPercentLabel: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: -1,
  },
  donutLegendCol: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  legendMeta: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "500",
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  platformCard: {
    backgroundColor: "#16161A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
  },
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
  platformColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  platformPctPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  platformPctText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  horizontalBarTrack: {
    width: "100%",
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  horizontalBarFill: {
    height: "100%",
    borderRadius: 3.5,
  },
  emptyCardBox: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyCardText: {
    color: "#64748B",
    fontSize: 12,
  },
  intensityCard: {
    backgroundColor: "#16161A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
  },
  intensityHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  streakPillText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
  },
  intensityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5.5,
    justifyContent: "space-between",
    marginBottom: 12,
  },
  intensityBox: {
    width: (Dimensions.get("window").width - 32 - 32 - 7 * 5.5) / 7,
    height: 18,
    borderRadius: 4.5,
  },
  intensityLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  intensityLegendText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  intensityLegendSquare: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
  },
  intensityTotalText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  recentSection: {
    marginTop: 6,
  },
  recentSectionTitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentClipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161A",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 8,
    gap: 12,
  },
  clipThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  clipThumbPlaceholder: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  clipInfoCol: {
    flex: 1,
  },
  clipTitleText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  clipCreatorText: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
    textTransform: "capitalize",
  },
  clipStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusWatched: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  statusQueue: {
    backgroundColor: "rgba(29, 155, 240, 0.12)",
  },
  clipStatusText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
});
