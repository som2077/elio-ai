import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { SavedVideo } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { openVideoDirectly } from '../services/deepLink';
import { ActivityCalendar } from '../components/ActivityCalendar';
import { toDateKey, formatDisplayDate } from '../services/dateAnalytics';
import { triggerLayoutMotion } from '../utils/motion';

export default function HomeScreen() {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'unread' | 'youtube' | 'instagram' | 'twitter' | 'facebook' | 'reddit' | 'linkedin' | 'pinterest' | 'tiktok'
  >('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch notice:', error.message);
      } else if (data) {
        setVideos(data as SavedVideo[]);
      }
    } catch (err: any) {
      console.warn('Network issue:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();

    // Realtime Supabase listener
    try {
      const channel = supabase
        .channel('saved_videos_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'saved_videos' },
          () => {
            fetchVideos();
          }
        )
      .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {}
  }, []);

  const toggleStatus = async (video: SavedVideo) => {
    triggerLayoutMotion();
    const newStatus = video.status === 'watched' ? 'unread' : 'watched';
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, status: newStatus } : v))
    );

    await supabase
      .from('saved_videos')
      .update({
        status: newStatus,
        watched_at: newStatus === 'watched' ? new Date().toISOString() : null,
      })
      .eq('id', video.id);
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    triggerLayoutMotion();
    setFilter(newFilter);
  };

  const handleCalendarToggle = () => {
    triggerLayoutMotion(350);
    setShowCalendar((prev) => !prev);
  };

  const handleDateSelect = (date: string | null) => {
    triggerLayoutMotion();
    setSelectedDate(date);
  };

  const filteredVideos = videos.filter((v) => {
    // Filter by calendar selected date if active
    if (selectedDate) {
      const vDateKey = toDateKey(v.created_at);
      if (vDateKey !== selectedDate) return false;
    }

    if (filter === 'youtube') return v.platform === 'youtube';
    if (filter === 'instagram') return v.platform === 'instagram';
    if (filter === 'twitter') return v.platform === 'twitter';
    if (filter === 'facebook') return v.platform === 'facebook';
    if (filter === 'reddit') return v.platform === 'reddit';
    if (filter === 'linkedin') return v.platform === 'linkedin';
    if (filter === 'pinterest') return v.platform === 'pinterest';
    if (filter === 'tiktok') return v.platform === 'tiktok';
    if (filter === 'unread') return v.status === 'unread';
    return true;
  });

  const unreadCount = videos.filter((v) => v.status === 'unread').length;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <View>
            <Text style={styles.appTitle}>Elio AI</Text>
            <Text style={styles.appSubtitle}>Smart Watchlist & Recall</Text>
          </View>
        </View>

        <View style={styles.topRightActions}>
          {/* Calendar Toggle Button */}
          <TouchableOpacity
            style={[styles.calendarToggleBtn, showCalendar && styles.calendarToggleBtnActive]}
            activeOpacity={0.7}
            onPress={handleCalendarToggle}
          >
            <Text style={styles.calendarIconText}>📅</Text>
            <Text style={[styles.calendarToggleLabel, showCalendar && styles.calendarToggleLabelActive]}>
              {showCalendar ? 'Close' : 'Activity'}
            </Text>
          </TouchableOpacity>

          {/* Counter Badge */}
          <View style={styles.statPill}>
            <View style={styles.liveDot} />
            <Text style={styles.statPillText}>
              {unreadCount} Pending
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs (Horizontal Scrollable) */}
      <View style={{ marginBottom: 14 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterSection}
        >
          {(
            [
              { key: 'all', label: 'All Items' },
              { key: 'unread', label: '⏳ Unread' },
              { key: 'youtube', label: '▶ YouTube' },
              { key: 'instagram', label: '✦ Instagram' },
              { key: 'twitter', label: '𝕏 Twitter' },
              { key: 'facebook', label: 'f Facebook' },
              { key: 'reddit', label: '● Reddit' },
              { key: 'linkedin', label: 'in LinkedIn' },
              { key: 'pinterest', label: 'P Pinterest' },
              { key: 'tiktok', label: '♫ TikTok' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              style={[styles.chip, filter === tab.key && styles.chipActive]}
              onPress={() => handleFilterChange(tab.key)}
            >
              <Text style={[styles.chipText, filter === tab.key && styles.chipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Mini Active Date Filter Banner (when calendar is closed but date is selected) */}
      {!showCalendar && selectedDate && (
        <View style={styles.miniDateFilterBar}>
          <Text style={styles.miniDateFilterText}>
            📅 Filter: <Text style={styles.miniDateHighlight}>{formatDisplayDate(selectedDate)}</Text> ({filteredVideos.length} clips)
          </Text>
          <TouchableOpacity
            onPress={() => handleDateSelect(null)}
            style={styles.miniDateFilterClear}
          >
            <Text style={styles.miniDateFilterClearText}>Reset ✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Video Content Feed */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredVideos}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            showCalendar ? (
              <ActivityCalendar
                videos={videos}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              onPress={() =>
                openVideoDirectly(item.clean_url, item.platform as any, item.platform_video_id)
              }
              onToggleStatus={() => toggleStatus(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchVideos();
              }}
              tintColor="#6366F1"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🎬</Text>
              </View>
              <Text style={styles.emptyHeading}>Your inbox is empty</Text>
              <Text style={styles.emptyDescription}>
                Like videos on YouTube or Instagram in your desktop browser. They will sync here instantly!
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D', // Pure deep obsidian dark background
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 5,
  },
  calendarToggleBtnActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  calendarIconText: {
    fontSize: 12,
  },
  calendarToggleLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  calendarToggleLabelActive: {
    color: '#FFFFFF',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statPillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  miniDateFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniDateFilterText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  miniDateHighlight: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  miniDateFilterClear: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniDateFilterClearText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyHeading: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
