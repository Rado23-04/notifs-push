import React, { useEffect } from 'react';
import { ActivityIndicator, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Home from './components/Home';
import Setting from './components/Setting';

const Stack = createStackNavigator();
const NAVIGATION_IDS = ['home', 'settings'];

function buildDeepLinkFromNotificationData(data: Record<string, any>): string | null {
  const navigationId = data?.navigationId;
  console.log('Notification data:', data);

  if (!NAVIGATION_IDS.includes(navigationId)) {
    console.warn('Unverified navigationId:', navigationId);
    return null;
  }

  return `myapp://${navigationId}`;
}

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
      const url = await Linking.getInitialURL();
      if (url) {
        return url;
      }

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

    return null;
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);

    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    const foregroundNotification = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground FCM message received:', remoteMessage);

      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'Notification',
        body: remoteMessage.notification?.body || 'You have a new message.',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
        },
      });
    });

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

    const createNotificationChannel = async () => {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });
    };

    requestUserPermission();
    createNotificationChannel();
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
