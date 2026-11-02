import { SavedVideo } from '../types/video';

export interface ActivityStats {
  totalSaved: number;
  peakDay: {
    dateKey: string; // 'YYYY-MM-DD'
    count: number;
    formatted: string;
  } | null;
  currentStreak: number; // Consecutive active days
  activeDaysCount: number;
}

/**
 * Format a Date object or ISO string to 'YYYY-MM-DD' in local time
 */
export function toDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format 'YYYY-MM-DD' into a user-friendly format (e.g. '14 Oct 2026')
 */
export function formatDisplayDate(dateKey: string): string {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Maps each dateKey (YYYY-MM-DD) to the number of videos saved on that date
 */
export function getDailyActivityMap(videos: SavedVideo[]): Record<string, number> {
  const activityMap: Record<string, number> = {};

  for (const video of videos) {
    if (!video.created_at) continue;
    const key = toDateKey(video.created_at);
    if (!key) continue;
    activityMap[key] = (activityMap[key] || 0) + 1;
  }

  return activityMap;
}

/**
 * Computes peak day, total saved, streak, and active days from the saved videos
 */
export function calculateActivityStats(videos: SavedVideo[]): ActivityStats {
  const activityMap = getDailyActivityMap(videos);
  const dateKeys = Object.keys(activityMap).sort();

  let peakDay: ActivityStats['peakDay'] = null;
  let maxCount = 0;

  for (const dateKey of dateKeys) {
    const count = activityMap[dateKey];
    if (count > maxCount) {
      maxCount = count;
      peakDay = {
        dateKey,
        count,
        formatted: formatDisplayDate(dateKey),
      };
    }
  }

  // Calculate Streak
  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Check if today or yesterday has activity to start the streak
  let checkKey = toDateKey(checkDate);
  if (!activityMap[checkKey]) {
    // If no save today, check yesterday
    checkDate.setDate(checkDate.getDate() - 1);
    checkKey = toDateKey(checkDate);
  }

  while (activityMap[checkKey] && activityMap[checkKey] > 0) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
    checkKey = toDateKey(checkDate);
  }

  return {
    totalSaved: videos.length,
    peakDay,
    currentStreak: streak,
    activeDaysCount: dateKeys.length,
  };
}

export interface CalendarDayItem {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  saveCount: number;
}

/**
 * Generates days grid for a given year & month (1-indexed month: 1=Jan, 12=Dec)
 */
export function getMonthDaysGrid(
  year: number,
  month: number,
  activityMap: Record<string, number>
): CalendarDayItem[] {
  const todayKey = toDateKey(new Date());
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  // Day of week: 0 is Sunday. Let's make Monday index 0 for standard UI
  // Sunday=0 -> 6, Monday=1 -> 0, Tuesday=2 -> 1, etc.
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; 
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const days: CalendarDayItem[] = [];

  // Previous month trailing days
  const prevMonthLastDate = new Date(year, month - 1, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 2, prevMonthLastDate - i);
    const dateKey = toDateKey(d);
    days.push({
      date: d,
      dateKey,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      saveCount: activityMap[dateKey] || 0,
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dateKey = toDateKey(d);
    days.push({
      date: d,
      dateKey,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      saveCount: activityMap[dateKey] || 0,
    });
  }

  // Next month leading days to complete the 7-column grid
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month, i);
    const dateKey = toDateKey(d);
    days.push({
      date: d,
      dateKey,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      saveCount: activityMap[dateKey] || 0,
    });
  }

  return days;
}
