import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Only the public RevenueCat Android SDK key belongs in the client bundle.
let configured = false;
let configureInFlight: Promise<boolean> | null = null;
let currentUserId: string | null = null;

async function configureOnce(userId?: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  if (!configured) {
    if (!configureInFlight) {
      configureInFlight = (async () => {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
        if (!apiKey || !apiKey.startsWith('goog_')) {
          console.warn('RevenueCat public Android SDK key is missing or invalid');
          return false;
        }
        try {
          if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          await Purchases.configure({ apiKey, appUserID: userId || undefined });
          configured = true;
          currentUserId = userId || null;
          return true;
        } catch (error) {
          console.warn('RevenueCat initialization failed:', error);
          return false;
        }
      })().finally(() => { configureInFlight = null; });
    }

    if (!(await configureInFlight)) return false;
  }

  // A request may have configured the SDK anonymously before auth finished.
  if (userId && currentUserId !== userId) {
    try {
      await Purchases.logIn(userId);
      currentUserId = userId;
    } catch (error) {
      console.warn('RevenueCat user identification failed:', error);
      return false;
    }
  }
  return true;
}

export const revenueCatService = {
  configure: configureOnce,
  identifyUser: (userId: string) => configureOnce(userId),
  clearUser: async () => {
    if (!configured || Platform.OS !== 'android' || !currentUserId) return;
    try {
      await Purchases.logOut();
      currentUserId = null;
    } catch (error) {
      console.warn('RevenueCat logout failed:', error);
    }
  },
};
