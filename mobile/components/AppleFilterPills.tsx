import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appleColors, appleRadii, appleTypography, appleShadows } from '../theme/appleTokens';
import { haptics } from '../utils/haptics';
import { SavedVideo } from '../types/video';

export type FilterCategory =
  | 'all'
  | 'unread'
  | 'youtube'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'linkedin'
  | 'pinterest'
  | 'tiktok';

interface FilterTab {
  key: FilterCategory;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const TABS: FilterTab[] = [
  { key: 'all', label: 'All Items', icon: 'layers-outline' },
  { key: 'unread', label: 'Unread', icon: 'time-outline' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'twitter', label: 'Twitter', icon: 'logo-twitter' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { key: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' },
  { key: 'pinterest', label: 'Pinterest', icon: 'logo-pinterest' },
  { key: 'tiktok', label: 'TikTok', icon: 'musical-notes-outline' },
];

interface AppleFilterPillsProps {
  filter: FilterCategory;
  videos: SavedVideo[];
  onSelectFilter: (filter: FilterCategory) => void;
}

export const AppleFilterPills: React.FC<AppleFilterPillsProps> = ({
  filter,
  videos,
  onSelectFilter,
}) => {
  const getCount = (key: FilterCategory): number => {
    if (key === 'all') return videos.length;
    if (key === 'unread') return videos.filter((v) => v.status === 'unread').length;
    return videos.filter((v) => v.platform === key).length;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((tab) => {
          const count = getCount(tab.key);
          const isActive = filter === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
              ]}
              onPress={() => {
                haptics.selection();
                onSelectFilter(tab.key);
              }}
            >
              {tab.icon && (
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : appleColors.textSecondary}
                  style={styles.pillIcon}
                />
              )}
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    isActive ? styles.countBadgeActive : styles.countBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isActive ? styles.countTextActive : styles.countTextInactive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: appleRadii.pill,
  },
  pillInactive: {
    backgroundColor: appleColors.surfaceGlass,
    borderWidth: 1,
    borderColor: appleColors.borderGlass,
  },
  pillActive: {
    backgroundColor: appleColors.accent,
    borderWidth: 1,
    borderColor: appleColors.accentLight,
    ...appleShadows.accentPill,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    ...appleTypography.caption,
    fontSize: 12,
  },
  pillTextInactive: {
    color: appleColors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  countText: {
    ...appleTypography.tabularNums,
    fontSize: 10,
    fontWeight: '700',
  },
  countTextInactive: {
    color: appleColors.textSecondary,
  },
  countTextActive: {
    color: '#FFFFFF',
  },
});
