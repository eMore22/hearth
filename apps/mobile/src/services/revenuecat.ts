import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

let configured = false;
let currentUserId: string | null = null;

export const revenueCatService = {
  configure: async (userId?: string) => {
    if (configured || Platform.OS !== 'android') return;

    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

    if (!apiKey) {
      console.warn('RevenueCat Android API key is missing');
      return;
    }

    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      Purchases.configure({
        apiKey,
        appUserID: userId || undefined,
      });

      configured = true;
      currentUserId = userId || null;

      console.log('RevenueCat configured');
    } catch (error) {
      console.warn('RevenueCat configuration failed:', error);
    }
  },

  identifyUser: async (userId: string) => {
    if (!configured || Platform.OS !== 'android') return;
    if (!userId || currentUserId === userId) return;

    try {
      await Purchases.logIn(userId);
      currentUserId = userId;
      console.log('RevenueCat user identified');
    } catch (error) {
      console.warn('RevenueCat login failed:', error);
    }
  },

  clearUser: async () => {
    if (!configured || Platform.OS !== 'android') return;
    if (!currentUserId) return;

    try {
      await Purchases.logOut();
      currentUserId = null;
      console.log('RevenueCat user cleared');
    } catch (error) {
      console.warn('RevenueCat logout failed:', error);
    }
  },
};
