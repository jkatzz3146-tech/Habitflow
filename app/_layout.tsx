import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '@/utils/ThemeContext';
import { initDb } from '@/data/database';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutContent />
    </AppThemeProvider>
  );
}

function RootLayoutContent() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      initDb().then(() => {
        SplashScreen.hideAsync();
      }).catch(err => {
        console.error('Failed to init DB', err);
        SplashScreen.hideAsync();
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { resolvedTheme } = useAppTheme();

  return (
    <PaperProvider theme={resolvedTheme === 'dark' ? MD3DarkTheme : MD3LightTheme}>
      <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
