import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SavedVideo } from '../types/video';
import {
  calculateActivityStats,
  getDailyActivityMap,
  getMonthDaysGrid,
  formatDisplayDate,
} from '../services/dateAnalytics';
import { triggerLayoutMotion } from '../utils/motion';

interface ActivityCalendarProps {
  videos: SavedVideo[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  videos,
  selectedDate,
  onSelectDate,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12

  const activityMap = getDailyActivityMap(videos);
  const stats = calculateActivityStats(videos);
  const daysGrid = getMonthDaysGrid(currentYear, currentMonth, activityMap);

  const handlePrevMonth = () => {
    triggerLayoutMotion(200);
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    triggerLayoutMotion(200);
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleDatePress = (dateKey: string, saveCount: number) => {
    triggerLayoutMotion(200);
    if (selectedDate === dateKey) {
      onSelectDate(null); // Toggle off if already selected
    } else {
      onSelectDate(dateKey);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Calendar Header with Month Navigation */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </Text>
          <Text style={styles.subSubtitle}>
            Tap any date to filter your saved clips
          </Text>
        </View>

        <View style={styles.navButtons}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePrevMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNextMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Days of Week Header */}
      <View style={styles.weekRow}>
        {WEEK_DAYS.map((day) => (
          <Text key={day} style={styles.weekDayText}>
            {day}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.grid}>
        {daysGrid.map((item, index) => {
          const isSelected = selectedDate === item.dateKey;
          const isPeakDay = stats.peakDay?.dateKey === item.dateKey && item.saveCount > 0;
          const hasSaves = item.saveCount > 0;

          // Intensity calculation
          const isHighActivity = item.saveCount >= 5;
          const isMediumActivity = item.saveCount >= 2;

          return (
            <TouchableOpacity
              key={`${item.dateKey}-${index}`}
              activeOpacity={0.6}
              disabled={!item.isCurrentMonth && item.saveCount === 0}
              onPress={() => handleDatePress(item.dateKey, item.saveCount)}
              style={[
                styles.dayCell,
                !item.isCurrentMonth && styles.dayCellOutside,
                isSelected && styles.dayCellSelected,
                item.isToday && !isSelected && styles.dayCellToday,
                hasSaves && !isSelected && (isHighActivity ? styles.dayCellHigh : isMediumActivity ? styles.dayCellMedium : styles.dayCellLight),
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

              {/* Activity indicator: count badge or flame */}
              {hasSaves && (
                <View style={styles.countBadgeWrapper}>
                  {isPeakDay ? (
                    <Text style={styles.flameIcon}>🔥</Text>
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        isHighActivity ? styles.dotHigh : styles.dotNormal,
                      ]}
                    >
                      <Text style={styles.saveCountText}>
                        {item.saveCount > 9 ? '9+' : item.saveCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Analytics Highlights Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>🏆 PEAK DAY</Text>
          <Text style={styles.statValue}>
            {stats.peakDay ? `${stats.peakDay.formatted}` : 'None yet'}
          </Text>
          {stats.peakDay && (
            <Text style={styles.statSubValue}>
              {stats.peakDay.count} videos saved
            </Text>
          )}
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>🔥 STREAK</Text>
          <Text style={styles.statValue}>
            {stats.currentStreak} {stats.currentStreak === 1 ? 'Day' : 'Days'}
          </Text>
          <Text style={styles.statSubValue}>Consistency</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>📊 ACTIVE DAYS</Text>
          <Text style={styles.statValue}>{stats.activeDaysCount} Days</Text>
          <Text style={styles.statSubValue}>Total recorded</Text>
        </View>
      </View>

      {/* Selected Date Filter Banner */}
      {selectedDate && (
        <View style={styles.activeFilterBanner}>
          <View style={styles.activeFilterTextGroup}>
            <Text style={styles.filterDot}>●</Text>
            <Text style={styles.activeFilterLabel}>
              Filtered by: <Text style={styles.filterDateHighlight}>{formatDisplayDate(selectedDate)}</Text>
              {' '}({activityMap[selectedDate] || 0} clips)
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onSelectDate(null)}
            style={styles.clearFilterButton}
          >
            <Text style={styles.clearFilterText}>Show All ✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: '13.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
    borderRadius: 10,
    position: 'relative',
  },
  dayCellOutside: {
    opacity: 0.25,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  dayCellSelected: {
    backgroundColor: '#6366F1',
    borderWidth: 1.5,
    borderColor: '#818CF8',
  },
  dayCellLight: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  dayCellMedium: {
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  dayCellHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dayTextOutside: {
    color: '#475569',
  },
  dayTextToday: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  countBadgeWrapper: {
    position: 'absolute',
    bottom: 2,
  },
  dot: {
    paddingHorizontal: 3,
    height: 11,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotNormal: {
    backgroundColor: '#6366F1',
  },
  dotHigh: {
    backgroundColor: '#EF4444',
  },
  saveCountText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  flameIcon: {
    fontSize: 9,
    lineHeight: 11,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  statSubValue: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  activeFilterTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  filterDot: {
    color: '#6366F1',
    fontSize: 10,
  },
  activeFilterLabel: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  filterDateHighlight: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  clearFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1E293B',
    borderRadius: 6,
  },
  clearFilterText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
