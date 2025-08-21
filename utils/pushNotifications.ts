// utils/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (!Constants.isDevice) {
    Alert.alert('Uyarı', 'Fiziksel cihaz gereklidir');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Uyarı', 'Bildirim izni verilmedi');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  console.log('📲 Expo Push Token:', token);
  return token;
};
