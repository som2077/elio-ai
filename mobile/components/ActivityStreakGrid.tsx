import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import {
  toDateKey,
  formatDisplayDate,
  calculateActivityStats,
  getDailyActivityMap,
} from "../services/dateAnalytics";
import {
  appleColors,
  appleRadii,
  appleTypography,
} from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface ActivityStreakGridProps {
  videos: SavedVideo[];
  onSelectDate?: (dateKey: string) => void;
}

const WEEKS_COUNT = 12; // Last 12 weeks (84 days)

/**
 * GitHub / Apple Fitness Inspired Activity Consistency Heatmap
 * Features:
 * - 12-Week Rolling Matrix (7 rows x 12 cols)
 * - Dynamic 4-tier blue intensity coding
 * - Streak counters (Current Streak, Longest Streak, Active Days)
 * - Interactive cell tap showing exact saves & date
 */
export const ActivityStreakGrid: React.FC<ActivityStreakGridProps> = ({
  videos,
  onSelectDate,
}) => {
  const [selectedDay, setSelectedDay] = useState<{
    dateKey: string;
    count: number;
    formatted: string;
  } | null>(null);

  const stats = useMemo(() => calculateActivityStats(videos), [videos]);
  const activityMap = useMemo(() => getDailyActivityMap(videos), [videos]);

  // Compute 12-week matrix ending today
  const matrix = useMemo(() => {
    const today = new Date();
    const cols: { dateKey: string; count: number; dayOfWeek: number }[][] = [];

    // Calculate start date: 12 weeks ago, aligned to Monday
    const currentDayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const startDate = new Date(today);
    startDate.setDate(
      today.getDate() - currentDayOfWeek - (WEEKS_COUNT - 1) * 7,
    );

    let iter = new Date(startDate);
    for (let w = 0; w < WEEKS_COUNT; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const k = toDateKey(iter);
        const count = activityMap[k] || 0;
        const isFuture = iter > today;
        col.push({
          dateKey: k,
          count: isFuture ? -1 : count,
          dayOfWeek: d,
        });
        iter.setDate(iter.getDate() + 1);
      }
      cols.push(col);
    }

    return cols;
  }, [activityMap]);

  const getCellColor = (count: number) => {
    if (count < 0) return "transparent"; // Future
    if (count === 0) return "rgba(255, 255, 255, 0.05)";
    if (count === 1) return "rgba(29, 155, 240, 0.38)";
    if (count <= 3) return "rgba(29, 155, 240, 0.72)";
    return "#1D9BF0";
  };

  const handleCellPress = (dateKey: string, count: number) => {
    if (count < 0) return;
    haptics.selection();
    setSelectedDay({
      dateKey,
      count,
      formatted: formatDisplayDate(dateKey),
    });
    if (onSelectDate) onSelectDate(dateKey);
  };

  return (
    <View style={styles.card}>
      {/* Specular Highlight Rim */}
      <View style={styles.specularRim} />

      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>Daily Consistency</Text>
          <Text style={styles.cardSub}>Last 12 weeks of save activity</Text>
        </View>

        {/* Selected Day Toast */}
        {selectedDay && (
          <View style={styles.selectedDayPill}>
            <Text style={styles.selectedDayText}>
              {selectedDay.formatted}:{" "}
              <Text style={{ color: "#1D9BF0", fontWeight: "700" }}>
                {selectedDay.count} {selectedDay.count === 1 ? "clip" : "clips"}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* Streak Counters Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🔥</Text>
          <View>
            <Text style={styles.statVal}>{stats.currentStreak} Days</Text>
            <Text style={styles.statLabel}>Current streak</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>⭐</Text>
          <View>
            <Text style={styles.statVal}>{stats.activeDaysCount} Days</Text>
            <Text style={styles.statLabel}>Active days</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>⚡</Text>
          <View>
            <Text style={styles.statVal}>
              {stats.peakDay ? stats.peakDay.count : 0}
            </Text>
            <Text style={styles.statLabel}>Peak day</Text>
          </View>
        </View>
      </View>

      {/* Heatmap Matrix */}
      <View style={styles.matrixContainer}>
        {/* Day-of-week labels */}
        <View style={styles.dayLabelsCol}>
          <Text style={styles.dayLabel}>M</Text>
          <Text style={styles.dayLabel}>W</Text>
          <Text style={styles.dayLabel}>F</Text>
          <Text style={styles.dayLabel}>S</Text>
        </View>

        {/* 12 Weekly Columns */}
        <View style={styles.weeksRow}>
          {matrix.map((col, colIdx) => (
            <View key={colIdx} style={styles.weekCol}>
              {col.map((cell) => {
                const isSelected = selectedDay?.dateKey === cell.dateKey;
                return (
                  <TouchableOpacity
                    key={cell.dateKey}
                    activeOpacity={0.7}
                    disabled={cell.count < 0}
                    style={[
                      styles.cell,
                      { backgroundColor: getCellColor(cell.count) },
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => handleCellPress(cell.dateKey, cell.count)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Footer Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Less</Text>
        <View
          style={[
            styles.legendBox,
            { backgroundColor: "rgba(255, 255, 255, 0.05)" },
          ]}
        />
        <View
          style={[
            styles.legendBox,
            { backgroundColor: "rgba(29, 155, 240, 0.38)" },
          ]}
        />
        <View
          style={[
            styles.legendBox,
            { backgroundColor: "rgba(29, 155, 240, 0.72)" },
          ]}
        />
        <View style={[styles.legendBox, { backgroundColor: "#1D9BF0" }]} />
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#16161A",
    borderRadius: appleRadii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
  },
  specularRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSub: {
    color: appleColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  selectedDayPill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: appleRadii.control,
  },
  selectedDayText: {
    color: "#E7E9EA",
    fontSize: 11,
    fontWeight: "500",
  },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 4,
  },
  statEmoji: {
    fontSize: 18,
  },
  statVal: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: appleColors.textSecondary,
    fontSize: 10.5,
    marginTop: 1,
  },
  matrixContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabelsCol: {
    justifyContent: "space-between",
    height: 100,
    marginRight: 8,
    paddingVertical: 2,
  },
  dayLabel: {
    color: appleColors.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
  },
  weeksRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekCol: {
    justifyContent: "space-between",
    height: 100,
    gap: 3,
  },
  cell: {
    width: 13,
    height: 12,
    borderRadius: 3,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 12,
  },
  legendLabel: {
    color: appleColors.textTertiary,
    fontSize: 10.5,
    marginHorizontal: 2,
  },
  legendBox: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
  },
});
