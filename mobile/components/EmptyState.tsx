import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { threadsTokens } from '../theme/appleTokens';
import { haptics } from '../utils/haptics';

interface EmptyStateProps {
  onLinkPress: () => void;
  title?: string;
  subtitle?: string;
}

/**
 * Authentic Instagram Threads Saved Empty State
 * Calibrated directly from Screenshot 5:
 * "Posts that you save will appear here."
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  onLinkPress,
  title,
  subtitle,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.messageText}>
        {subtitle || 'Posts that you save will appear here.'}
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.linkBtn}
        onPress={() => {
          haptics.light();
          onLinkPress();
        }}
      >
        <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
        <Text style={styles.linkBtnText}>Link Desktop Extension</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    paddingHorizontal: 32,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '400',
    color: threadsTokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
