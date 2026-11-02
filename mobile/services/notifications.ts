import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers device for push notifications and stores token in Supabase
 */
export async function registerForPushNotificationsAsync(userId: string) {
  let token;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  try {
    const pushTokenData = await Notifications.getDevicePushTokenAsync();
    token = pushTokenData.data;

    // Save token to Supabase device_tokens table
    if (token && userId) {
      await supabase.from('device_tokens').upsert(
        {
          user_id: userId,
          fcm_token: token,
          device_type: Platform.OS === 'ios' ? 'ios' : 'android',
          device_name: `${Platform.OS} device`,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' }
      );
    }
  } catch (e) {
    console.error('Error fetching push token:', e);
  }

  return token;
}
