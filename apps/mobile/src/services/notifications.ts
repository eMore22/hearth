import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { notificationService } from './api'

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotificationsAsync() {
  let token

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!')
      return
    }

    // Standalone/production builds on expo-notifications ~0.32 require
    // projectId to be passed explicitly to getExpoPushTokenAsync(). Without
    // it, the call throws instead of returning a token — and that throw was
    // landing silently in the catch block below on every single attempt,
    // which is why register-token never once reached the backend.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId

    if (!projectId) {
      console.error('Missing EAS projectId — cannot get push token')
      return
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E86AB',
      })
    }

    // Send token to backend
    if (token) {
      await notificationService.registerToken(token, Platform.OS === 'ios' ? 'ios' : 'android')
    }
  } catch (error) {
    console.error('Error registering for push notifications:', error)
  }

  return token
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
    },
    trigger: trigger || null, // null means show immediately
  })
}

export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback)
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback)
}
