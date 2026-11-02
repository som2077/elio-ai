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
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { SavedVideo } from '../types/video';
import { VideoCard } from '../components/VideoCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { openVideoDirectly } from '../services/deepLink';
import { ActivityCalendar } from '../components/ActivityCalendar';
import { AuthScreen } from '../components/AuthScreen';
import { QRScannerModal } from '../components/QRScannerModal';
import { LinkedDevicesModal } from '../components/LinkedDevicesModal';
import { AppleHeader } from '../components/AppleHeader';
import { AppleFilterPills, FilterCategory } from '../components/AppleFilterPills';
import { EmptyState } from '../components/EmptyState';
import { toDateKey, formatDisplayDate } from '../services/dateAnalytics';
import { triggerLayoutMotion } from '../utils/motion';
import {
  appleColors,
  appleRadii,
  appleTypography,
} from '../theme/appleTokens';
import { haptics } from '../utils/haptics';

export default function HomeScreen() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showDevices, setShowDevices] = useState(false);

  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) {
        fetchVideos(currentSession.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchVideos(newSession.user.id);
      } else {
        setVideos([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchVideos = async (userId?: string) => {
    try {
      const targetUserId = userId || session?.user?.id;
      let query = supabase
        .from('saved_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (targetUserId) {
        query = query.eq('user_id', targetUserId);
      }

      const { data, error } = await query;

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
    if (!session?.user?.id) return;

    // Realtime Supabase listener filtered to current user
    try {
      const channel = supabase
        .channel('saved_videos_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'saved_videos',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            fetchVideos(session.user.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Ignored safely
    }
  }, [session?.user?.id]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Elio AI?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

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

  const handleFilterChange = (newFilter: FilterCategory) => {
    triggerLayoutMotion();
    setFilter(newFilter);
  };

  const handleCalendarToggle = () => {
    triggerLayoutMotion(300);
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

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.centerContainer]}>
        <StatusBar style="light" backgroundColor={appleColors.canvas} translucent={false} />
        <ActivityIndicator size="large" color={appleColors.accent} />
        <Text style={styles.loadingText}>Syncing Elio AI...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={() => fetchVideos()} />;
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar style="light" backgroundColor={appleColors.canvas} translucent={false} />

      {/* Apple-Grade Header */}
      <AppleHeader
        userEmail={session?.user?.email}
        totalCount={videos.length}
        unreadCount={unreadCount}
        showCalendar={showCalendar}
        onToggleCalendar={handleCalendarToggle}
        onOpenScanner={() => setShowScanner(true)}
        onOpenDevices={() => setShowDevices(true)}
        onLogout={handleLogout}
      />

      {/* Apple-Style Segmented Filter Bar */}
      <AppleFilterPills
        filter={filter}
        videos={videos}
        onSelectFilter={handleFilterChange}
      />

      {/* Date Filter Active Banner */}
      {!showCalendar && selectedDate && (
        <View style={styles.miniDateFilterBar}>
          <View style={styles.miniDateFilterLeft}>
            <Ionicons name="calendar" size={14} color={appleColors.accentLight} />
            <Text style={styles.miniDateFilterText}>
              Filter:{' '}
              <Text style={styles.miniDateHighlight}>
                {formatDisplayDate(selectedDate)}
              </Text>{' '}
              ({filteredVideos.length} clips)
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              handleDateSelect(null);
            }}
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
                openVideoDirectly(
                  item.clean_url,
                  item.platform as any,
                  item.platform_video_id
                )
              }
              onToggleStatus={() => toggleStatus(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                haptics.light();
                setRefreshing(true);
                fetchVideos();
              }}
              tintColor={appleColors.accentLight}
            />
          }
          ListEmptyComponent={
            <EmptyState onLinkPress={() => setShowScanner(true)} />
          }
        />
      )}

      {/* QR Scanner Modal to link extension */}
      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={() => fetchVideos()}
      />

      {/* Linked Devices Management Modal */}
      <LinkedDevicesModal
        visible={showDevices}
        onClose={() => setShowDevices(false)}
        onLinkNewDevice={() => setShowScanner(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: appleColors.canvas,
  },
  miniDateFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: appleColors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: appleRadii.control,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
  },
  miniDateFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDateFilterText: {
    ...appleTypography.footnote,
    color: appleColors.textSecondary,
  },
  miniDateHighlight: {
    color: appleColors.accentLight,
    fontWeight: '700',
  },
  miniDateFilterClear: {
    backgroundColor: appleColors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: appleRadii.pill,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
  },
  miniDateFilterClearText: {
    ...appleTypography.caption,
    fontSize: 10,
    color: appleColors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    ...appleTypography.subhead,
    color: appleColors.textSecondary,
    marginTop: 14,
  },
});
