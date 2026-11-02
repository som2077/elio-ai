import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavedVideo } from '../types/video';
import {
  calculateActivityStats,
  getDailyActivityMap,
  getMonthDaysGrid,
} from '../services/dateAnalytics';
import {
  appleColors,
  appleRadii,
  appleTypography,
  appleShadows,
} from '../theme/appleTokens';
import { haptics } from '../utils/haptics';
import { triggerLayoutMotion } from '../utils/motion';

interface ActivityCalendarProps {
  videos: SavedVideo[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  videos,
  selectedDate,
  onSelectDate,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);

  const activityMap = getDailyActivityMap(videos);
  const stats = calculateActivityStats(videos);
  const daysGrid = getMonthDaysGrid(currentYear, currentMonth, activityMap);

  const handlePrevMonth = () => {
    haptics.selection();
    triggerLayoutMotion(200);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    haptics.selection();
    triggerLayoutMotion(200);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleDatePress = (dateKey: string, saveCount: number) => {
    haptics.selection();
    triggerLayoutMotion(200);
    if (selectedDate === dateKey) {
      onSelectDate(null);
    } else {
      onSelectDate(dateKey);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Top Specular Rim */}
      <View style={styles.specularRim} />

      {/* Apple-Style 3-Metric KPI Highlights */}
      <View style={styles.kpiRow}>
        {/* Streak Metric */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Ionicons name="flame" size={16} color="#F59E0B" />
          </View>
          <Text style={styles.kpiValue}>
            {stats.currentStreak}{' '}
            <Text style={styles.kpiUnit}>
              {stats.currentStreak === 1 ? 'day' : 'days'}
            </Text>
          </Text>
          <Text style={styles.kpiLabel}>Current Streak</Text>
        </View>

        {/* Peak Day Metric */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Ionicons name="flash" size={16} color={appleColors.accentLight} />
          </View>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {stats.peakDay ? stats.peakDay.formatted.split(' ').slice(0, 2).join(' ') : '—'}
          </Text>
          <Text style={styles.kpiLabel}>
            {stats.peakDay ? `${stats.peakDay.count} clips peak` : 'Peak Day'}
          </Text>
        </View>

        {/* Total Vault Metric */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Ionicons name="film" size={16} color={appleColors.success} />
          </View>
          <Text style={styles.kpiValue}>{videos.length}</Text>
          <Text style={styles.kpiLabel}>Saved Vault</Text>
        </View>
      </View>

      {/* Calendar Header with Navigation */}
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </Text>
          <Text style={styles.monthSubtitle}>Activity & Save Intensity</Text>
        </View>

        <View style={styles.navButtonGroup}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handlePrevMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={16} color={appleColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleNextMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={16} color={appleColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday Row */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekDayText}>
            {d}
          </Text>
        ))}
      </View>

      {/* Days Matrix */}
      <View style={styles.grid}>
        {daysGrid.map((item, index) => {
          const isSelected = selectedDate === item.dateKey;
          const isPeakDay = stats.peakDay?.dateKey === item.dateKey && item.saveCount > 0;
          const hasSaves = item.saveCount > 0;

          // Intensity tiers
          const isHigh = item.saveCount >= 5;
          const isMedium = item.saveCount >= 2;

          return (
            <TouchableOpacity
              key={`${item.dateKey}-${index}`}
              activeOpacity={0.7}
              disabled={!item.isCurrentMonth && item.saveCount === 0}
              onPress={() => handleDatePress(item.dateKey, item.saveCount)}
              style={[
                styles.dayCell,
                !item.isCurrentMonth && styles.dayCellOutside,
                hasSaves && (isHigh ? styles.dayCellHigh : isMedium ? styles.dayCellMedium : styles.dayCellLow),
                isSelected && styles.dayCellSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !item.isCurrentMonth && styles.dayTextOutside,
                  item.isToday && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                  hasSaves && styles.dayTextActive,
                ]}
              >
                {item.dayNumber}
              </Text>

              {/* Glowing activity badge */}
              {hasSaves && (
                <View style={styles.saveBadge}>
                  {isPeakDay ? (
                    <Text style={styles.flameEmoji}>🔥</Text>
                  ) : (
                    <Text
                      style={[
                        styles.saveBadgeText,
                        isSelected && { color: '#FFFFFF' },
                      ]}
                    >
                      {item.saveCount}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: appleColors.surfaceSecondary,
    borderRadius: appleRadii.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
    ...appleShadows.card,
    position: 'relative',
    overflow: 'hidden',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: appleColors.borderSpecularTop,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: appleColors.surfaceTertiary,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: appleColors.borderSubtle,
  },
  kpiIconWrap: {
    marginBottom: 4,
  },
  kpiValue: {
    ...appleTypography.headline,
    ...appleTypography.tabularNums,
    fontSize: 16,
    color: appleColors.textPrimary,
  },
  kpiUnit: {
    fontSize: 11,
    color: appleColors.textSecondary,
    fontWeight: '500',
  },
  kpiLabel: {
    ...appleTypography.footnote,
    fontSize: 10,
    color: appleColors.textSecondary,
    marginTop: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 4,
  },
  monthTitle: {
    ...appleTypography.title2,
    fontSize: 17,
  },
  monthSubtitle: {
    ...appleTypography.footnote,
    color: appleColors.textTertiary,
    marginTop: 1,
  },
  navButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: appleColors.surfaceTertiary,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    ...appleTypography.caption,
    color: appleColors.textTertiary,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCell: {
    width: 40,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appleColors.surfaceTertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellOutside: {
    opacity: 0.25,
  },
  dayCellLow: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  dayCellMedium: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  dayCellHigh: {
    backgroundColor: 'rgba(99, 102, 241, 0.38)',
    borderColor: appleColors.accentLight,
  },
  dayCellSelected: {
    backgroundColor: appleColors.accent,
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  dayText: {
    ...appleTypography.footnote,
    ...appleTypography.tabularNums,
    color: appleColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextOutside: {
    color: appleColors.textMuted,
  },
  dayTextToday: {
    color: appleColors.accentLight,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  saveBadge: {
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
  },
  saveBadgeText: {
    ...appleTypography.tabularNums,
    fontSize: 8,
    color: appleColors.accentLight,
    fontWeight: '700',
  },
  flameEmoji: {
    fontSize: 9,
  },
});
