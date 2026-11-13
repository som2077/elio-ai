import React, { useState, useMemo, useEffect } from "react";
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
import { toDateKey, formatDisplayDate } from "../services/dateAnalytics";
import { haptics } from "../utils/haptics";
import { supabase } from "../services/supabase";

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

interface HeatmapDay {
  dateKey: string;
  count: number;
  level: number; // 0..4
  displayDate: string;
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
  threads: "Threads",
  snapchat: "Snapchat",
};

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  selectedDate,
  onSelectDate,
  onBack,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("7d");
  const [selectedBar, setSelectedBar] = useState<DailyBarPoint | null>(null);
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapDay | null>(null);
  const [backendInsights, setBackendInsights] = useState<any>(null);

  // Fetch pre-computed telemetry from backend RPC get_user_insights_v1
  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        supabase
          .rpc("get_user_insights_v1", {
            p_user_id: user.id,
            p_time_range: timeRange,
          })
          .then(({ data, error }) => {
            if (!error && data && isMounted) {
              setBackendInsights(data);
            }
          });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [timeRange]);

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

  // 1. Client-side Metrics Fallback Calculation
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
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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

  // 3. 28-Day Heatmap Fallback Calculation
  const fallbackHeatmap: HeatmapDay[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of videos) {
      if (!v.created_at) continue;
      const k = toDateKey(v.created_at);
      counts[k] = (counts[k] || 0) + 1;
    }

    const days: HeatmapDay[] = [];
    const now = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);
      const count = counts[k] || 0;
      let level = 0;
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      days.push({
        dateKey: k,
        count,
        level,
        displayDate: formatDisplayDate(k),
      });
    }
    return days;
  }, [videos]);

  // 4. Streaks Fallback Calculation
  const fallbackStreaks = useMemo(() => {
    const activeDates = new Set<string>();
    for (const v of videos) {
      if (v.created_at) {
        activeDates.add(toDateKey(v.created_at));
      }
    }

    let current = 0;
    let best = 0;
    let temp = 0;
    const now = new Date();

    // Check today & consecutive days backwards for current streak
    let checkDate = new Date(now);
    if (!activeDates.has(toDateKey(checkDate))) {
      // Check yesterday if today hasn't had activity yet
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (activeDates.has(toDateKey(checkDate))) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Best streak across all dates
    const sortedDates = Array.from(activeDates).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        temp = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / (1000 * 3600 * 24),
        );
        if (diffDays === 1) {
          temp++;
        } else {
          temp = 1;
        }
      }
      if (temp > best) best = temp;
    }
    best = Math.max(best, current);

    return { currentStreak: current, bestStreak: best };
  }, [videos]);

  // 5. Effective Metrics (Backend RPC merged with client memo)
  const effectiveMetrics = useMemo(() => {
    const m = backendInsights?.metrics;
    if (!m) return metrics;
    return {
      totalSaved: m.totalSaved ?? m.total_saved ?? metrics.totalSaved ?? 0,
      watched: m.watched ?? metrics.watched ?? 0,
      inQueue: m.inQueue ?? m.in_queue ?? metrics.inQueue ?? 0,
      favorites: m.favorites ?? metrics.favorites ?? 0,
      completionRate:
        m.completionRate ?? m.completion_rate ?? metrics.completionRate ?? 0,
    };
  }, [backendInsights?.metrics, metrics]);

  const effectiveDailyPoints: DailyBarPoint[] = useMemo(() => {
    if (
      backendInsights?.dailyPoints &&
      Array.isArray(backendInsights.dailyPoints)
    ) {
      return backendInsights.dailyPoints.map((p: any, idx: number) => ({
        dateKey: p.dateKey || p.date_key || `day-${idx}`,
        displayDate:
          p.displayDate ||
          p.display_date ||
          p.dateKey ||
          p.date_key ||
          `Day ${idx + 1}`,
        saved: p.saved ?? p.saved_count ?? 0,
        watched: p.watched ?? p.watched_count ?? 0,
      }));
    }
    return dailyPoints;
  }, [backendInsights?.dailyPoints, dailyPoints]);

  const effectiveMaxDailyVal = useMemo(() => {
    const maxVal = Math.max(...effectiveDailyPoints.map((p) => p.saved), 1);
    return Math.max(maxVal, 4);
  }, [effectiveDailyPoints]);

  const averageDailySaves = useMemo(() => {
    if (effectiveDailyPoints.length === 0) return 0;
    const sum = effectiveDailyPoints.reduce((acc, p) => acc + p.saved, 0);
    return (sum / effectiveDailyPoints.length).toFixed(1);
  }, [effectiveDailyPoints]);

  const effectivePlatformStats = useMemo(() => {
    if (
      backendInsights?.platformStats &&
      Array.isArray(backendInsights.platformStats)
    ) {
      return backendInsights.platformStats.map((p: any, idx: number) => {
        const platformKey = p.key || p.platform || `platform-${idx}`;
        return {
          key: platformKey,
          count: p.count ?? p.p_count ?? 0,
          pct: p.pct ?? p.percentage ?? 0,
          label:
            p.label ||
            PLATFORM_NAMES[platformKey] ||
            platformKey.charAt(0).toUpperCase() + platformKey.slice(1),
          color: p.color || PLATFORM_BRAND_COLORS[platformKey] || "#FFFFFF",
        };
      });
    }

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
        label:
          PLATFORM_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1),
        color: PLATFORM_BRAND_COLORS[key] || "#FFFFFF",
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [backendInsights?.platformStats, inRangeVideos]);

  const effectiveHeatmap: HeatmapDay[] = useMemo(() => {
    if (
      backendInsights?.heatmapMatrix &&
      Array.isArray(backendInsights.heatmapMatrix) &&
      backendInsights.heatmapMatrix.length > 0
    ) {
      return backendInsights.heatmapMatrix.map((item: any) => ({
        dateKey: item.dateKey || item.date_key,
        count: item.count || 0,
        level: item.level || 0,
        displayDate: formatDisplayDate(item.dateKey || item.date_key),
      }));
    }
    return fallbackHeatmap;
  }, [backendInsights?.heatmapMatrix, fallbackHeatmap]);

  const effectiveStreaks = useMemo(() => {
    return {
      currentStreak:
        backendInsights?.streaks?.currentStreak ??
        fallbackStreaks.currentStreak ??
        0,
      bestStreak:
        backendInsights?.streaks?.bestStreak ??
        fallbackStreaks.bestStreak ??
        0,
    };
  }, [backendInsights?.streaks, fallbackStreaks]);

  // AI Readiness Count (Videos with full AI digests or embeddings)
  const aiReadyCount = useMemo(() => {
    return videos.filter(
      (v) => (v as any).ai_metadata?.tldw || (v as any).ai_metadata?.id,
    ).length;
  }, [videos]);

  const getHeatmapColor = (level: number) => {
    switch (level) {
      case 4:
        return "#00E5FF";
      case 3:
        return "rgba(0, 229, 255, 0.75)";
      case 2:
        return "rgba(0, 229, 255, 0.48)";
      case 1:
        return "rgba(0, 229, 255, 0.22)";
      default:
        return "rgba(255, 255, 255, 0.05)";
    }
  };

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
            <Text style={styles.headerTitle}>Activity & Insights</Text>
            <Text style={styles.headerSubtitle}>
              {effectiveMetrics.totalSaved === 0
                ? "No clips saved yet"
                : `${effectiveMetrics.totalSaved} clips analyzed in vault`}
            </Text>
          </View>
        </View>

        {/* Mobbin-style Glass Segmented Timeframe Switcher */}
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
                  setSelectedHeatmapCell(null);
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

      {/* 2. HERO SPOTLIGHT DISPLAY CARD */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroPreLabel}>COLLECTION VELOCITY</Text>
            <View style={styles.heroBigNumberRow}>
              <Text style={styles.heroBigNumber}>
                {effectiveMetrics.totalSaved}
              </Text>
              <Text style={styles.heroUnits}>Clips</Text>
            </View>
          </View>

          {/* Active Streak Glow Pill */}
          <View style={styles.heroStreakPill}>
            <Text style={styles.heroStreakFlame}>🔥</Text>
            <View>
              <Text style={styles.heroStreakTitle}>
                {effectiveStreaks.currentStreak} Day
                {effectiveStreaks.currentStreak === 1 ? "" : "s"}
              </Text>
              <Text style={styles.heroStreakSub}>Current Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroBottomRow}>
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaLabel}>Best Streak</Text>
            <Text style={styles.heroMetaValue}>
              ⚡ {effectiveStreaks.bestStreak} Days
            </Text>
          </View>

          <View style={styles.heroMetaDot} />

          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaLabel}>Daily Average</Text>
            <Text style={styles.heroMetaValue}>
              📊 {averageDailySaves} / day
            </Text>
          </View>

          <View style={styles.heroMetaDot} />

          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaLabel}>Completion</Text>
            <Text style={[styles.heroMetaValue, { color: "#10B981" }]}>
              ✓ {effectiveMetrics.completionRate}%
            </Text>
          </View>
        </View>
      </View>

      {/* 3. 2x2 APPLE BENTO METRIC CARDS */}
      <View style={styles.bentoGrid}>
        {/* Row 1 */}
        <View style={styles.bentoRow}>
          {/* Card 1: Total Saved */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>TOTAL SAVED</Text>
              <View style={styles.bentoIconBadge}>
                <PikaIcon name="film" size={13} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.bentoNumber}>
              {effectiveMetrics.totalSaved}
            </Text>
            <Text style={styles.bentoSub}>Clips in timeframe</Text>
          </View>

          {/* Card 2: In Queue */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>IN QUEUE</Text>
              <View
                style={[
                  styles.bentoIconBadge,
                  { backgroundColor: "rgba(0, 229, 255, 0.15)" },
                ]}
              >
                <Ionicons name="play" size={12} color="#00E5FF" />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: "#00E5FF" }]}>
              {effectiveMetrics.inQueue}
            </Text>
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
                  { backgroundColor: "rgba(16, 185, 129, 0.18)" },
                ]}
              >
                <Ionicons name="checkmark" size={13} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: "#10B981" }]}>
              {effectiveMetrics.watched}
            </Text>
            <Text style={styles.bentoSub}>Completed clips</Text>
          </View>

          {/* Card 4: Favorites & AI */}
          <View style={styles.bentoCard}>
            <View style={styles.bentoCardTop}>
              <Text style={styles.bentoLabel}>STARRED & AI</Text>
              <View
                style={[
                  styles.bentoIconBadge,
                  { backgroundColor: "rgba(245, 158, 11, 0.18)" },
                ]}
              >
                <Ionicons name="heart" size={12} color="#F59E0B" />
              </View>
            </View>
            <Text style={[styles.bentoNumber, { color: "#F59E0B" }]}>
              {effectiveMetrics.favorites}
            </Text>
            <Text style={styles.bentoSub}>
              {aiReadyCount} AI indexed
            </Text>
          </View>
        </View>
      </View>

      {/* 4. REFINED DAILY ACTIVITY BAR CHART (Copilot / Apple Health style) */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Daily Activity</Text>
            <Text style={styles.cardSubtitle}>
              {timeRange === "7d" ? "Past 7 days" : "Past 14 days"} volume
            </Text>
          </View>

          {/* Average Reference Badge */}
          <View style={styles.avgBadge}>
            <Text style={styles.avgBadgeText}>Avg: {averageDailySaves}/d</Text>
          </View>
        </View>

        {/* Interactive Floating Detail HUD */}
        {selectedBar && (
          <View style={styles.selectedBubbleHUD}>
            <View style={styles.selectedBubbleLeft}>
              <Text style={styles.selectedBubbleDate}>
                {selectedBar.displayDate} ({selectedBar.dateKey})
              </Text>
              <Text style={styles.selectedBubbleStats}>
                <Text style={{ color: "#00E5FF", fontWeight: "800" }}>
                  {selectedBar.saved} Saved
                </Text>
                {"  •  "}
                <Text style={{ color: "#10B981", fontWeight: "700" }}>
                  {selectedBar.watched} Watched
                </Text>
              </Text>
            </View>

            {onSelectDate && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.filterFeedBtn}
                onPress={() => {
                  haptics.selection();
                  onSelectDate(
                    selectedDate === selectedBar.dateKey
                      ? null
                      : selectedBar.dateKey,
                  );
                }}
              >
                <Text style={styles.filterFeedBtnText}>
                  {selectedDate === selectedBar.dateKey ? "Clear" : "Filter"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Capsule Columns Row */}
        <View style={styles.capsuleBarsRow}>
          {effectiveDailyPoints.map((pt, idx) => {
            const isSelected = selectedBar?.dateKey === pt.dateKey;
            const barHeightPct = Math.max(
              Math.round((pt.saved / effectiveMaxDailyVal) * 100),
              pt.saved > 0 ? 16 : 4,
            );
            const watchedHeightPct =
              pt.saved > 0
                ? Math.min(Math.round((pt.watched / pt.saved) * 100), 100)
                : 0;

            return (
              <TouchableOpacity
                key={pt.dateKey || `daily-bar-${idx}`}
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
                <View
                  style={[
                    styles.capsuleTrack,
                    isSelected && styles.capsuleTrackActive,
                  ]}
                >
                  {/* Saved Fill Pill */}
                  <View
                    style={[
                      styles.capsuleFill,
                      {
                        height: `${barHeightPct}%`,
                        backgroundColor: isSelected
                          ? "#FFFFFF"
                          : pt.saved > 0
                            ? "#00E5FF"
                            : "rgba(255, 255, 255, 0.08)",
                      },
                    ]}
                  >
                    {/* Inner Watched Portion Indicator */}
                    {pt.watched > 0 && !isSelected && (
                      <View
                        style={[
                          styles.capsuleWatchedSubFill,
                          { height: `${watchedHeightPct}%` },
                        ]}
                      />
                    )}
                  </View>
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

        {/* Dual Chart Legend */}
        <View style={styles.chartLegendFooter}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#00E5FF" }]} />
            <Text style={styles.legendLabel}>Saved</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.legendLabel}>Watched</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FFFFFF" }]} />
            <Text style={styles.legendLabel}>Selected</Text>
          </View>
        </View>
      </View>

      {/* 5. 28-DAY CONSISTENCY HEATMAP (GitHub / Opal style) */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>28-Day Heatmap</Text>
            <Text style={styles.cardSubtitle}>
              Consistency & habit momentum
            </Text>
          </View>

          <View style={styles.heatmapStreakBadge}>
            <Text style={styles.heatmapStreakText}>
              🔥 {effectiveStreaks.currentStreak}d Streak
            </Text>
          </View>
        </View>

        {/* Heatmap Tooltip on Cell Tap */}
        {selectedHeatmapCell && (
          <View style={styles.heatmapTooltipHUD}>
            <Text style={styles.heatmapTooltipDate}>
              {selectedHeatmapCell.displayDate}:
            </Text>
            <Text style={styles.heatmapTooltipCount}>
              {selectedHeatmapCell.count}{" "}
              {selectedHeatmapCell.count === 1 ? "clip saved" : "clips saved"}
            </Text>
            {onSelectDate && selectedHeatmapCell.count > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.heatmapFilterBtn}
                onPress={() => {
                  haptics.selection();
                  onSelectDate(
                    selectedDate === selectedHeatmapCell.dateKey
                      ? null
                      : selectedHeatmapCell.dateKey,
                  );
                }}
              >
                <Text style={styles.heatmapFilterBtnText}>
                  {selectedDate === selectedHeatmapCell.dateKey
                    ? "Clear Filter"
                    : "Filter Vault"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 28-Day Grid (4 weeks x 7 days) */}
        <View style={styles.heatmapGrid}>
          {effectiveHeatmap.map((cell, idx) => {
            const isSelected =
              selectedHeatmapCell?.dateKey === cell.dateKey ||
              selectedDate === cell.dateKey;
            return (
              <TouchableOpacity
                key={cell.dateKey || `heatmap-cell-${idx}`}
                activeOpacity={0.7}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: getHeatmapColor(cell.level) },
                  isSelected && styles.heatmapCellSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedHeatmapCell(isSelected ? null : cell);
                }}
              />
            );
          })}
        </View>

        {/* Heatmap Scale Legend */}
        <View style={styles.heatmapLegendRow}>
          <Text style={styles.heatmapLegendText}>Less</Text>
          <View style={styles.heatmapScaleBoxes}>
            {[0, 1, 2, 3, 4].map((lvl) => (
              <View
                key={`lvl-${lvl}`}
                style={[
                  styles.heatmapScaleBox,
                  { backgroundColor: getHeatmapColor(lvl) },
                ]}
              />
            ))}
          </View>
          <Text style={styles.heatmapLegendText}>More</Text>
        </View>
      </View>

      {/* 6. WATCH RATIO SEGMENTED PROGRESS CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Vault Completion</Text>
            <Text style={styles.cardSubtitle}>
              {effectiveMetrics.watched} of {effectiveMetrics.totalSaved} clips
              completed
            </Text>
          </View>
          <View style={styles.completionPill}>
            <Text style={styles.completionPillText}>
              {effectiveMetrics.completionRate}%
            </Text>
          </View>
        </View>

        {/* Multi-Segment Horizontal Pill Track */}
        <View style={styles.watchSegmentTrack}>
          <View
            style={[
              styles.watchSegmentFillWatched,
              { width: `${Math.max(effectiveMetrics.completionRate, 0)}%` },
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
            <Text style={styles.watchLegendValue}>
              {effectiveMetrics.watched}
            </Text>
          </View>

          <View style={styles.watchLegendItem}>
            <View
              style={[styles.watchLegendDot, { backgroundColor: "#00E5FF" }]}
            />
            <Text style={styles.watchLegendLabel}>In Queue</Text>
            <Text style={styles.watchLegendValue}>
              {effectiveMetrics.inQueue}
            </Text>
          </View>

          {effectiveMetrics.favorites > 0 && (
            <View style={styles.watchLegendItem}>
              <View
                style={[styles.watchLegendDot, { backgroundColor: "#F59E0B" }]}
              />
              <Text style={styles.watchLegendLabel}>Favorites</Text>
              <Text style={styles.watchLegendValue}>
                {effectiveMetrics.favorites}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 7. PLATFORM ECOSYSTEM DISTRIBUTION */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Platform Ecosystem</Text>
            <Text style={styles.cardSubtitle}>Distribution of saved media</Text>
          </View>
        </View>

        {effectivePlatformStats.length === 0 ? (
          <View style={styles.emptyCardBox}>
            <Ionicons name="film-outline" size={24} color="#71767B" />
            <Text style={styles.emptyCardText}>No clips in this timeframe</Text>
          </View>
        ) : (
          effectivePlatformStats.map((item, idx) => (
            <View
              key={item.key || `platform-item-${idx}`}
              style={styles.platformItemRow}
            >
              <View style={styles.platformTopMeta}>
                <View style={styles.platformLeftTitle}>
                  <PlatformIcon platform={item.key} size={17} />
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

      {/* 8. AI MEMORY & RECALL INTELLIGENCE BANNER */}
      <View style={styles.aiInsightsCard}>
        <View style={styles.aiInsightsTop}>
          <View style={styles.aiBadgeGlow}>
            <Ionicons name="sparkles" size={14} color="#00E5FF" />
          </View>
          <Text style={styles.aiInsightsTitle}>Elio AI Intelligence</Text>
        </View>

        <Text style={styles.aiInsightsBody}>
          {aiReadyCount} of your {videos.length} clips have vector embeddings &
          full digests generated. Ask Elio can recall inside-video moments with
          exact timestamps anytime.
        </Text>
      </View>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070A11",
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
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: "#8E95A5",
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
    borderColor: "rgba(255, 255, 255, 0.09)",
  },
  timeframePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
  },
  timeframePillActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  timeframePillText: {
    color: "#7E8698",
    fontSize: 11,
    fontWeight: "700",
  },
  timeframePillTextActive: {
    color: "#070A11",
    fontWeight: "800",
  },

  // 2. HERO DISPLAY CARD
  heroCard: {
    backgroundColor: "#0E121E",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.22)",
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#00E5FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroPreLabel: {
    color: "#00E5FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroBigNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  heroBigNumber: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  heroUnits: {
    color: "#8E95A5",
    fontSize: 14,
    fontWeight: "600",
  },
  heroStreakPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 0, 0.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 0, 0.3)",
    gap: 8,
  },
  heroStreakFlame: {
    fontSize: 20,
  },
  heroStreakTitle: {
    color: "#FF8A00",
    fontSize: 13,
    fontWeight: "800",
  },
  heroStreakSub: {
    color: "#FFA84A",
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: -1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 14,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMetaItem: {
    alignItems: "flex-start",
  },
  heroMetaLabel: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  heroMetaValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },

  // 3. 2x2 BENTO GRID
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
    backgroundColor: "#0E121E",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopColor: "rgba(255, 255, 255, 0.14)",
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
    color: "#7E8698",
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
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },

  // SECTION CARDS (Shared Card Container)
  sectionCard: {
    backgroundColor: "#0E121E",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopColor: "rgba(255, 255, 255, 0.14)",
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
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: "#8E95A5",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },

  // 4. DAILY ACTIVITY BAR CHART
  avgBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  avgBadgeText: {
    color: "#8E95A5",
    fontSize: 10.5,
    fontWeight: "700",
  },
  selectedBubbleHUD: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 12,
  },
  selectedBubbleLeft: {
    gap: 2,
  },
  selectedBubbleDate: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  selectedBubbleStats: {
    fontSize: 11,
    color: "#8E95A5",
  },
  filterFeedBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterFeedBtnText: {
    color: "#070A11",
    fontSize: 11,
    fontWeight: "800",
  },
  capsuleBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 125,
    paddingTop: 8,
  },
  capsuleBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  capsuleBarVal: {
    color: "#7E8698",
    fontSize: 10,
    fontWeight: "700",
    height: 14,
    marginBottom: 4,
  },
  capsuleBarValActive: {
    color: "#00E5FF",
    fontWeight: "900",
  },
  capsuleTrack: {
    width: 14,
    height: 80,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  capsuleTrackActive: {
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  capsuleFill: {
    width: "100%",
    borderRadius: 7,
    justifyContent: "flex-end",
  },
  capsuleWatchedSubFill: {
    width: "100%",
    backgroundColor: "#10B981",
    borderRadius: 7,
  },
  capsuleDayLabel: {
    color: "#7E8698",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 6,
  },
  capsuleDayLabelActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  chartLegendFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    color: "#7E8698",
    fontSize: 10.5,
    fontWeight: "600",
  },

  // 5. 28-DAY HEATMAP
  heatmapStreakBadge: {
    backgroundColor: "rgba(255, 107, 0, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 0, 0.25)",
  },
  heatmapStreakText: {
    color: "#FF8A00",
    fontSize: 11,
    fontWeight: "800",
  },
  heatmapTooltipHUD: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 12,
  },
  heatmapTooltipDate: {
    color: "#8E95A5",
    fontSize: 11.5,
    fontWeight: "600",
  },
  heatmapTooltipCount: {
    color: "#00E5FF",
    fontSize: 12,
    fontWeight: "800",
  },
  heatmapFilterBtn: {
    backgroundColor: "#00E5FF",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 7,
  },
  heatmapFilterBtnText: {
    color: "#070A11",
    fontSize: 10.5,
    fontWeight: "800",
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
    marginVertical: 4,
  },
  heatmapCell: {
    width: "12%",
    aspectRatio: 1,
    borderRadius: 6,
  },
  heatmapCellSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heatmapLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 12,
  },
  heatmapLegendText: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "600",
  },
  heatmapScaleBoxes: {
    flexDirection: "row",
    gap: 3,
  },
  heatmapScaleBox: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
  },

  // 6. WATCH RATIO SEGMENTED PROGRESS
  completionPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  completionPillText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800",
  },
  watchSegmentTrack: {
    width: "100%",
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginBottom: 12,
  },
  watchSegmentFillWatched: {
    height: "100%",
    borderRadius: 4.5,
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
    color: "#7E8698",
    fontSize: 11,
    fontWeight: "500",
  },
  watchLegendValue: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },

  // 7. PLATFORM BREAKDOWN
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
    color: "#7E8698",
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

  // 8. AI INTELLIGENCE BANNER
  aiInsightsCard: {
    backgroundColor: "rgba(0, 229, 255, 0.05)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.18)",
    marginBottom: 14,
  },
  aiInsightsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  aiBadgeGlow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiInsightsTitle: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "800",
  },
  aiInsightsBody: {
    color: "#A4B0C7",
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "500",
  },
});
