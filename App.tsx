import React, { useEffect } from 'react';
import { ActivityIndicator, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Home from './components/Home';
import Setting from './components/Setting';

const Stack = createStackNavigator();
const NAVIGATION_IDS = ['home', 'settings'];

/**
 * Builds a deep link URL based on notification data.
 * If the navigationId is invalid, it returns null.
 */
function buildDeepLinkFromNotificationData(data: Record<string, any>): string | null {
  const navigationId = data?.navigationId;
  console.log('Notification data:', data); // Debugging: log received notification data

  if (!NAVIGATION_IDS.includes(navigationId)) {
    console.warn('Unverified navigationId:', navigationId);
    return null; // Return null for unverified navigation IDs
  }

  return `myapp://${navigationId}`;
}

/**
 * Linking configuration for deep linking and notification handling.
 */
const linking = {
  prefixes: ['myapp://'],
  config: {
    screens: {
      Home: 'home',
      Settings: 'settings',
    },
  },
  async getInitialURL(): Promise<string | null> {
    try {
      // Check if the app was opened with a URL (deep linking)
      const url = await Linking.getInitialURL();
      if (url) {
        return url;
      }

      // Check if the app was opened via a notification
      const message = await messaging().getInitialNotification();
      if (message?.data) {
        const deeplinkURL = buildDeepLinkFromNotificationData(message.data);
        if (deeplinkURL) {
          return deeplinkURL;
        }
      }
    } catch (error) {
      console.error('Error in getInitialURL:', error);
    }

    return null; // Return null if no valid URL is found
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);

    // Listen to incoming links (deep linking)
    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    // Handle notifications in the foreground
    const foregroundNotification = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground FCM message received:', remoteMessage);
    });

    // Handle notifications when the app is in the background
    const unsubscribeNotification = messaging().onNotificationOpenedApp((remoteMessage) => {
      const url = buildDeepLinkFromNotificationData(remoteMessage?.data || {});
      if (url) {
        listener(url);
      }
    });

    return () => {
      linkingSubscription.remove();
      unsubscribeNotification();
      foregroundNotification();
    };
  },
};

function App(): React.JSX.Element {
  useEffect(() => {
    const requestUserPermission = async () => {
      // Request notification permissions
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

      const authStatus = await messaging().requestPermission();
      const isEnabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (isEnabled) {
        console.log('Notification permissions granted:', authStatus);
        const token = await messaging().getToken();
        console.log('FCM token:', token);
      } else {
        console.warn('Notification permissions not granted.');
      }
    };

    requestUserPermission();
  }, []);

  return (
    <NavigationContainer linking={linking} fallback={<ActivityIndicator animating />}>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Settings" component={Setting} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
